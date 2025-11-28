const path = require('path');

// Fonction pour charger les modèles avec gestion d'erreur
function loadCartModel() {
  try {
    console.log('🔍 Tentative de chargement des modèles...');
    
    // Essayer le chemin normal
    const models = require('../models');
    console.log('✅ Modèles chargés depuis ../models');
    return models.Cart;
  } catch (error) {
    console.log('❌ Premier essai échoué:', error.message);
    
    try {
      // Essayer un chemin alternatif
      const models = require('./models');
      console.log('✅ Modèles chargés depuis ./models');
      return models.Cart;
    } catch (error2) {
      console.log('❌ Deuxième essai échoué:', error2.message);
      
      try {
        // Essayer avec le chemin absolu de Render
        const models = require('/opt/render/project/src/models');
        console.log('✅ Modèles chargés depuis chemin Render');
        return models.Cart;
      } catch (error3) {
        console.log('❌ Tous les essais ont échoué, utilisation du mode secours');
        return null;
      }
    }
  }
}

// Charger le modèle Cart
const Cart = loadCartModel();

// Middlewares de secours si les modèles ne sont pas disponibles
const fallbackMiddlewares = {
  checkCartNotEmpty: async (ctx, next) => {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Service panier temporairement indisponible');
      return;
    }
    await ctx.reply('❌ Service panier temporairement indisponible');
  },
  validateQuantity: (ctx, next) => {
    if (ctx.message && ctx.message.text) {
      const quantity = parseFloat(ctx.message.text);
      if (isNaN(quantity) || quantity < 0.1 || quantity > 1000) {
        ctx.reply('❌ Quantité invalide. Entre 0.1 et 1000 grammes.');
        return;
      }
      ctx.validatedQuantity = quantity;
    }
    return next();
  },
  updateCartTimestamp: (ctx, next) => next()
};

// Si Cart n'est pas disponible, utiliser les middlewares de secours
if (!Cart) {
  console.log('⚠️  Utilisation des middlewares de secours pour cartMiddleware');
  module.exports = fallbackMiddlewares;
} else {
  console.log('✅ Utilisation des middlewares normaux avec base de données');

  // Middlewares normaux (avec base de données)
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
      
      ctx.validatedQuantity = quantity;
    }
    
    return next();
  }

  async function updateCartTimestamp(ctx, next) {
    try {
      await next();
      
      // Mettre à jour le timestamp après l'action
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
}
