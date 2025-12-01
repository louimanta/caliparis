require('dotenv').config();
const { Telegraf, session } = require('telegraf');

console.log('🚀 Démarrage du bot CaliParis...');

// === CORRECTION 1 : Fonction loadModule corrigée ===
function loadModule(modulePath, fallback = null) {
  try {
    console.log(`🔍 Chargement: ${modulePath}`);
    const module = require(modulePath);
    console.log(`✅ ${modulePath} chargé avec succès`);
    return module;
  } catch (error) {
    console.log(`❌ Impossible de charger ${modulePath}:`, error.message);
    
    // Essayer un chemin alternatif
    const altPath = modulePath.replace('./', '../'); // Déclaré ICI pour être accessible partout
    
    try {
      console.log(`🔍 Essai chemin alternatif: ${altPath}`);
      const module = require(altPath);
      console.log(`✅ ${altPath} chargé avec succès`);
      return module;
    } catch (error2) {
      // Maintenant altPath est accessible
      console.log(`❌ Chemin alternatif échoué: ${altPath}`);
      
      if (fallback) {
        console.log(`⚠️  Utilisation du fallback pour ${modulePath}`);
        return fallback;
      }
      return {};
    }
  }
}

// === FONCTION POUR GÉRER LES CALLBACKS EXPIRÉS ===
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
  showVariantsMenu: (ctx) => ctx.answerCbQuery('🌿 Menu variétés'),
  handleVariantSelection: (ctx) => ctx.answerCbQuery('✅ Variété sélectionnée'),
  showCart: (ctx) => ctx.reply('🛒 Votre panier est vide'),
  handleCheckout: (ctx) => ctx.reply('💰 Passer commande'),
  handleAdminCommands: (ctx) => ctx.reply('👨‍💼 Panel administrateur')
};

// Chargement sécurisé des handlers
console.log('📥 Chargement des handlers...');
const startHandler = loadModule('./handlers/startHandler', { handleStart: fallbackHandlers.handleStart });

// Chargement avec les nouvelles fonctions de variétés
const productHandler = loadModule('./handlers/productHandler', { 
  showProducts: fallbackHandlers.showProducts,
  showVariantsMenu: fallbackHandlers.showVariantsMenu,
  handleVariantSelection: fallbackHandlers.handleVariantSelection,
  showProductVideo: (ctx) => ctx.answerCbQuery('🎬 Vidéo non disponible'),
  showProductDetails: (ctx) => ctx.answerCbQuery('📊 Détails non disponibles'),
  hasMinimumPurchase: (product) => false,
  getMinimumQuantity: (product) => 1,
  handleCustomVariantQuantity: (ctx) => ctx.answerCbQuery('🔢 Quantité variété')
});

