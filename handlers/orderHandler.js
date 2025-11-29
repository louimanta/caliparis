const { Order, OrderItem, Customer, Cart, Product } = require('../models');
const notificationService = require('../services/notificationService');

async function handleCheckout(ctx) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart || cart.items.length === 0) {
      return ctx.answerCbQuery('❌ Votre panier est vide');
    }

    const message = `
💰 *Passer la commande*

🛒 *Récapitulatif de votre panier:*
${cart.items.map(item => `• ${item.quantity}g - ${item.name}`).join('\n')}

💵 *Total: ${cart.totalAmount}€*

💳 *Choisissez votre méthode de paiement:*
    `.trim();

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 Crypto (BTC/ETH)', callback_data: 'pay_crypto' },
            { text: '💵 Cash à la livraison', callback_data: 'pay_cash' }
          ],
          [
            { text: '🎁 Demander remise (+30g)', callback_data: 'ask_discount' }
          ],
          [
            { text: '⬅️ Retour au panier', callback_data: 'back_to_cart' }
          ]
        ]
      },
      parse_mode: 'Markdown'
    };

    await ctx.reply(message, keyboard);
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Erreur checkout:', error);
    await ctx.answerCbQuery('❌ Erreur lors du checkout');
  }
}

async function handlePaymentMethod(ctx, method) {
  try {
    console.log(`💳 DEBUT handlePaymentMethod - User: ${ctx.from.id}, Méthode: ${method}`);
    
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart || cart.items.length === 0) {
      return ctx.answerCbQuery('❌ Votre panier est vide');
    }

    console.log(`📦 Panier trouvé - Total: ${cart.totalAmount}€, Items:`, cart.items);

    // ✅ SAUVEGARDER le totalAmount AVANT de vider le panier
    const totalAmount = cart.totalAmount;
    const cartItems = [...cart.items]; // Copie des items

    // Trouver ou créer le client
    let customer = await Customer.findOne({ where: { telegramId: ctx.from.id } });
    if (!customer) {
      customer = await Customer.create({
        telegramId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
      });
      console.log(`👤 Nouveau client créé: ${customer.id}`);
    }

    // Créer la commande
    const order = await Order.create({
      customerId: customer.id,
      totalAmount: totalAmount, // ✅ Utiliser la valeur sauvegardée
      paymentMethod: method,
      status: 'pending',
      deliveryAddress: customer.deliveryAddress || 'À confirmer'
    });

    console.log(`🤝Merci pour votre commande📋 Commande créée: #${order.id}, Montant: ${totalAmount}€`);

    // Créer les order items
    for (const item of cartItems) {
      await OrderItem.create({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      });

      // Mettre à jour le stock
      const product = await Product.findByPk(item.productId);
      if (product) {
        product.stock -= item.quantity;
        await product.save();
        console.log(`📦 Stock mis à jour: ${product.name} -${item.quantity}g`);
      }
    }

    // ✅ Vider le panier APRÈS avoir utilisé les données
    await Cart.update({
      items: [],
      totalAmount: 0,
      lastActivity: new Date()
    }, {
      where: { id: cart.id }
    });
    console.log(`🛒 Panier vidé`);

    let paymentMessage = '';
    
    if (method === 'crypto') {
      paymentMessage = `
✅ *Commande #${order.id} créée!*

💳 *Paiement Crypto:*
• Envoyez ${totalAmount}€ en BTC ou ETH,USDC,USDT
• Adresse: **En privé** Contact @Caliparisofficial

📦 *Livraison:*
• Sous 2-4h dans Paris
• Emballage discret garanti

🆔 *Référence: CALI-${order.id}*
      `;
    } else {
      paymentMessage = `
✅ *Commande #${order.id} créée!*

💵 *Paiement Cash:*
• Paiement à la livraison
• Préparer le montant exact: ${totalAmount}€

📦 *Livraison:*
• Sous 2-4h dans Paris
• Emballage discret garanti

🆔 *Référence: CALI-${order.id}*
      `;
    }

    // Message de confirmation au client
    await ctx.reply(paymentMessage, { parse_mode: 'Markdown' });

    // Notification admin via le service
    await notificationService.notifyAdmin(ctx, order, customer, { items: cartItems, totalAmount });

    await ctx.answerCbQuery('✅ Commande créée!');
    console.log(`🎉 handlePaymentMethod TERMINÉ - Commande #${order.id}`);
    
  } catch (error) {
    console.error('💥 ERREUR création commande:', error);
    await ctx.answerCbQuery('❌ Erreur création commande');
  }
}

async function handleDiscountRequest(ctx) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart) {
      return ctx.answerCbQuery('❌ Panier vide');
    }

    const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    
    if (totalQuantity < 30) {
      return ctx.answerCbQuery('❌ Remise disponible à partir de 30g');
    }

    const message = `
💎 *Demande de Remise*

📦 Quantité totale: ${totalQuantity}g
💰 Total actuel: ${cart.totalAmount}€

🎁 *Remises automatiques:*
• 30g+: 10% de remise
• 50g+: 15% de remise
• 100g+: 20% de remise

Confirmez-vous la demande de remise?
    `.trim();

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirmer', callback_data: 'confirm_discount_request' },
            { text: '❌ Annuler', callback_data: 'back_to_cart' }
          ]
        ]
      },
      parse_mode: 'Markdown'
    };

    await ctx.reply(message, keyboard);
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Erreur demande remise:', error);
    await ctx.answerCbQuery('❌ Erreur demande remise');
  }
}

async function confirmDiscountRequest(ctx) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    // Notification admin via le service
    await notificationService.notifyDiscountRequest(ctx, ctx.from.id, cart, totalQuantity);

    await ctx.reply(
      '✅ Demande de remise envoyée! 📞\n\n' +
      'Notre équipe vous contactera sous peu pour finaliser votre commande avec remise.'
    );
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Erreur confirmation remise:', error);
    await ctx.answerCbQuery('❌ Erreur confirmation remise');
  }
}

module.exports = { 
  handleCheckout, 
  handlePaymentMethod, 
  handleDiscountRequest, 
  confirmDiscountRequest 
};



