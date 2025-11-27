const { Markup } = require('telegraf');
const { Order, Customer } = require('../models');
const cartService = require('../services/cartService');
const notificationService = require('../services/notificationService');

async function handleCheckout(ctx) {
  const cart = cartService.getCart(ctx.from.id);

  if (cart.items.length === 0) {
    return ctx.answerCbQuery('❌ Votre panier est vide');
  }

  const totalGrams = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  let message = `💰 *Finaliser la Commande*\n\n`;
  message += `📦 Quantité totale: ${totalGrams}g\n`;
  message += `💰 Total: ${cart.total}€\n\n`;

  if (totalGrams >= 30) {
    message += `💎 *Commande premium!* Remise disponible\n\n`;
  }

  message += `Choisissez votre mode de paiement:`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('₿ Crypto', 'pay_crypto'),
        Markup.button.callback('💵 Cash', 'pay_cash')
      ],
      totalGrams >= 30 ? [Markup.button.callback('💎 Demander remise (30g+)', 'ask_discount')] : [],
      [Markup.button.callback('🔙 Retour au panier', 'back_to_cart')]
    ].filter(row => row.length > 0))
  });
}

async function handlePaymentMethod(ctx, method) {
  const cart = cartService.getCart(ctx.from.id);

  await ctx.reply(
    `💳 *Paiement ${method === 'crypto' ? 'Crypto' : 'Cash'}*\n\n` +
    `Total: ${cart.total}€\n\n` +
    `Veuillez envoyer :\n` +
    `• Votre adresse de livraison complète\n` +
    `• Votre numéro de téléphone\n` +
    `• Toute information utile pour le livreur\n\n` +
    `_Envoyez tout en un seul message_`,
    { parse_mode: 'Markdown' }
  );

  // Attendre les infos de livraison
  const waitForResponse = (ctx) => {
    return new Promise((resolve) => {
      const messageHandler = async (msgCtx) => {
        if (msgCtx.from.id === ctx.from.id && msgCtx.message.text) {
          bot.off('message', messageHandler);
          resolve(msgCtx);
        }
      };
      bot.on('message', messageHandler);
    });
  };

  try {
    const responseCtx = await waitForResponse(ctx);
    await createOrder(responseCtx, cart, method, responseCtx.message.text);
  } catch (error) {
    console.error('❌ Erreur création commande:', error);
    await ctx.reply('❌ Erreur lors de la création de la commande.');
  }
}

async function createOrder(ctx, cart, paymentMethod, address) {
  try {
    // Mettre à jour le client
    await Customer.upsert({
      telegramId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name || ''
    });

    // Créer la commande
    const order = await Order.create({
      customerId: ctx.from.id,
      customerName: `${ctx.from.first_name} ${ctx.from.last_name || ''}`,
      customerUsername: ctx.from.username,
      products: cart.items,
      total: cart.total,
      paymentMethod: paymentMethod,
      address: address,
      contactInfo: `@${ctx.from.username || 'N/A'} - ${ctx.from.id}`,
      status: 'pending'
    });

    // Notifier l'admin
    await notificationService.notifyAdmin(order);

    // Confirmer au client
    await ctx.reply(
      `✅ *Commande confirmée!*\n\n` +
      `📦 Numéro: #${order.id}\n` +
      `💰 Total: ${order.total}€\n` +
      `💳 Paiement: ${paymentMethod}\n` +
      `📍 Statut: En attente\n\n` +
      `Nous vous contacterons sous 24h pour finaliser.\n` +
      `Merci pour votre confiance ! 🌿`,
      { parse_mode: 'Markdown' }
    );

    // Vider le panier
    cartService.clearCart(ctx.from.id);

  } catch (error) {
    console.error('❌ Erreur création commande:', error);
    throw error;
  }
}

async function handleDiscountRequest(ctx) {
  const cart = cartService.getCart(ctx.from.id);
  const totalGrams = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  if (totalGrams >= 30) {
    await ctx.reply(
      `💎 *Demande de remise pour commande en gros*\n\n` +
      `Votre commande: ${totalGrams}g - ${cart.total}€\n\n` +
      `_Nous vous contacterons dans les 10 minutes avec une offre personnalisée!_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Confirmer la demande', 'confirm_discount_request')],
          [Markup.button.callback('🔙 Commander normalement', 'checkout')]
        ])
      }
    );
  } else {
    await ctx.answerCbQuery('❌ Remise disponible à partir de 30g');
  }
}

async function confirmDiscountRequest(ctx) {
  const cart = cartService.getCart(ctx.from.id);
  const totalGrams = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // Notifier l'admin pour une remise
  await notificationService.notifyDiscountRequest(ctx.from.id, cart, totalGrams);

  await ctx.reply(
    `💎 *Demande de remise envoyée!*\n\n` +
    `Nous vous contacterons sous peu avec une offre personnalisée pour vos ${totalGrams}g.\n\n` +
    `📞 Restez connecté!\n\n` +
    `Votre panier a été sauvegardé.`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  handleCheckout,
  handlePaymentMethod,
  handleDiscountRequest,
  confirmDiscountRequest
};