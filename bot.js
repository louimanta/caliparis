require('dotenv').config();
const { Telegraf, session } = require('telegraf');

// Import des handlers avec gestion d'erreur
let handlers;
try {
  handlers = {
    startHandler: require('./handlers/startHandler'),
    productHandler: require('./handlers/productHandler'),
    cartHandler: require('./handlers/cartHandler'),
    orderHandler: require('./handlers/orderHandler'),
    adminHandler: require('./handlers/adminHandler')
  };
} catch (error) {
  console.error('❌ Erreur chargement handlers:', error.message);
  // Fallback basique
  handlers = {
    startHandler: { handleStart: (ctx) => ctx.reply('🌿 Bienvenue chez CaliParis!') },
    productHandler: { showProducts: (ctx) => ctx.reply('📦 Catalogue temporairement indisponible') },
    cartHandler: { showCart: (ctx) => ctx.reply('🛒 Panier temporairement indisponible') },
    orderHandler: { handleCheckout: (ctx) => ctx.reply('💰 Commande temporairement indisponible') },
    adminHandler: { handleAdminCommands: (ctx) => ctx.reply('👨‍💼 Admin panel indisponible') }
  };
}

// Import des middlewares avec gestion d'erreur
let middlewares;
try {
  middlewares = {
    auth: require('./middlewares/authMiddleware'),
    cart: require('./middlewares/cartMiddleware')
  };
} catch (error) {
  console.error('❌ Erreur chargement middlewares:', error.message);
  // Middlewares basiques de secours
  middlewares = {
    auth: {
      isAdmin: (ctx, next) => next(),
      isUser: (ctx, next) => next(),
      logUserAction: (ctx, next) => next(),
      rateLimit: () => (ctx, next) => next()
    },
    cart: {
      checkCartNotEmpty: (ctx, next) => next(),
      validateQuantity: (ctx, next) => next(),
      updateCartTimestamp: (ctx, next) => next()
    }
  };
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middlewares globaux
bot.use(session());
bot.use(middlewares.auth.logUserAction);
bot.use(middlewares.auth.rateLimit());
bot.use(middlewares.cart.updateCartTimestamp);

// Commandes de base
bot.start(handlers.startHandler.handleStart);

// Handlers de messages
bot.hears('📦 Voir le catalogue', handlers.productHandler.showProducts);
bot.hears('🛒 Mon panier', handlers.cartHandler.showCart);
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
    await handlers.cartHandler.handleCustomQuantityResponse(ctx);
    return;
  }
  return next();
});

// Commandes admin
bot.hears('/admin', middlewares.auth.isAdmin, handlers.adminHandler.handleAdminCommands);

// Callbacks pour produits
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
  const quantity = parseInt(ctx.match[1]);
  const productId = parseInt(ctx.match[2]);
  await handlers.cartHandler.handleAddToCart(ctx, productId, quantity);
});

bot.action(/custom_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await handlers.cartHandler.handleCustomQuantity(ctx, productId);
});

bot.action(/cancel_custom_(\d+)/, async (ctx) => {
  if (ctx.session) delete ctx.session.waitingForCustomQuantity;
  await ctx.answerCbQuery('❌ Quantité annulée');
});

bot.action(/video_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await handlers.productHandler.showProductVideo(ctx, productId);
});

bot.action(/details_(\d+)/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await handlers.productHandler.showProductDetails(ctx, productId);
});

// Callbacks pour panier
bot.action('view_cart', handlers.cartHandler.showCart);
bot.action('back_to_products', async (ctx) => {
  await handlers.productHandler.showProducts(ctx);
});
bot.action('back_to_cart', handlers.cartHandler.showCart);
bot.action('clear_cart', async (ctx) => {
  await handlers.cartHandler.clearCart(ctx);
  await ctx.answerCbQuery('✅ Panier vidé');
});

// Callbacks pour commande
bot.action('checkout', async (ctx) => {
  await middlewares.cart.checkCartNotEmpty(ctx, () => handlers.orderHandler.handleCheckout(ctx));
});
bot.action('pay_crypto', async (ctx) => {
  await middlewares.cart.checkCartNotEmpty(ctx, () => handlers.orderHandler.handlePaymentMethod(ctx, 'crypto'));
});
bot.action('pay_cash', async (ctx) => {
  await middlewares.cart.checkCartNotEmpty(ctx, () => handlers.orderHandler.handlePaymentMethod(ctx, 'cash'));
});
bot.action('ask_discount', async (ctx) => {
  await middlewares.cart.checkCartNotEmpty(ctx, () => handlers.orderHandler.handleDiscountRequest(ctx));
});

// Callbacks admin
bot.action('admin_stats', middlewares.auth.isAdmin, handlers.adminHandler.showAdminStats);
bot.action('admin_pending_orders', middlewares.auth.isAdmin, handlers.adminHandler.showPendingOrders);
bot.action(/admin_process_(\d+)/, middlewares.auth.isAdmin, (ctx) => 
  handlers.adminHandler.handleOrderAction(ctx, parseInt(ctx.match[1]), 'process'));
bot.action(/admin_contact_(\d+)/, middlewares.auth.isAdmin, (ctx) => 
  handlers.adminHandler.handleOrderAction(ctx, parseInt(ctx.match[1]), 'contact'));

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
