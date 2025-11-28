const { Cart } = require('../models');

async function checkCartNotEmpty(ctx, next) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart || !cart.items || cart.items.length === 0) {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('❌ Votre panier est vide');
        return;
      }
      await ctx.reply('❌ Votre panier est vide. Ajoutez des produits d\'abord.');
      return;
    }
    
    return next();
  } catch (error) {
    console.error('Erreur vérification panier:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Erreur vérification panier');
      return;
    }
    await ctx.reply('❌ Erreur vérification panier');
  }
}

async function validateQuantity(ctx, next) {
  if (ctx.message && ctx.message.text) {
    const quantity = parseFloat(ctx.message.text);
    
    if (isNaN(quantity) || quantity < 0.1 || quantity > 1000) {
      await ctx.reply('❌ Quantité invalide. Veuillez entrer un nombre entre 0.1 et 1000 grammes.');
      return;
    }
    
    // Stocker la quantité validée dans le contexte
    ctx.validatedQuantity = quantity;
  }
  
  return next();
}

async function updateCartTimestamp(ctx, next) {
  try {
    await next(); // D'abord exécuter l'action
    
    // Puis mettre à jour le timestamp
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    if (cart) {
      cart.lastActivity = new Date();
      await cart.save();
    }
  } catch (error) {
    console.error('Erreur mise à jour timestamp:', error);
  }
}

module.exports = {
  checkCartNotEmpty,
  validateQuantity,
  updateCartTimestamp
};
