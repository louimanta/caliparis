const { Markup } = require('telegraf');
const { Product } = require('../models');
const cartService = require('../services/cartService');

async function handleAddToCart(ctx, productId, quantity) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    if (product.stock < quantity) {
      return ctx.answerCbQuery(`❌ Stock insuffisant. Il reste ${product.stock}g`);
    }

    cartService.addToCart(ctx.from.id, product, quantity);

    await ctx.answerCbQuery(`✅ ${quantity}g de ${product.name} ajouté(s)`);

    await ctx.reply(
      `✅ *Ajouté au panier!*\n\n` +
      `🛍️ ${product.name}\n` +
      `📦 ${quantity}g x ${product.price}€ = ${quantity * product.price}€\n\n` +
      `Votre panier total: ${cartService.getCart(ctx.from.id).total}€`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🛒 Voir mon panier', 'view_cart')],
          [Markup.button.callback('📦 Continuer shopping', 'back_to_products')]
        ])
      }
    );
  } catch (error) {
    console.error('❌ Erreur ajout panier:', error);
    await ctx.answerCbQuery('❌ Erreur lors de l\'ajout au panier');
  }
}

async function handleCustomQuantity(ctx, productId) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    await ctx.reply(
      `⚡ *Quantité personnalisée - ${product.name}*\n\n` +
      `💰 Prix: ${product.price}€/g\n` +
      `📦 Stock disponible: ${product.stock}g\n\n` +
      `_Envoyez le nombre de grammes souhaité (1-${product.stock}):_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Annuler', `cancel_custom_${productId}`)]
        ])
      }
    );

    // Attendre la réponse de l'utilisateur
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

    const responseCtx = await waitForResponse(ctx);
    const quantity = parseInt(responseCtx.message.text);

    if (!quantity || quantity < 1 || quantity > product.stock) {
      return responseCtx.reply(
        `❌ Quantité invalide. Veuillez envoyer un nombre entre 1 et ${product.stock}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Réessayer', `custom_${productId}`)]
        ])
      );
    }

    cartService.addToCart(responseCtx.from.id, product, quantity);

    await responseCtx.reply(
      `✅ *Ajouté au panier!*\n\n` +
      `🛍️ ${product.name}\n` +
      `📦 ${quantity}g x ${product.price}€ = ${quantity * product.price}€\n\n` +
      `Votre panier total: ${cartService.getCart(responseCtx.from.id).total}€`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🛒 Voir mon panier', 'view_cart')],
          [Markup.button.callback('📦 Continuer shopping', 'back_to_products')]
        ])
      }
    );

  } catch (error) {
    console.error('❌ Erreur quantité personnalisée:', error);
    await ctx.answerCbQuery('❌ Erreur quantité personnalisée');
  }
}

async function showCart(ctx) {
  const cart = cartService.getCart(ctx.from.id);

  if (cart.items.length === 0) {
    return ctx.reply('🛒 Votre panier est vide\n\nUtilisez "📦 Voir le catalogue" pour ajouter des produits.');
  }

  const message = cart.items.map(item =>
    `• ${item.product.name} - ${item.quantity}g x ${item.product.price}€`
  ).join('\n');

  const totalGrams = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  let cartMessage = `🛒 *Votre Panier*\n\n${message}\n\n`;
  cartMessage += `📦 Quantité totale: ${totalGrams}g\n`;
  cartMessage += `💰 *Total: ${cart.total}€*`;

  // Ajouter suggestion remise pour grosses quantités
  if (totalGrams >= 30) {
    cartMessage += `\n\n💎 *Remise disponible pour +30g!*`;
  }

  await ctx.reply(cartMessage, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('💳 Commander maintenant', 'checkout')],
      totalGrams >= 30 ? [Markup.button.callback('💎 Demander remise', 'ask_discount')] : [],
      [Markup.button.callback('🗑️ Vider le panier', 'clear_cart')],
      [Markup.button.callback('📦 Continuer mes achats', 'back_to_products')]
    ].filter(row => row.length > 0))
  });
}

async function clearCart(ctx) {
  cartService.clearCart(ctx.from.id);
  await ctx.answerCbQuery('✅ Panier vidé');
  await ctx.reply('🗑️ Votre panier a été vidé.');
}

module.exports = {
  handleAddToCart,
  handleCustomQuantity,
  showCart,
  clearCart
};