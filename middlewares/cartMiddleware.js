const { Cart } = require('../models');

async function checkCartNotEmpty(ctx, next) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart || cart.items.length === 0) {
      if (ctx.callbackQuery) {
        return ctx.answerCbQuery('❌ Votre panier est vide');
      }
      return ctx.reply('❌ Votre panier est vide. Ajoutez des produits d\'abord.');
    }
    
    return next();
  } catch (error) {
    console.error('Erreur vérification panier:', error);
    if (ctx.callbackQuery) {
      return ctx.answerCbQuery('❌ Erreur vérification panier');
    }
    return ctx.reply('❌ Erreur vérification panier');
  }
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

async function updateCartTimestamp(ctx, next) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    if (cart) {
      cart.lastActivity = new Date();
      await cart.save();
    }
  } catch (error) {
    console.error('Erreur mise à jour timestamp:', error);
  }
  
  return next();
}

module.exports = {
  checkCartNotEmpty,
  validateQuantity,
  updateCartTimestamp
};
