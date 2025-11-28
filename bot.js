require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { sequelize } = require('./models');

// Import des handlers
const { handleStart } = require('./handlers/startHandler');
const { showProducts, showProductVideo, showProductDetails } = require('./handlers/productHandler');
const { handleAddToCart, handleCustomQuantity, showCart, clearCart, handleQuantityMessage } = require('./handlers/cartHandler');
const { handleCheckout, handlePaymentMethod, handleDiscountRequest, confirmDiscountRequest } = require('./handlers/orderHandler');
const { handleAdminCommands, showAdminStats, showPendingOrders, handleOrderAction } = require('./handlers/adminHandler');

// Import des middlewares
const { isAdmin, isUser, logUserAction, rateLimit } = require('./middlewares/authMiddleware');
const { checkCartNotEmpty, validateQuantity, updateCartTimestamp } = require('./middlewares/cartMiddleware');

// Import des services
const cartService = require('./services/cartService');
const notificationService = require('./services/notificationService');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Vérification du token bot
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN manquant dans les variables d\'environnement');
  process.exit(1);
}

// ✅ INITIALISATION DU SERVICE DE NOTIFICATION
notificationService.setBot(bot); // Passer l'instance du bot principal

// STORE DE SESSIONS PERSISTANT
const sessionStore = {
  sessions: new Map(),
  
  get(key) {
    const session = this.sessions.get(key);
    return Promise.resolve(session || { cart: [] });
  },
  
  set(key, session) {
    this.sessions.set(key, session);
    return Promise.resolve();
  },
  
  delete(key) {
    this.sessions.delete(key);
    return Promise.resolve();
  }
};

// Middlewares globaux AVEC SESSION STORE
bot.use(session({ 
  store: sessionStore,
  defaultSession: () => ({ cart: [] })
}));
bot.use(logUserAction);
bot.use(rateLimit());
bot.use(updateCartTimestamp);

// Commandes de base
bot.start(handleStart);

// Commande /cancel pour annuler les opérations en cours
bot.hears('/cancel', async (ctx) => {
  try {
    if (ctx.session.awaitingCustomQuantity) {
      delete ctx.session.awaitingCustomQuantity;
      ctx.session = { ...ctx.session };
      await ctx.reply('❌ Saisie de quantité annulée');
    } else {
      await ctx.reply('❌ Aucune opération en cours à annuler');
    }
  } catch (error) {
    console.error('Erreur commande /cancel:', error);
    await ctx.reply('❌ Erreur lors de l\'annulation');
  }
});

// Handlers de messages
bot.hears('📦 Voir le catalogue', async (ctx) => {
  await showProducts(ctx);
});

bot.hears('🛒 Mon panier', async (ctx) => {
  await showCart(ctx);
});

bot.hears('🎬 Vidéo présentation', async (ctx) => {
  try {
    await ctx.reply('🎬 Vidéo de présentation bientôt disponible!');
  } catch (error) {
    console.error('Erreur envoi vidéo:', error);
    await ctx.reply('❌ Impossible de charger la vidéo de présentation.');
  }
});

bot.hears('📞 Contact', async (ctx) => {
  await ctx.reply(
    '📞 *Contact CaliParis*\n\n' +
    'Pour toute question ou assistance:\n' +
    '• Via ce bot\n' +
    '• Réponse sous 24h\n\n' +
    '🚚 Livraison discrète dans Paris et banlieue',
    { parse_mode: 'Markdown' }
  );
});

bot.hears('ℹ️ Informations', async (ctx) => {
  await ctx.reply(
    'ℹ️ *Informations CaliParis*\n\n' +
    '🌟 *Qualité Premium*\n' +
    '📦 Livraison 24h-48h\n' +
    '🔒 Emballage discret\n' +
    '💳 Paiement sécurisé\n\n' +
    'Réservé aux adultes. Consommez avec modération.',
    { parse_mode: 'Markdown' }
  );
});

