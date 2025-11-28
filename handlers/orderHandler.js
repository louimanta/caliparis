const { Order, OrderItem, Customer, Cart, Product } = require('../models');

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
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart || cart.items.length === 0) {
      return ctx.answerCbQuery('❌ Votre panier est vide');
    }

    // Trouver ou créer le client
    let customer = await Customer.findOne({ where: { telegramId: ctx.from.id } });
    if (!customer) {
      customer = await Customer.create({
        telegramId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
      });
    }

    // Créer la commande
    const order = await Order.create({
      customerId: customer.id,
      totalAmount: cart.totalAmount,
      paymentMethod: method,
      status: 'pending',
      deliveryAddress: customer.deliveryAddress || 'À confirmer'
    });

    // Créer les order items
    for (const item of cart.items) {
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
      }
    }

    // Vider le panier
    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    let paymentMessage = '';
    
    if (method === 'crypto') {
      paymentMessage = `
✅ *Commande #${order.id} créée!*

💳 *Paiement Crypto:*
• Envoyez ${cart.totalAmount}€ en BTC ou ETH
• Adresse: **1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa**
• Contactez-nous après paiement

📦 *Livraison:*
• Sous 24-48h dans Paris
• Emballage discret garanti

🆔 *Référence: CALI-${order.id}*
      `;
    } else {
      paymentMessage = `
✅ *Commande #${order.id} créée!*

💵 *Paiement Cash:*
• Paiement à la livraison
• Préparer le montant exact: ${cart.totalAmount}€

📦 *Livraison:*
• Sous 24-48h dans Paris
• Emballage discret garanti

🆔 *Référence: CALI-${order.id}*
      `;
    }

    // Message de confirmation au client
    await ctx.reply(paymentMessage, { parse_mode: 'Markdown' });

    // Notification admin
    const adminMessage = `
🆕 *NOUVELLE COMMANDE #${order.id}*

👤 Client: ${customer.firstName} ${customer.lastName} (@${customer.username})
💰 Montant: ${order.totalAmount}€
💳 Paiement: ${method === 'crypto' ? 'Crypto' : 'Cash'}
📦 Produits: ${cart.items.map(item => `${item.quantity}g ${item.name}`).join(', ')}

🆔 Référence: CALI-${order.id}
    `.trim();

    // Envoyer la notification admin via le contexte
    if (process.env.ADMIN_CHAT_ID) {
      await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, adminMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Traiter', callback_data: `admin_process_${order.id}` },
              { text: '📞 Contacter', callback_data: `admin_contact_${order.id}` }
            ]
          ]
        }
      });
    }

    await ctx.answerCbQuery('✅ Commande créée!');
    
  } catch (error) {
    console.error('Erreur création commande:', error);
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
    // Notification admin pour remise
    const adminMessage = `
💎 *DEMANDE DE REMISE*

👤 Client: ${ctx.from.first_name} ${ctx.from.last_name} (@${ctx.from.username})
📊 Demande une remise pour grosse quantité

💬 Contactez le client pour finaliser
    `.trim();

    if (process.env.ADMIN_CHAT_ID) {
      await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, adminMessage, {
        parse_mode: 'Markdown'
      });
    }

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