const cartHandler = loadModule('./handlers/cartHandler', {
  handleAddToCart: (ctx) => ctx.answerCbQuery('✅ Produit ajouté'),
  handleAddVariantToCart: (ctx) => ctx.answerCbQuery('✅ Variété ajoutée'), // AJOUTÉ
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
  disableProduct: (ctx) => ctx.reply('🚫 Désactiver produit'),
  enableProduct: (ctx) => ctx.reply('✅ Activer produit'),
  deleteProduct: (ctx) => ctx.reply('🗑️ Supprimer produit'),
  handleProductIdInput: (ctx) => ctx.reply('🔢 Traitement ID produit'),
  cancelProductAction: (ctx) => ctx.reply('✅ Action annulée'),
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

// === CORRECTION 2 : Session persistante ===
const sessions = {}; // Stockage en mémoire

bot.use(session({
  ttl: 7 * 24 * 60 * 60, // 7 jours
  store: {
    get: (key) => {
      console.log(`📥 Chargement session: ${key}`);
      return Promise.resolve(sessions[key] || {});
    },
    set: (key, session) => {
      console.log(`💾 Sauvegarde session: ${key}`);
      sessions[key] = session;
      return Promise.resolve();
    },
    delete: (key) => {
      console.log(`🗑️ Suppression session: ${key}`);
      delete sessions[key];
      return Promise.resolve();
    }
  }
}));

// Middleware pour initialiser la session et le panier
bot.use((ctx, next) => {
  if (!ctx.session) {
    ctx.session = {};
  }
  
  // Initialiser le panier dans la session si nécessaire
  if (!ctx.session.cartSession) {
    ctx.session.cartSession = {
      waitingForCustomQuantity: false,
      productIdForCustomQuantity: null,
      waitingForVariantSelection: false,
      variantProductId: null,
      variantQuantity: null,
      timestamp: null
    };
  }
  
  return next();
});

bot.use(authMiddleware.logUserAction);
bot.use(authMiddleware.rateLimit());
bot.use(cartMiddleware.updateCartTimestamp);

// Commandes de base
bot.start(startHandler.handleStart);

// ==============================================
// HANDLERS DE MESSAGES
// ==============================================

bot.hears('📦 Voir le catalogue', productHandler.showProducts);
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

// ==============================================
// HANDLERS POUR LES INPUTS TEXTE
// ==============================================

bot.on('text', async (ctx, next) => {
  // Gestion des quantités personnalisées
  if (ctx.session && ctx.session.cartSession && ctx.session.cartSession.waitingForCustomQuantity) {
    await cartHandler.handleCustomQuantityResponse(ctx);
    return;
  }
  
  // Gestion de la sélection de variété avec quantité personnalisée
  if (ctx.session && ctx.session.cartSession && ctx.session.cartSession.waitingForVariantSelection) {
    const quantity = parseFloat(ctx.message.text);
    const productId = ctx.session.cartSession.variantProductId;
    
    if (!isNaN(quantity) && quantity > 0) {
      // Stocker la quantité et demander la variété
      ctx.session.cartSession.variantQuantity = quantity;
      await productHandler.handleCustomVariantQuantity(ctx, productId, quantity);
    } else {
      await ctx.reply('❌ Veuillez entrer un nombre valide (ex: 5 pour 5 grammes)');
    }
    
    // Réinitialiser
    ctx.session.cartSession.waitingForVariantSelection = false;
    ctx.session.cartSession.variantProductId = null;
    return;
  }
  
  // Gestion des IDs de produits pour admin
  if (ctx.session && ctx.session.waitingForProductId) {
    await adminHandler.handleProductIdInput(ctx);
    return;
  }
  
  // Gestion de la création de produit
  if (ctx.session && ctx.session.creatingProduct) {
    await adminHandler.handleProductCreation(ctx);
    return;
  }
  
  return next();
});

// ==============================================
// HANDLERS POUR LES MÉDIAS
// ==============================================

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

// ==============================================
// COMMANDES ADMIN
// ==============================================

bot.hears('/admin', authMiddleware.isAdmin, adminHandler.handleAdminCommands);
bot.hears('/cancel', authMiddleware.isAdmin, adminHandler.cancelProductAction);

// ==============================================
// CALLBACKS POUR LES PRODUITS ET VARIÉTÉS
// ==============================================

// === PRODUITS SANS VARIÉTÉS (ancien système) ===
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
  const quantity = parseInt(ctx.match[1]);
  const productId = parseInt(ctx.match[2]);
  await safeAnswerCbQuery(ctx, '✅ Produit ajouté');
  await cartHandler.handleAddToCart(ctx, productId, quantity);
});

// === PRODUITS AVEC VARIÉTÉS (nouveau système) ===

// 1. Quand l'utilisateur clique sur "🌿 Choisir la variété"
bot.action(/^choose_variant_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await safeAnswerCbQuery(ctx, '🌿 Chargement des variétés...');
  await productHandler.showVariantsMenu(ctx, productId);
});

