const { Telegraf } = require('telegraf');
const initializeProducts = require('./scripts/initializeProducts');
const { sequelize } = require('./models');

// 1. D'ABORD définir le bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// 2. ENSUITE les commandes et handlers
bot.start((ctx) => {
  ctx.reply('Bienvenue sur CaliParis! 🍃\n\nUtilisez /menu pour voir nos produits');
});

bot.command('menu', async (ctx) => {
  try {
    // Votre logique pour afficher le menu des produits
    ctx.reply('🎯 Notre menu:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🍫 Edibles', callback_data: 'category_edibles' }],
          [{ text: '💎 Résine', callback_data: 'category_resine' }],
          [{ text: '🌿 Fleurs', callback_data: 'category_fleurs' }],
          [{ text: '🍯 Huiles', callback_data: 'category_huiles' }]
        ]
      }
    });
  } catch (error) {
    console.error('Erreur menu:', error);
    ctx.reply('❌ Erreur lors du chargement du menu');
  }
});

bot.command('produits', async (ctx) => {
  try {
    // Votre logique pour lister les produits
    ctx.reply('📦 Liste des produits disponibles...');
  } catch (error) {
    console.error('Erreur produits:', error);
    ctx.reply('❌ Erreur lors du chargement des produits');
  }
});

bot.command('help', (ctx) => {
  ctx.reply(`📋 Commandes disponibles:
/menu - Voir le menu des produits
/produits - Liste des produits
/help - Aide

💬 Contact: [votre contact]`);
});

// Gestion des callback queries (boutons inline)
bot.on('callback_query', async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery.data;
    
    if (callbackData.startsWith('category_')) {
      // Votre logique pour afficher les produits par catégorie
      const category = callbackData.replace('category_', '');
      ctx.reply(`Produits de la catégorie: ${category}`);
    }
    
    // Répondre au callback pour enlever l'état "loading"
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Erreur callback:', error);
    await ctx.answerCbQuery('❌ Erreur');
  }
});

// Gestion des messages texte
bot.on('text', async (ctx) => {
  try {
    const message = ctx.message.text;
    
    // Votre logique de traitement des messages
    if (message.toLowerCase().includes('prix')) {
      ctx.reply('💰 Consultez /menu pour voir nos prix');
    } else if (message.toLowerCase().includes('contact')) {
      ctx.reply('📞 Contactez-nous ici: [votre contact]');
    }
    // ... autres traitements
  } catch (error) {
    console.error('Erreur message:', error);
  }
});

// 3. PUIS le gestionnaire d'erreurs
bot.catch((err, ctx) => {
  console.error('❌ Erreur bot capturée:', err.message);
});

// 4. ENFIN les fonctions de maintenance
async function maintainBot() {
  try {
    console.log('🔄 Maintenance du bot...');
    await bot.telegram.getMe();
    console.log('✅ Bot actif');
  } catch (error) {
    console.log('❌ Bot inactif, redémarrage...');
    try {
      await bot.stop();
      await bot.launch();
      console.log('✅ Bot redémarré');
    } catch (restartError) {
      console.error('💥 Échec redémarrage:', restartError.message);
    }
  }
}

// Démarrage principal
async function startServer() {
  try {
    // Synchroniser la base de données
    await sequelize.sync();
    console.log('✅ Base de données synchronisée');
    
    // Initialiser les produits
    await initializeProducts();
    console.log('✅ Produits initialisés');
    
    // Démarrer le bot
    await bot.launch();
    console.log('🤖 Bot Telegram démarré');
    
    // Activer la maintenance après le démarrage
    console.log('🔧 Système de maintenance activé');
    setInterval(maintainBot, 10 * 60 * 1000);
    
  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
}

startServer();
