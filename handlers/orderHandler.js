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
        `💳 *Paiement Crypto*\n\n` +
        `${orderDetails}\n` +
        `💶 *Total: ${total}€*\n\n` +
        `📧 *Instructions de paiement:*\n` +
        `1. Contactez @Caliplatesparis pour les détails de paiement\n` +
        `2. Envoyez la preuve de transaction\n` +
        `3. Livraison sous 24h-48h\n\n` +
        `📍 Zone de livraison: Paris et banlieue`;

      keyboard = [
        [{ text: '📞 Contacter pour paiement', url: 'https://t.me/Caliplatesparis' }],
        [{ text: '🛒 Retour au panier', callback_data: 'back_to_cart' }],
        [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }]
      ];

    } else if (method === 'cash') {
      paymentMessage = 
        `💵 *Paiement Cash*\n\n` +
        `${orderDetails}\n` +
        `💶 *Total: ${total}€*\n\n` +
        `📞 *Instructions de paiement:*\n` +
        `1. Contactez @Caliplatesparis pour organiser la livraison\n` +
        `2. Paiement en espèces à la livraison\n` +
        `3. Livraison sous 24h-48h\n\n` +
        `📍 Zone de livraison: Paris et banlieue`;

      keyboard = [
        [{ text: '📞 Contacter pour livraison', url: 'https://t.me/Caliplatesparis' }],
        [{ text: '🛒 Retour au panier', callback_data: 'back_to_cart' }],
        [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }]
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
      items: ctx.session.cart,
      total: total,
      paymentMethod: paymentMethod,
      status: 'pending'
    });

    console.log(`✅ Commande créée: ${order.id}`);

    // Notifier les admins
    await notificationService.notifyAdmins(
      `🆕 Nouvelle commande #${order.id}\n` +
      `Client: @${ctx.from.username || ctx.from.first_name}\n` +
      `Total: ${total}€\n` +
      `Paiement: ${paymentMethod}`
    );

    // Vider le panier après commande
    ctx.session.cart = [];
    ctx.session = { ...ctx.session };

    return order;

  } catch (error) {
    console.error('❌ Erreur création commande:', error);
    throw error;
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

    const message = 
      `💎 *Demande de Remise - Commandes en Gros*\n\n` +
      `Votre commande totale: ${totalQuantity}g\n\n` +
      `📞 Contactez @Caliplatesparis pour:\n` +
      `• Obtenir un prix spécial\n` +
      `• Discuter des conditions de livraison\n` +
      `• Personnaliser votre commande\n\n` +
      `*Remises progressives selon la quantité!*`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📞 Contacter pour remise', url: 'https://t.me/Caliplatesparis' }],
          [{ text: '🛒 Retour au panier', callback_data: 'back_to_cart' }],
          [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }]
        ]
      }
    });

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('❌ Erreur dans handleDiscountRequest:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la demande de remise');
  }
}

async function confirmDiscountRequest(ctx) {
  try {
    await ctx.answerCbQuery('📞 Redirection vers le support...');

    await ctx.reply(
      `💎 *Contact Support CaliParis*\n\n` +
      `Contactez @Caliplatesparis pour discuter de votre commande en gros et obtenir les meilleurs prix!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📞 Contacter maintenant', url: 'https://t.me/Caliplatesparis' }],
            [{ text: '🛒 Retour au panier', callback_data: 'back_to_cart' }]
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
