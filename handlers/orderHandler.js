// handlers/orderHandler.js
const { Order, Product, User } = require('../models');
const notificationService = require('../services/notificationService');

async function handleCheckout(ctx) {
  try {
    console.log(`💰 handleCheckout - User: ${ctx.from.id}`);
    console.log(`📦 Panier:`, ctx.session.cart);

    if (!ctx.session.cart || ctx.session.cart.length === 0) {
      await ctx.answerCbQuery('❌ Votre panier est vide');
      return;
    }

    // Calculer le total
    let total = 0;
    let orderDetails = '';

    for (const item of ctx.session.cart) {
      const itemTotal = parseFloat(item.price) * item.quantity;
      total += itemTotal;
      orderDetails += `• ${item.name} - ${item.quantity}g - ${itemTotal}€\n`;
    }

    const message = 
      `💰 *Passer Commande - CaliParis*\n\n` +
      `${orderDetails}\n` +
      `💶 *Total: ${total}€*\n\n` +
      `Choisissez votre méthode de paiement:`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Paiement Crypto', callback_data: 'pay_crypto' }],
          [{ text: '💵 Paiement Cash', callback_data: 'pay_cash' }],
          [{ text: '💎 Demander une remise (30g+)', callback_data: 'ask_discount' }],
          [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }],
          [{ text: '🛒 Retour au panier', callback_data: 'back_to_cart' }]
        ]
      }
    });

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('❌ Erreur dans handleCheckout:', error);
    await ctx.answerCbQuery('❌ Erreur lors du checkout');
  }
}

async function handlePaymentMethod(ctx, method) {
  try {
    console.log(`💳 handlePaymentMethod - User: ${ctx.from.id}, Method: ${method}`);

    if (!ctx.session.cart || ctx.session.cart.length === 0) {
      await ctx.answerCbQuery('❌ Votre panier est vide');
      return;
    }

    // Calculer le total
    let total = 0;
    let orderDetails = '';

    for (const item of ctx.session.cart) {
      const itemTotal = parseFloat(item.price) * item.quantity;
      total += itemTotal;
      orderDetails += `• ${item.name} - ${item.quantity}g - ${itemTotal}€\n`;
    }

    let paymentMessage = '';
    let keyboard = [];

    if (method === 'crypto') {
      paymentMessage = 
        `💳 *Commande Crypto Confirmée!* ✅\n\n` +
        `${orderDetails}\n` +
        `💶 *Total: ${total}€*\n\n` +
        `📧 *Votre commande a été envoyée*\n` +
        `• Nous vous contactons sous 24h\n` +
        `• Pour les détails de paiement crypto\n` +
        `• Livraison sous 2h-4h\n\n` +
        `📍 Zone de livraison: Paris et banlieue\n\n` +
        `🛒 Merci pour votre confiance!`;

      keyboard = [
        [{ text: '📦 Voir le catalogue', callback_data: 'back_to_products' }],
        [{ text: '🏠 Menu principal', callback_data: 'back_to_menu' }]
      ];

    } else if (method === 'cash') {
      paymentMessage = 
        `💵 *Commande Cash Confirmée!* ✅\n\n` +
        `${orderDetails}\n` +
        `💶 *Total: ${total}€*\n\n` +
        `📞 *Votre commande a été envoyée*\n` +
        `• Nous vous contactons sous 24h\n` +
        `• Pour organiser la livraison\n` +
        `• Paiement en espèces à la livraison\n` +
        `• Livraison sous 2h-4h\n\n` +
        `📍 Zone de livraison: Paris et banlieue\n\n` +
        `🛒 Merci pour votre confiance!`;

      keyboard = [
        [{ text: '📦 Voir le catalogue', callback_data: 'back_to_products' }],
        [{ text: '🏠 Menu principal', callback_data: 'back_to_menu' }]
      ];
    }

    await ctx.reply(paymentMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // Créer la commande en base de données
    await createOrder(ctx, method, total);

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('❌ Erreur dans handlePaymentMethod:', error);
    await ctx.answerCbQuery('❌ Erreur lors du choix du paiement');
  }
}

async function createOrder(ctx, paymentMethod, total) {
  try {
    const order = await Order.create({
      userId: ctx.from.id,
      username: ctx.from.username || ctx.from.first_name,
      items: ctx.session.cart, // CORRECTION: Utiliser directement ctx.session.cart
      totalAmount: total,
      paymentMethod: paymentMethod,
      status: 'pending'
    });

    console.log(`✅ Commande créée: ${order.id}`);

    // NOTIFIER AUTOMATIQUEMENT avec tous les détails
    await notifyNewOrder(order, ctx, ctx.session.cart); // CORRECTION: Passer le panier en paramètre

    // Vider le panier après commande
    ctx.session.cart = [];
    ctx.session = { ...ctx.session };

    return order;

  } catch (error) {
    console.error('❌ Erreur création commande:', error);
    throw error;
  }
}

// FONCTION CORRIGÉE: Notification automatique détaillée
async function notifyNewOrder(order, ctx, cartItems) { // CORRECTION: Ajouter cartItems en paramètre
  try {
    const user = ctx.from;
    const username = user.username ? `@${user.username}` : user.first_name;
    const userId = user.id;
    
    // CORRECTION: Utiliser cartItems au lieu de order.items
    let productsText = '';
    if (cartItems && cartItems.length > 0) {
      cartItems.forEach(item => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        productsText += `• ${item.name} - ${item.quantity}g - ${itemTotal}€\n`;
      });
    } else {
      productsText = '• Aucun produit trouvé\n';
    }

    // Date formatée
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR');

    const message = 
      `🆕 *NOUVELLE COMMANDE #${order.id}* 🆕\n\n` +
      `👤 *CLIENT:* ${username}\n` +
      `🔢 *ID:* ${userId}\n` +
      `📞 *CONTACT:* https://t.me/${user.username || user.id}\n\n` +
      `📦 *PRODUITS COMMANDÉS:*\n${productsText}\n` +
      `💶 *TOTAL: ${order.totalAmount}€*\n` +
      `💳 *MODE DE PAIEMENT:* ${order.paymentMethod}\n` +
      `🕒 *DATE:* ${dateStr} ${timeStr}\n\n` +
      `📍 *ZONE:* Paris et banlieue\n` +
      `🚚 *LIVRAISON:* 2h-4h\n\n` +
      `⚡ *ACTION RAPIDE:*\n` +
      `📞 Contacter: tg://user?id=${userId}`;

    // Envoyer la notification automatique à @caliparisofficial
    await notificationService.notifyAdmins(message);

    console.log(`📤 Notification commande #${order.id} envoyée automatiquement`);

  } catch (error) {
    console.error('❌ Erreur notification commande:', error);
  }
}

