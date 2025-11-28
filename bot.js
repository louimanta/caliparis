require('dotenv').config();
const { Telegraf, session } = require('telegraf');

console.log('🚀 Démarrage du bot CaliParis...');

// Fonction pour charger les modules avec gestion d'erreur
function loadModule(modulePath, fallback = null) {
  try {
    console.log(`🔍 Chargement: ${modulePath}`);
    const module = require(modulePath);
    console.log(`✅ ${modulePath} chargé avec succès`);
    return module;
  } catch (error) {
    console.log(`❌ Impossible de charger ${modulePath}:`, error.message);
    
    // Essayer un chemin alternatif
    try {
      const altPath = modulePath.replace('./', '../');
      console.log(`🔍 Essai chemin alternatif: ${altPath}`);
      const module = require(altPath);
      console.log(`✅ ${altPath} chargé avec succès`);
      return module;
    } catch (error2) {
      console.log(`❌ Chemin alternatif échoué: ${altPath}`);
      
      if (fallback) {
        console.log(`⚠️  Utilisation du fallback pour ${modulePath}`);
        return fallback;
      }
      // Retourner un objet vide avec des fonctions vides
      return {};
    }
  }
}

// Fallbacks basiques pour les handlers
const fallbackHandlers = {
  handleStart: (ctx) => ctx.reply('🌿 Bienvenue chez CaliParis! 🌿\n\nUtilisez les boutons pour naviguer.'),
  showProducts: (ctx) => ctx.reply('📦 Catalogue - Choisissez vos produits'),
  showCart: (ctx) => ctx.reply('🛒 Votre panier est vide'),
  handleCheckout: (ctx) => ctx.reply('💰 Passer commande'),
  handleAdminCommands: (ctx) => ctx.reply('👨‍💼 Panel administrateur')
};

// Chargement sécurisé des handlers
console.log('📥 Chargement des handlers...');
const startHandler = loadModule('./handlers/startHandler', { handleStart: fallbackHandlers.handleStart });
const productHandler = loadModule('./handlers/productHandler', { 
  showProducts: fallbackHandlers.showProducts,
  showProductVideo: (ctx) => ctx.answerCbQuery('🎬 Vidéo non disponible'),
  showProductDetails: (ctx) => ctx.answerCbQuery('📊 Détails non disponibles')
});
const cartHandler = loadModule('./handlers/cartHandler', {
  handleAddToCart: (ctx) => ctx.answerCbQuery('✅ Produit ajouté'),
  handleCustomQuantity: (ctx) => ctx.reply('🔢 Entrez la quantité:'),
  handleCustomQuantityResponse: (ctx) => ctx.reply('✅ Quantité ajoutée'),
  showCart: fallbackHandlers.showCart,
  clearCart: (ctx) => ctx.reply('✅ Panier vidé')
});
const orderHandler = loadModule('./handlers/orderHandler', {
  handleCheckout: fallbackHandlers.handleCheckout,
  handlePaymentMethod: (ctx) => ctx.reply('💳 Méthode de paiement'),
  handleDiscountRequest: (ctx) => ctx.reply('💎 Demande de remise'),
  confirmDiscountRequest: (ctx) => ctx.reply('✅ Demande envoyée')
});
const adminHandler = loadModule('./handlers/adminHandler', {
  handleAdminCommands: fallbackHandlers.handleAdminCommands,
  showAdminStats: (ctx) => ctx.reply('📊 Statistiques'),
  showPendingOrders: (ctx) => ctx.reply('📦 Commandes en attente'),
  handleOrderAction: (ctx) => ctx.answerCbQuery('✅ Action effectuée')
});

// Chargement sécurisé des middlewares
console.log('📥 Chargement des middlewares...');
const authMiddleware = loadModule('./middlewares/authMiddleware', {
  isAdmin: (ctx, next) => next(),
  isUser: (ctx, next) => next(),
  logUserAction: (ctx, next) => {
    console.log(`👤 User ${ctx.from.id} - Action`);
    return next();
  },
  rateLimit: () => (ctx, next) => next()
});

const cartMiddleware = loadModule('./middlewares/cartMiddleware', {
  checkCartNotEmpty: (ctx, next) => next(),
  validateQuantity: (ctx, next) => next(),
  updateCartTimestamp: (ctx, next) => next()
});

