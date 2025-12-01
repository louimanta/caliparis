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

// === AJOUT: Fonction pour gérer les callbacks expirés ===
function safeAnswerCbQuery(ctx, text = '') {
  try {
    return ctx.answerCbQuery(text).catch(err => {
      if (err.description && err.description.includes('query is too old')) {
        console.log('⚠️ Callback query expiré, ignoré silencieusement');
        return Promise.resolve();
      }
      throw err;
    });
  } catch (error) {
    console.log('❌ Erreur answerCbQuery:', error.message);
    return Promise.resolve();
  }
}

// Fallbacks basiques pour les handlers
const fallbackHandlers = {
  handleStart: (ctx) => ctx.reply('🌿 Bienvenue chez CaliParis! 🌿\n\nUtilisez les boutons pour naviguer.'),
  showProducts: (ctx) => ctx.reply('📦 Catalogue - Choisissez vos produits'),
  showCatalogueGrouped: (ctx) => ctx.reply('🌿 Catalogue variétés'),
  showProductVariants: (ctx) => ctx.reply('🌿 Variétés disponibles'),
  showCart: (ctx) => ctx.reply('🛒 Votre panier est vide'),
  handleCheckout: (ctx) => ctx.reply('💰 Passer commande'),
  handleAdminCommands: (ctx) => ctx.reply('👨‍💼 Panel administrateur')
};