async function handleDiscountRequest(ctx) {
  try {
    console.log(`💎 handleDiscountRequest - User: ${ctx.from.id}`);

    // Calculer la quantité totale
    const totalQuantity = ctx.session.cart.reduce((sum, item) => sum + item.quantity, 0);

    if (totalQuantity < 30) {
      await ctx.answerCbQuery('❌ Remise disponible à partir de 30g');
      return;
    }

    // Calculer le total
    let total = 0;
    let orderDetails = '';

    for (const item of ctx.session.cart) {
      const itemTotal = parseFloat(item.price) * item.quantity;
      total += itemTotal;
      orderDetails += `• ${item.name} - ${item.quantity}g - ${itemTotal}€\n`;
    }

    const message = 
      `💎 *Demande de Remise - Commandes en Gros*\n\n` +
      `${orderDetails}\n` +
      `💶 *Total: ${total}€*\n\n` +
      `Votre commande totale: ${totalQuantity}g\n\n` +
      `📞 *Votre demande a été envoyée*\n` +
      `• Nous vous contactons des que possible\n` +
      `• Pour discuter des remises spéciales\n` +
      `• Et personnaliser votre commande\n\n` +
      `*Remises progressives selon la quantité!*`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }],
          [{ text: '🏠 Menu principal', callback_data: 'back_to_menu' }]
        ]
      }
    });

    // Notifier aussi la demande de remise
    await notifyDiscountRequest(ctx, totalQuantity, total);

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('❌ Erreur dans handleDiscountRequest:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la demande de remise');
  }
}

// Notification pour les demandes de remise
async function notifyDiscountRequest(ctx, totalQuantity, total) {
  try {
    const user = ctx.from;
    const username = user.username ? `@${user.username}` : user.first_name;

    let productsText = '';
    if (ctx.session.cart && ctx.session.cart.length > 0) {
      ctx.session.cart.forEach(item => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        productsText += `• ${item.name} - ${item.quantity}g - ${itemTotal}€\n`;
      });
    }

    const message = 
      `💎 *DEMANDE DE REMISE - GROS* 💎\n\n` +
      `👤 *CLIENT:* ${username} (${user.id})\n` +
      `📞 *CONTACT:* https://t.me/${user.username || user.id}\n\n` +
      `📦 *PRODUITS:*\n${productsText}\n` +
      `⚖️ *QUANTITÉ TOTALE:* ${totalQuantity}g\n` +
      `💶 *TOTAL NORMAL:* ${total}€\n\n` +
      `📍 *ACTION:* Contacter pour négocier remise\n` +
      `📞 *LIEN:* tg://user?id=${user.id}`;

    await notificationService.notifyAdmins(message);

  } catch (error) {
    console.error('❌ Erreur notification remise:', error);
  }
}

async function confirmDiscountRequest(ctx) {
  try {
    await ctx.answerCbQuery('📞 Demande envoyée...');

    await ctx.reply(
      `💎 *Demande Envoyée!* ✅\n\n` +
      `Votre demande de remise a été transmise.\n` +
      `Nous vous contactons des que possible pour discuter des meilleurs prix!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }],
            [{ text: '🏠 Menu principal', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('❌ Erreur dans confirmDiscountRequest:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la confirmation');
  }
}

module.exports = {
  handleCheckout,
  handlePaymentMethod,
  handleDiscountRequest,
  confirmDiscountRequest
};