bot.hears('💎 Commandes en gros', async (ctx) => {
  await ctx.reply(
    '💎 *Commandes en Gros*\n\n' +
    'Pour les commandes de 30g et plus:\n' +
    '• Remises spéciales\n' +
    '• Service personnalisé\n' +
    '• Livraison prioritaire\n\n' +
    'Ajoutez 30g+ dans votre panier pour voir les remises!',
    { parse_mode: 'Markdown' }
  );
});

// Commandes admin
bot.hears('/admin', isAdmin, handleAdminCommands);
bot.hears('/stats', isAdmin, showAdminStats);
bot.hears('/orders', isAdmin, showPendingOrders);

// Callbacks pour produits
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
  try {
    const quantity = parseInt(ctx.match[1]);
    const productId = parseInt(ctx.match[2]);
    await handleAddToCart(ctx, productId, quantity);
    await ctx.answerCbQuery(`✅ ${quantity}g ajouté au panier!`);
  } catch (error) {
    console.error('❌ Erreur ajout panier:', error);
    await ctx.answerCbQuery('❌ Erreur lors de l\'ajout au panier');
  }
});

bot.action(/custom_(\d+)/, async (ctx) => {
  try {
    const productId = parseInt(ctx.match[1]);
    await handleCustomQuantity(ctx, productId);
  } catch (error) {
    console.error('Erreur quantité personnalisée:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la saisie de quantité');
  }
});

bot.action(/cancel_custom_(\d+)/, async (ctx) => {
  try {
    if (ctx.session.awaitingCustomQuantity) {
      delete ctx.session.awaitingCustomQuantity;
      ctx.session = { ...ctx.session };
    }
    
    await ctx.deleteMessage();
    await ctx.answerCbQuery('❌ Quantité personnalisée annulée');
  } catch (error) {
    console.error('Erreur annulation quantité:', error);
  }
});

bot.action(/video_(\d+)/, async (ctx) => {
  try {
    const productId = parseInt(ctx.match[1]);
    await showProductVideo(ctx, productId);
  } catch (error) {
    console.error('Erreur affichage vidéo:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement de la vidéo');
  }
});

bot.action(/details_(\d+)/, async (ctx) => {
  try {
    const productId = parseInt(ctx.match[1]);
    await showProductDetails(ctx, productId);
  } catch (error) {
    console.error('Erreur affichage détails:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement des détails');
  }
});

// Callbacks pour panier
bot.action('view_cart', async (ctx) => {
  await showCart(ctx);
});

bot.action('back_to_products', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await showProducts(ctx);
  } catch (error) {
    console.error('Erreur retour produits:', error);
    await ctx.reply('❌ Impossible de charger les produits');
  }
});

bot.action('back_to_cart', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await showCart(ctx);
  } catch (error) {
    console.error('Erreur retour panier:', error);
    await ctx.reply('❌ Impossible de charger le panier');
  }
});

bot.action('back_to_menu', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await handleStart(ctx);
  } catch (error) {
    console.error('Erreur retour menu:', error);
    await ctx.reply('❌ Impossible de charger le menu');
  }
});

bot.action('clear_cart', async (ctx) => {
  try {
    await clearCart(ctx);
    await ctx.answerCbQuery('✅ Panier vidé');
  } catch (error) {
    console.error('Erreur vidage panier:', error);
    await ctx.answerCbQuery('❌ Erreur lors du vidage du panier');
  }
});

// Callbacks pour commande
bot.action('checkout', checkCartNotEmpty, async (ctx) => {
  try {
    await handleCheckout(ctx);
  } catch (error) {
    console.error('Erreur checkout:', error);
    await ctx.answerCbQuery('❌ Erreur lors du checkout');
  }
});

bot.action('pay_crypto', checkCartNotEmpty, async (ctx) => {
  try {
    await handlePaymentMethod(ctx, 'crypto');
  } catch (error) {
    console.error('Erreur paiement crypto:', error);
    await ctx.answerCbQuery('❌ Erreur lors du paiement crypto');
  }
});

bot.action('pay_cash', checkCartNotEmpty, async (ctx) => {
  try {
    await handlePaymentMethod(ctx, 'cash');
  } catch (error) {
    console.error('Erreur paiement cash:', error);
    await ctx.answerCbQuery('❌ Erreur lors du paiement cash');
  }
});

