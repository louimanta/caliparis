const cartService = require('../services/cartService');

function checkCartNotEmpty(ctx, next) {
  const cart = cartService.getCart(ctx.from.id);
  
  if (cart.items.length === 0) {
    if (ctx.callbackQuery) {
      return ctx.answerCbQuery('❌ Votre panier est vide');
    }
    return ctx.reply('❌ Votre panier est vide. Ajoutez des produits d\'abord.');
  }
  
  return next();
}

function validateQuantity(ctx, next) {
  if (ctx.message && ctx.message.text) {
    const quantity = parseInt(ctx.message.text);
    
    if (isNaN(quantity) || quantity < 1 || quantity > 1000) {
      return ctx.reply('❌ Quantité invalide. Veuillez entrer un nombre entre 1 et 1000.');
    }
  }
  
  return next();
}

function updateCartTimestamp(ctx, next) {
  // Met à jour le timestamp du panier à chaque interaction
  const cart = cartService.getCart(ctx.from.id);
  cart.updatedAt = new Date();
  
  return next();
}

module.exports = {
  checkCartNotEmpty,
  validateQuantity,
  updateCartTimestamp
};