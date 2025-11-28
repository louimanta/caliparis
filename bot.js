require('dotenv').config();
const { Telegraf, session } = require('telegraf');

// Import des handlers
const { handleStart } = require('./handlers/startHandler');
const { showProducts, showProductVideo, showProductDetails } = require('./handlers/productHandler');
const { handleAddToCart, handleCustomQuantity, handleCustomQuantityResponse, showCart, clearCart } = require('./handlers/cartHandler');
const { handleCheckout, handlePaymentMethod, handleDiscountRequest, confirmDiscountRequest } = require('./handlers/orderHandler');
const { handleAdminCommands, showAdminStats, showPendingOrders, handleOrderAction } = require('./handlers/adminHandler');

// Import des middlewares
const { isAdmin, isUser, logUserAction, rateLimit } = require('./middlewares/authMiddleware');
const { checkCartNotEmpty, validateQuantity, updateCartTimestamp } = require('./middlewares/cartMiddleware');

// Import des services
const notificationService = require('./services/notificationService');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middlewares globaux
bot.use(session());
bot.use(logUserAction);
bot.use(rateLimit());
bot.use(updateCartTimestamp);

// Commandes de base
bot.start(handleStart);

// Handlers de messages
bot.hears('📦 Voir le catalogue', showProducts);
bot.hears('🛒 Mon panier', showCart);
bot.hears('🎬 Vidéo présentation', (ctx) => {
  ctx.reply('🎬 Vidéo de présentation bientôt disponible!\n\nDécouvrez notre qualité premium 🌿');
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
    await handleCustomQuantityResponse(ctx);
    return;
  }
  return next();
});

// Commandes admin
bot.hears('/admin', isAdmin, handleAdminCommands);

// Callbacks pour produits
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
  const quantity = parseInt(ctx.match[1]);
  const productId = parseInt(ctx.match[2]);
  await handleAddToCart(ctx, productId, quantity);
});

bot.action(/custom_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await handleCustomQuantity(ctx, productId);
});

bot.action(/cancel_custom_(\d+)/, async (ctx) => {
  if (ctx.session) delete ctx.session.waitingForCustomQuantity;
  await ctx.answerCbQuery('❌ Quantité annulée');
});

bot.action(/video_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await showProductVideo(ctx, productId);
});

bot.action(/details_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await showProductDetails(ctx, productId);
});

// Callbacks pour panier
bot.action('view_cart', showCart);
bot.action('back_to_products', async (ctx) => {
  await showProducts(ctx);
});
bot.action('back_to_cart', showCart);
bot.action('clear_cart', async (ctx) => {
  await clearCart(ctx);
  await ctx.answerCbQuery('✅ Panier vidé');
});

// Callbacks pour commande
bot.action('checkout', async (ctx) => {
  await checkCartNotEmpty(ctx, () => handleCheckout(ctx));
});
bot.action('pay_crypto', async (ctx) => {
  await checkCartNotEmpty(ctx, () => handlePaymentMethod(ctx, 'crypto'));
});
bot.action('pay_cash', async (ctx) => {
  await checkCartNotEmpty(ctx, () => handlePaymentMethod(ctx, 'cash'));
});
bot.action('ask_discount', async (ctx) => {
  await checkCartNotEmpty(ctx, () => handleDiscountRequest(ctx));
});
bot.action('confirm_discount_request', async (ctx) => {
  await checkCartNotEmpty(ctx, () => confirmDiscountRequest(ctx));
});

// Callbacks admin
bot.action('admin_stats', isAdmin, showAdminStats);
bot.action('admin_pending_orders', isAdmin, showPendingOrders);
bot.action(/admin_process_(\d+)/, isAdmin, (ctx) => 
  handleOrderAction(ctx, parseInt(ctx.match[1]), 'process'));
bot.action(/admin_contact_(\d+)/, isAdmin, (ctx) => 
  handleOrderAction(ctx, parseInt(ctx.match[1]), 'contact'));

// Gestion des erreurs
bot.catch((err, ctx) => {
  console.error('❌ Erreur bot:', err);
  ctx.reply('❌ Une erreur est survenue. Veuillez réessayer.');
});

// Démarrage sécurisé
async function startBot() {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('🤖 Bot prêt en mode webhook');
    } else {
      await bot.launch();
      console.log('🤖 Bot démarré en mode polling');
    }
  } catch (error) {
    console.error('❌ Erreur démarrage bot:', error.message);
  }
}

// Démarrer le bot après un court délai
setTimeout(startBot, 2000);

module.exports = bot;
