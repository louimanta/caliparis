const express = require('express');
const bot = require('./bot');
const { sequelize, syncDatabase } = require('./models');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let dbConnected = false;
let botStarted = false;

// Fonction d'initialisation de la base de données
async function initializeDatabase() {
  try {
    console.log('🔄 Initialisation de la base de données...');
    await syncDatabase();
    
    // Initialiser les produits
    const initializeProducts = require('./scripts/initializeProducts');
    await initializeProducts();
    
    console.log('✅ Base de données initialisée avec les produits');
    return true;
  } catch (error) {
    console.error('❌ Erreur initialisation base de données:', error);
    return false;
  }
}

// Route pour corriger les URLs d'images
app.get('/fix-urls', async (req, res) => {
  try {
    const { Product } = require('./models');
    const products = await Product.findAll();
    
    let fixed = 0;
    for (let product of products) {
      if (product.imageUrl && product.imageUrl.includes('.jpg.')) {
        const oldUrl = product.imageUrl;
        product.imageUrl = product.imageUrl.replace('.jpg.', '.jpg');
        await product.save();
        console.log(`✅ Corrigé: ${oldUrl} → ${product.imageUrl}`);
        fixed++;
      }
    }
    
    res.json({ fixed: fixed, message: 'URLs corrigées' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    let dbStatus = false;
    try {
      await sequelize.authenticate();
      dbStatus = true;
    } catch (error) {
      dbStatus = false;
    }
    
    res.status(200).json({ 
      status: 'OK', 
      bot: botStarted ? 'running' : 'starting',
      database: dbStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour forcer la reconnexion DB
app.post('/reconnect-db', async (req, res) => {
  try {
    console.log('🔄 Reconnexion manuelle à la base de données...');
    dbConnected = await syncDatabase();
    
    res.json({
      success: dbConnected,
      database: dbConnected ? 'connected' : 'disconnected',
      message: dbConnected ? 'Base de données reconnectée' : 'Échec de reconnexion'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route principale
app.get('/', (req, res) => {
  res.json({
    service: 'CaliParis Bot',
    status: 'running',
    database: dbConnected ? 'connected' : 'disconnected',
    message: dbConnected ? 'Service complet opérationnel' : 'Mode dégradé - Base de données hors ligne'
  });
});

// Webhook pour production
if (process.env.NODE_ENV === 'production') {
  const webhookPath = `/webhook/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(webhookPath));
  console.log(`🌐 Webhook configuré sur: ${webhookPath}`);
}

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Fonction de démarrage principale
async function startApplication() {
  console.log('🚀 Démarrage de CaliParis Bot...');
  console.log('🔍 Vérification des variables d\'environnement:');
  console.log('✅ BOT_TOKEN:', process.env.BOT_TOKEN ? 'Configuré' : '❌ Manquant');
  console.log('✅ DATABASE_URL:', process.env.DATABASE_URL ? 'Configuré' : '❌ Manquant');
  console.log('✅ ADMIN_CHAT_ID:', process.env.ADMIN_CHAT_ID ? 'Configuré' : 'Non configuré');
  console.log('✅ NODE_ENV:', process.env.NODE_ENV || 'development');

  if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN manquant - Arrêt du service');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL manquante - Mode dégradé forcé');
    dbConnected = false;
  } else {
    console.log('🔄 Connexion à la base de données PostgreSQL...');
    dbConnected = await initializeDatabase();
  }

  // Démarrer le serveur web
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: https://caliparis.onrender.com/health`);
    console.log(`🗄️  Base de données: ${dbConnected ? '✅ Connectée' : '❌ Déconnectée'}`);
    
    if (!dbConnected) {
      console.log('⚠️  MODE DÉGRADÉ: Le bot fonctionne sans base de données');
    }
  });

  // Démarrer le bot
  try {
    if (process.env.NODE_ENV === 'production') {
      botStarted = true;
      console.log('🤖 Bot prêt (mode webhook)');
    } else {
      await bot.launch();
      botStarted = true;
      console.log('🤖 Bot démarré (mode polling)');
    }
  } catch (error) {
    console.error('❌ Erreur démarrage bot:', error);
  }
}

// Gestion propre de l'arrêt
process.once('SIGINT', () => {
  console.log('🛑 Arrêt du bot...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Arrêt du bot...');
  bot.stop('SIGTERM');
  process.exit(0);
});

// Démarrer l'application
startApplication();

module.exports = app;
