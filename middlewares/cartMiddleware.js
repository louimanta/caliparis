
// middlewares/cartMiddleware.js
async function checkCartNotEmpty(ctx, next) {
  try {
    console.log(`🔍 checkCartNotEmpty - User: ${ctx.from.id}`);
    console.log(`📦 Panier:`, ctx.session.cart);

    if (!ctx.session.cart || ctx.session.cart.length === 0) {
      await ctx.answerCbQuery('❌ Votre panier est vide');
      return;
    }
    
    await next();
  } catch (error) {
    console.error('❌ Erreur dans checkCartNotEmpty:', error);
    await ctx.answerCbQuery('❌ Erreur de vérification du panier');
  }
}

function validateQuantity(ctx, next) {
  // Validation des quantités
  return next();
}

function updateCartTimestamp(ctx, next) {
  // Mettre à jour le timestamp du panier
  if (ctx.session.cart) {
    ctx.session.cartUpdatedAt = new Date();
  }
  return next();
}

module.exports = {
  checkCartNotEmpty,
  validateQuantity,
  updateCartTimestamp
};