// Chargement sécurisé des handlers
console.log('📥 Chargement des handlers...');
const startHandler = loadModule('./handlers/startHandler', { handleStart: fallbackHandlers.handleStart });
const productHandler = loadModule('./handlers/productHandler', { 
  showProducts: fallbackHandlers.showProducts,
  showCatalogueGrouped: fallbackHandlers.showCatalogueGrouped,
  showProductVariants: fallbackHandlers.showProductVariants,
  showProductVideo: (ctx) => ctx.answerCbQuery('🎬 Vidéo non disponible'),
  showProductDetails: (ctx) => ctx.answerCbQuery('📊 Détails non disponibles'),
  hasMinimumPurchase: (product) => false,
  getMinimumQuantity: (product) => 1
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
  handleOrderAction: (ctx) => ctx.answerCbQuery('✅ Action effectuée'),
  showProductManagement: (ctx) => ctx.reply('🛍️ Gestion produits'),
  showSalesToday: (ctx) => ctx.reply('📈 Ventes aujourd\'hui'),
  showActiveProducts: (ctx) => ctx.reply('✅ Produits actifs'),
  showOrderStatuses: (ctx) => ctx.reply('🔍 Statuts commandes'),
  // === AJOUT DES FALLBACKS POUR LES NOUVELLES FONCTIONS ===
  disableProduct: (ctx) => ctx.reply('🚫 Désactiver produit'),
  enableProduct: (ctx) => ctx.reply('✅ Activer produit'),
  deleteProduct: (ctx) => ctx.reply('🗑️ Supprimer produit'),
  handleProductIdInput: (ctx) => ctx.reply('🔢 Traitement ID produit'),
  cancelProductAction: (ctx) => ctx.reply('✅ Action annulée'),
  // === AJOUT DES FALLBACKS POUR L'AJOUT DE PRODUIT ===
  addProduct: (ctx) => ctx.reply('🆕 Ajouter un produit'),
  handleProductCreation: (ctx) => ctx.reply('📝 Création produit'),
  handleProductPhoto: (ctx) => ctx.reply('🖼️ Gestion photo'),
  handleProductVideo: (ctx) => ctx.reply('🎬 Gestion vidéo'),
  handleProductCategory: (ctx) => ctx.reply('🎯 Gestion catégorie'),
  handleProductQuality: (ctx) => ctx.reply('⭐ Gestion qualité')
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

// ✅ CORRECTION AJOUTÉE : Middleware pour initialiser la session
bot.use((ctx, next) => {
  if (!ctx.session) {
    ctx.session = {};
  }
  return next();
});

bot.use(authMiddleware.logUserAction);
bot.use(authMiddleware.rateLimit());
bot.use(cartMiddleware.updateCartTimestamp);

// Commandes de base
bot.start(startHandler.handleStart);

// Handlers de messages
bot.hears('📦 Voir le catalogue', productHandler.showProducts);
bot.hears('🌿 Catalogue variétés', productHandler.showCatalogueGrouped); // NOUVELLE COMMANDE
bot.hears('🛒 Mon panier', cartHandler.showCart);
bot.hears('🎬 Vidéo présentation', (ctx) => {
  ctx.reply('🎬 Vidéo de présentation bientôt disponible!\nDécouvrez notre qualité premium 🌿');
});
bot.hears('📞 Contact', (ctx) => {
  ctx.reply(
    '📞 *Contact CaliParis*\n\n' +
    'Pour toute question:\n' +
    '• @Caliparisofficial\n' +
    '• Réponse sous 4h\n\n' +
    '🚚 Livraison discrète Paris et banlieue',
    { parse_mode: 'Markdown' }
  );
});
bot.hears('ℹ️ Informations', (ctx) => {
  ctx.reply(
    'ℹ️ *Informations CaliParis*\n\n' +
    '🌟 Qualité Premium\n' +
    '📦 Livraison 2h-4h\n' +
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

// === AJOUT: Handler pour les inputs de produits (suppression, activation, etc.) ===
bot.on('text', async (ctx, next) => {
  // Gestion des quantités personnalisées
  if (ctx.session && ctx.session.waitingForCustomQuantity) {
    await cartHandler.handleCustomQuantityResponse(ctx);
    return;
  }
  
  // === AJOUT: Gestion des IDs de produits pour admin ===
  if (ctx.session && ctx.session.waitingForProductId) {
    await adminHandler.handleProductIdInput(ctx);
    return;
  }
  
  // === AJOUT: Gestion de la création de produit ===
  if (ctx.session && ctx.session.creatingProduct) {
    await adminHandler.handleProductCreation(ctx);
    return;
  }
  
  return next();
});

// === AJOUT: Handlers pour les médias ===
bot.on('photo', async (ctx) => {
  if (ctx.session && ctx.session.creatingProduct && ctx.session.creationStep === 'photo') {
    await adminHandler.handleProductPhoto(ctx);
  }
});

bot.on('video', async (ctx) => {
  if (ctx.session && ctx.session.creatingProduct && ctx.session.creationStep === 'video') {
    await adminHandler.handleProductVideo(ctx);
  }
});

// Gestion de la commande /skip
bot.hears('/skip', async (ctx) => {
  if (ctx.session && ctx.session.creatingProduct) {
    if (ctx.session.creationStep === 'photo') {
      await adminHandler.handleProductPhoto(ctx);
    } else if (ctx.session.creationStep === 'video') {
      await adminHandler.handleProductVideo(ctx);
    }
  }
});

// Commandes admin
bot.hears('/admin', authMiddleware.isAdmin, adminHandler.handleAdminCommands);

// === AJOUT: Commande d'annulation pour admin ===
bot.hears('/cancel', authMiddleware.isAdmin, adminHandler.cancelProductAction);

// Callbacks pour produits
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
  const quantity = parseInt(ctx.match[1]);
  const productId = parseInt(ctx.match[2]);
  await safeAnswerCbQuery(ctx, '✅ Produit ajouté');
  await cartHandler.handleAddToCart(ctx, productId, quantity);
});

bot.action(/custom_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await safeAnswerCbQuery(ctx, '🔢 Quantité personnalisée');
  await cartHandler.handleCustomQuantity(ctx, productId);
});

bot.action(/cancel_custom_(\d+)/, async (ctx) => {
  await safeAnswerCbQuery(ctx, '❌ Quantité annulée');
  if (ctx.session) delete ctx.session.waitingForCustomQuantity;
});

bot.action(/video_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await safeAnswerCbQuery(ctx, '🎬 Chargement vidéo...');
  await productHandler.showProductVideo(ctx, productId);
});

bot.action(/details_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await safeAnswerCbQuery(ctx, '📊 Chargement détails...');
  await productHandler.showProductDetails(ctx, productId);
});

// === NOUVEAUX CALLBACKS POUR LES VARIÉTÉS ===

// Gestion des variétés
bot.action(/^variants_(.+)$/, async (ctx) => {
  const baseProductNameEncoded = ctx.match[1];
  await safeAnswerCbQuery(ctx, '🌿 Chargement des variétés...');
  await productHandler.showProductVariants(ctx, baseProductNameEncoded);
});

// Bouton retour au catalogue groupé
bot.action('back_to_catalogue', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Retour au catalogue...');
  await productHandler.showCatalogueGrouped(ctx);
});

// === FIN DES NOUVEAUX CALLBACKS ===

// Callbacks pour panier
bot.action('view_cart', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Chargement panier...');
  await cartHandler.showCart(ctx);
});

bot.action('back_to_products', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Retour produits...');
  await productHandler.showProducts(ctx);
});

bot.action('back_to_cart', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Retour panier...');
  await cartHandler.showCart(ctx);
});

bot.action('clear_cart', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Vidage panier...');
  await cartHandler.clearCart(ctx);
});