// 2. Quand l'utilisateur sélectionne une variété avec une quantité spécifique
bot.action(/^select_variant_(.+)_(\d+)$/, async (ctx) => {
  const variantId = ctx.match[1];
  const quantity = parseInt(ctx.match[2]);
  await safeAnswerCbQuery(ctx, '✅ Ajout au panier...');
  
  // Utiliser la nouvelle fonction du cartHandler
  if (cartHandler.handleAddVariantToCart) {
    await cartHandler.handleAddVariantToCart(ctx, variantId, quantity);
  } else {
    // Fallback vers l'ancienne méthode
    await productHandler.handleVariantSelection(ctx, variantId, quantity);
  }
});

// 3. Quand l'utilisateur choisit une quantité custom pour une variété
bot.action(/^custom_variant_(\d+)_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  const quantity = parseInt(ctx.match[2]);
  await safeAnswerCbQuery(ctx, '🔢 Chargement variétés...');
  await productHandler.handleCustomVariantQuantity(ctx, productId, quantity);
});

// ==============================================
// CALLBACKS EXISTANTS POUR PRODUITS
// ==============================================

bot.action(/custom_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await safeAnswerCbQuery(ctx, '🔢 Quantité personnalisée');
  await cartHandler.handleCustomQuantity(ctx, productId);
});

bot.action(/cancel_custom_(\d+)/, async (ctx) => {
  await safeAnswerCbQuery(ctx, '❌ Quantité annulée');
  if (ctx.session && ctx.session.cartSession) {
    ctx.session.cartSession.waitingForCustomQuantity = false;
    ctx.session.cartSession.productIdForCustomQuantity = null;
    ctx.session.cartSession.waitingForVariantSelection = false;
    ctx.session.cartSession.variantProductId = null;
    ctx.session.cartSession.variantQuantity = null;
  }
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

// ==============================================
// CALLBACKS POUR LE PANIER
// ==============================================

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

// ==============================================
// CALLBACKS POUR LES COMMANDES
// ==============================================

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

// ==============================================
// CALLBACKS ADMIN
// ==============================================

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

// Gestion des produits admin
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

// Ajout de produit
bot.action('admin_add_product', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Création produit...');
  await adminHandler.addProduct(ctx);
});

// Gestion des catégories
bot.action(/category_(.+)_new/, authMiddleware.isAdmin, async (ctx) => {
  const category = ctx.match[1];
  await safeAnswerCbQuery(ctx, '🎯 Catégorie sélectionnée');
  await adminHandler.handleProductCategory(ctx, category);
});

// Gestion de la qualité
bot.action(/quality_(.+)_new/, authMiddleware.isAdmin, async (ctx) => {
  const quality = ctx.match[1];
  await safeAnswerCbQuery(ctx, '⭐ Qualité sélectionnée');
  await adminHandler.handleProductQuality(ctx, quality);
});

bot.action('back_to_admin', authMiddleware.isAdmin, async (ctx) => {
  await safeAnswerCbQuery(ctx, '🔄 Retour admin...');
  await adminHandler.handleAdminCommands(ctx);
});

// Actions sur les commandes
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

// ==============================================
// GESTION DES ERREURS
// ==============================================

bot.catch((err, ctx) => {
  console.error('❌ Erreur bot:', err);
  ctx.reply('❌ Une erreur est survenue. Veuillez réessayer.');
});

// ==============================================
// DÉMARRAGE DU BOT
// ==============================================

async function startBot() {
  try {
    console.log('🤖 Lancement du bot...');
    
    if (sequelize) {
      await sequelize.sync();
      console.log('✅ Base de données synchronisée');
    }
    
    await bot.launch();
    console.log('🎉 Bot CaliParis démarré avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
    
    try {
      await bot.launch();
      console.log('🎉 Bot démarré en mode de secours!');
    } catch (finalError) {
      console.error('💥 Échec critique:', finalError);
    }
  }
}

setTimeout(startBot, 1000);

// ==============================================
// GESTION PROPRE DE L'ARRÊT
// ==============================================

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