bot.action('ask_discount', checkCartNotEmpty, async (ctx) => {
  try {
    await handleDiscountRequest(ctx);
  } catch (error) {
    console.error('Erreur demande remise:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la demande de remise');
  }
});

bot.action('confirm_discount_request', checkCartNotEmpty, async (ctx) => {
  try {
    await confirmDiscountRequest(ctx);
  } catch (error) {
    console.error('Erreur confirmation remise:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la confirmation');
  }
});

// Callbacks admin
bot.action('admin_stats', isAdmin, async (ctx) => {
  try {
    await showAdminStats(ctx);
  } catch (error) {
    console.error('Erreur stats admin:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement des stats');
  }
});

bot.action('admin_pending_orders', isAdmin, async (ctx) => {
  try {
    await showPendingOrders(ctx);
  } catch (error) {
    console.error('Erreur commandes admin:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement des commandes');
  }
});

bot.action(/admin_process_(\d+)/, isAdmin, async (ctx) => {
  try {
    await handleOrderAction(ctx, parseInt(ctx.match[1]), 'process');
  } catch (error) {
    console.error('Erreur traitement commande:', error);
    await ctx.answerCbQuery('❌ Erreur lors du traitement');
  }
});

bot.action(/admin_contact_(\d+)/, isAdmin, async (ctx) => {
  try {
    await handleOrderAction(ctx, parseInt(ctx.match[1]), 'contact');
  } catch (error) {
    console.error('Erreur contact commande:', error);
    await ctx.answerCbQuery('❌ Erreur lors du contact');
  }
});

bot.action(/admin_cancel_(\d+)/, isAdmin, async (ctx) => {
  try {
    await handleOrderAction(ctx, parseInt(ctx.match[1]), 'cancel');
  } catch (error) {
    console.error('Erreur annulation commande:', error);
    await ctx.answerCbQuery('❌ Erreur lors de l\'annulation');
  }
});

// Gestion des messages de quantité personnalisée
bot.on('text', async (ctx) => {
  const handled = await handleQuantityMessage(ctx);
  if (!handled) {
    await ctx.reply(
      '🤖 *Bot CaliParis*\n\n' +
      'Utilisez les boutons du menu pour naviguer:\n' +
      '• 📦 Voir le catalogue\n' +
      '• 🛒 Mon panier\n' +
      '• ℹ️ Informations\n' +
      '• 📞 Contact\n\n' +
      '💡 *Astuce:* Utilisez /cancel pour annuler une opération en cours',
      { parse_mode: 'Markdown' }
    );
  }
});

// Gestion des erreurs globale
bot.catch(async (err, ctx) => {
  console.error('❌ Erreur bot:', err);
  try {
    await ctx.reply('❌ Une erreur est survenue. Veuillez réessayer.');
  } catch (replyError) {
    console.error('Impossible d\'envoyer le message d\'erreur:', replyError);
  }
});

// Nettoyage des paniers anciens
setInterval(async () => {
  try {
    await cartService.cleanupOldCarts();
    console.log('🧹 Nettoyage des paniers anciens effectué');
  } catch (error) {
    console.error('❌ Erreur nettoyage paniers:', error);
  }
}, 60 * 60 * 1000);

// Démarrage du bot (pour le mode développement)
async function startBot() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion BD réussie');
    
    await sequelize.sync();
    console.log('✅ Base de données synchronisée');
    
    // Charger les produits initiaux si nécessaire
    const { Product } = require('./models');
    const productCount = await Product.count();
    if (productCount === 0) {
      console.log('📦 Aucun produit trouvé, chargement des échantillons...');
      require('./scripts/initializeProducts')();
    }
    
    // Mode développement - Polling
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 Mode: Développement (Polling)');
      await bot.launch();
      console.log('🤖 Bot CaliParis démarré en mode polling!');
    } else {
      console.log('🌐 Mode: Production (Webhook) - Prêt');
    }
    
  } catch (error) {
    console.error('❌ Erreur démarrage bot:', error);
    process.exit(1);
  }
}

// Export pour utilisation dans server.js
module.exports = { bot, startBot };