// Callbacks pour commande
bot.action('checkout', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Préparation commande...');
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handleCheckout(ctx));
});

bot.action('pay_crypto', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Traitement crypto...');
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handlePaymentMethod(ctx, 'crypto'));
});

bot.action('pay_cash', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Traitement cash...');
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handlePaymentMethod(ctx, 'cash'));
});

bot.action('ask_discount', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Vérification remise...');
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.handleDiscountRequest(ctx));
});

bot.action('confirm_discount_request', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Confirmation remise...');
  await cartMiddleware.checkCartNotEmpty(ctx, () => orderHandler.confirmDiscountRequest(ctx));
});

// Callbacks admin
bot.action('admin_stats', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Chargement stats...');
  await adminHandler.showAdminStats(ctx);
});

bot.action('admin_pending_orders', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Chargement commandes...');
  await adminHandler.showPendingOrders(ctx);
});

bot.action('admin_products', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Chargement produits...');
  await adminHandler.showProductManagement(ctx);
});

bot.action('admin_sales_today', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Calcul ventes...');
  await adminHandler.showSalesToday(ctx);
});

bot.action('admin_active_products', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Chargement produits actifs...');
  await adminHandler.showActiveProducts(ctx);
});

bot.action('admin_show_statuses', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Chargement statuts...');
  await adminHandler.showOrderStatuses(ctx);
});

// === AJOUT: Callbacks pour la gestion des produits admin ===
bot.action('admin_disable_product', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Désactivation produit...');
  await adminHandler.disableProduct(ctx);
});

bot.action('admin_enable_product', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Activation produit...');
  await adminHandler.enableProduct(ctx);
});

bot.action('admin_delete_product', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Suppression produit...');
  await adminHandler.deleteProduct(ctx);
});

// === AJOUT: Callbacks pour l'ajout de produit ===
bot.action('admin_add_product', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Création produit...');
  await adminHandler.addProduct(ctx);
});

// Gestion des catégories pour nouveau produit
bot.action(/category_(.+)_new/, authMiddleware.isAdmin, async (ctx) => {
  const category = ctx.match[1];
  await safeAnswerCbQuery(ctx, '🎯 Catégorie sélectionnée');
  await adminHandler.handleProductCategory(ctx, category);
});

// Gestion de la qualité pour nouveau produit
bot.action(/quality_(.+)_new/, authMiddleware.isAdmin, async (ctx) => {
  const quality = ctx.match[1];
  await safeAnswerCbQuery(ctx, '⭐ Qualité sélectionnée');
  await adminHandler.handleProductQuality(ctx, quality);
});

bot.action('back_to_admin', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Retour admin...');
  await adminHandler.handleAdminCommands(ctx);
});

bot.action(/admin_process_(\d+)/, authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Traitement commande...');
  await adminHandler.handleOrderAction(ctx, parseInt(ctx.match[1]), 'process');
});

bot.action(/admin_contact_(\d+)/, authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Contact client...');
  await adminHandler.handleOrderAction(ctx, parseInt(ctx.match[1]), 'contact');
});

bot.action(/admin_cancel_(\d+)/, authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Annulation commande...');
  await adminHandler.handleOrderAction(ctx, parseInt(ctx.match[1]), 'cancel');
});

// Gestion des erreurs
bot.catch((err, ctx) => {
  console.error('❌ Erreur bot:', err);
  ctx.reply('❌ Une erreur est survenue. Veuillez réessayer.');
});

// Démarrage résilient du bot
async function startBot() {
  try {
    console.log('🤖 Lancement du bot...');
    
    if (sequelize) {
      // Essayer avec la base de données
      await sequelize.sync();
      console.log('✅ Base de données synchronisée');
    }
    
    // Démarrer le bot
    await bot.launch();
    console.log('🎉 Bot CaliParis démarré avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
    
    // Dernière tentative sans DB
    try {
      await bot.launch();
      console.log('🎉 Bot démarré en mode de secours!');
    } catch (finalError) {
      console.error('💥 Échec critique:', finalError);
    }
  }
}

// Démarrer le bot après un court délai
setTimeout(startBot, 1000);

// Gestion propre de l'arrêt
process.once('SIGINT', () => {
  console.log('🛑 Arrêt du bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 Arrêt du bot...');
  bot.stop('SIGTERM');
});

// Méthode nécessaire pour le webhook
bot.secretPathComponent = () => 'c5bbd267c75e26ee56bbb7d0744acfcc8b20f7bc305ddd6556e36b22f63be7c9';

module.exports = bot;