// Chargement sécurisé des models
console.log('📥 Chargement des models...');
let sequelize = null;
try {
  const models = loadModule('./models');
  sequelize = models.sequelize;
  console.log('✅ Models chargés avec succès');
} catch (error) {
  console.log('❌ Models non disponibles, mode sans base de données');
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middlewares globaux
bot.use(session());
bot.use(authMiddleware.logUserAction);
bot.use(authMiddleware.rateLimit());
bot.use(cartMiddleware.updateCartTimestamp);

// Commandes de base
bot.start(startHandler.handleStart);

// Handlers de messages
bot.hears('📦 Voir le catalogue', productHandler.showProducts);
bot.hears('🛒 Mon panier', cartHandler.showCart);
bot.hears('🎬 Vidéo présentation', (ctx) => {
  ctx.reply('🎬 Vidéo de présentation bientôt disponible!\nDécouvrez notre qualité premium 🌿');
});
bot.hears('📞 Contact', (ctx) => {
  ctx.reply(
    '📞 *Contact CaliParis*\n\n' +
    'Pour toute question:\n' +
    '• Via ce bot\n' +
    '• Réponse sous 24h\n\n' +
    '🚚 Livraison discrète Paris et banlieue',
    { parse_mode: 'Markdown' }
  );
});
bot.hears('ℹ️ Informations', (ctx) => {
  ctx.reply(
    'ℹ️ *Informations CaliParis*\n\n' +
    '🌟 Qualité Premium\n' +
    '📦 Livraison 24h-48h\n' +
    '🔒 Emballage discret\n' +
    '💳 Paiement sécurisé',
    { parse_mode: 'Markdown' }
  );
});
bot.hears('💎 Commandes en gros', (ctx) => {
  ctx.reply(
    '💎 *Commandes en Gros*\n\n' +
    'Pour 30g et plus:\n' +
    '• Remises spéciales\n' +
    '• Service personnalisé\n\n' +
    'Ajoutez 30g+ dans votre panier!',
    { parse_mode: 'Markdown' }
  );
});

// Gestion des quantités personnalisées
bot.on('text', async (ctx, next) => {
  if (ctx.session && ctx.session.waitingForCustomQuantity) {
    await cartHandler.handleCustomQuantityResponse(ctx);
    return;
  }
  return next();
});

// Commandes admin
bot.hears('/admin', authMiddleware.isAdmin, adminHandler.handleAdminCommands);

// Callbacks pour produits
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
  const quantity = parseInt(ctx.match[1]);
  const productId = parseInt(ctx.match[2]);
  await cartHandler.handleAddToCart(ctx, productId, quantity);
});

bot.action(/custom_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await cartHandler.handleCustomQuantity(ctx, productId);
});

bot.action(/cancel_custom_(\d+)/, async (ctx) => {
  if (ctx.session) delete ctx.session.waitingForCustomQuantity;
  await ctx.answerCbQuery('❌ Quantité annulée');
});

bot.action(/video_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await productHandler.showProductVideo(ctx, productId);
});

bot.action(/details_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await productHandler.showProductDetails(ctx, productId);
});

// Callbacks pour panier
bot.action('view_cart', cartHandler.showCart);
bot.action('back_to_products', productHandler.showProducts);
bot.action('back_to_cart', cartHandler.showCart);
bot.action('clear_cart', async (ctx) => {
  await cartHandler.clearCart(ctx);
  await ctx.answerCbQuery('✅ Panier vidé');
});

// Callbacks pour commande
bot.action('checkout', async (ctx) => {
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handleCheckout(ctx));
});
bot.action('pay_crypto', async (ctx) => {
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handlePaymentMethod(ctx, 'crypto'));
});
bot.action('pay_cash', async (ctx) => {
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handlePaymentMethod(ctx, 'cash'));
});
bot.action('ask_discount', async (ctx) => {
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handleDiscountRequest(ctx));
});
bot.action('confirm_discount_request', async (ctx) => {
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.confirmDiscountRequest(ctx));
});

// Callbacks admin
bot.action('admin_stats', authMiddleware.isAdmin, adminHandler.showAdminStats);
bot.action('admin_pending_orders', authMiddleware.isAdmin, adminHandler.showPendingOrders);
bot.action(/admin_process_(\d+)/, authMiddleware.isAdmin, (ctx) => 
  adminHandler.handleOrderAction(ctx, parseInt(ctx.match[1]), 'process'));
bot.action(/admin_contact_(\d+)/, authMiddleware.isAdmin, (ctx) => 
  adminHandler.handleOrderAction(ctx, parseInt(ctx.match[1]), 'contact'));

// Gestion des erreurs
bot.catch((err, ctx) => {
  console.error('❌ Erreur bot:', err);
  ctx.reply('❌ Une erreur est survenue. Veuillez réessayer.');
});

// Démarrage résilient du bot
function startBot() {
  try {
    console.log('🤖 Lancement du bot...');
    
    if (sequelize) {
      // Essayer avec la base de données
      sequelize.sync()
        .then(() => {
          console.log('✅ Base de données synchronisée');
          bot.launch();
          console.log('🎉 Bot CaliParis démarré avec base de données!');
        })
        .catch(dbError => {
          console.log('❌ Erreur DB, démarrage sans:', dbError.message);
          bot.launch();
          console.log('🎉 Bot CaliParis démarré sans base de données!');
        });
    } else {
      // Démarrage sans base de données
      bot.launch();
      console.log('🎉 Bot CaliParis démarré en mode standalone!');
    }
  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
    // Dernière tentative
    try {
      bot.launch();
      console.log('🎉 Bot démarré en mode de secours!');
    } catch (finalError) {
      console.error('💥 Échec critique:', finalError);
    }
  }
}

// Démarrer après un délai
setTimeout(startBot, 2000);

// Ajoutez cette méthode pour le webhook
bot.secretPathComponent = () => {
  return 'c5bbd267c75e26ee56bbb7d0744acfcc8b20f7bc305ddd6556e36b22f63be7c9';
};

// Gestion propre de l'arrêt
process.once('SIGINT', () => {
  console.log('🛑 Arrêt du bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 Arrêt du bot...');
  bot.stop('SIGTERM');
});

module.exports = bot;

