const express = require('express');
const bot = require('./bot'); // Import de votre bot complet
const { sequelize, syncDatabase } = require('./models');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variables d'état
let dbConnected = false;
let botStarted = false;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test rapide de la base de données
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

// Endpoint pour configurer le webhook
app.post('/setup-webhook', async (req, res) => {
  try {
    const webhookPath = `/webhook/${bot.secretPathComponent()}`;
    const webhookUrl = `https://caliparis.onrender.com${webhookPath}`;
    
    console.log('🔄 Configuration du webhook...');
    console.log('📡 URL:', webhookUrl);
    
    const result = await bot.telegram.setWebhook(webhookUrl);
    
    res.json({
      success: true,
      webhookUrl: webhookUrl,
      result: result,
      message: 'Webhook configuré avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur configuration webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint pour vérifier le webhook
app.get('/webhook-info', async (req, res) => {
  try {
    const webhookInfo = await bot.telegram.getWebhookInfo();
    res.json({
      webhookInfo: webhookInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
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
    webhook: 'https://caliparis.onrender.com/webhook/' + bot.secretPathComponent(),
    endpoints: {
      health: '/health',
      webhookSetup: '/setup-webhook (POST)',
      webhookInfo: '/webhook-info'
    }
  });
});

// ==================== CONFIGURATION WEBHOOK ====================

// Webhook pour production
if (process.env.NODE_ENV === 'production') {
  const webhookPath = `/webhook/${bot.secretPathComponent()}`;
  const webhookUrl = `https://caliparis.onrender.com${webhookPath}`;
  
  console.log('🌐 Configuration du webhook Telegram...');
  console.log('📡 URL:', webhookUrl);
  
  // Configurer le webhook automatiquement
  bot.telegram.setWebhook(webhookUrl)
    .then(() => {
      console.log('✅ Webhook Telegram configuré avec succès!');
      console.log('🔗 URL:', webhookUrl);
    })
    .catch(error => {
      console.error('❌ Erreur configuration webhook:', error);
      console.log('💡 Solution: Exécutez POST /setup-webhook pour configurer manuellement');
    });
  
  app.use(bot.webhookCallback(webhookPath));
  console.log(`🌐 Webhook interne configuré sur: ${webhookPath}`);
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

// ==================== DÉMARRAGE APPLICATION ====================

async function startApplication() {
  console.log('🚀 Démarrage de CaliParis Bot...');
  console.log('🔍 Vérification des variables d\'environnement:');
  console.log('✅ BOT_TOKEN:', process.env.BOT_TOKEN ? 'Configuré' : '❌ Manquant');
  console.log('✅ DATABASE_URL:', process.env.DATABASE_URL ? 'Configuré' : '❌ Manquant');
  console.log('✅ ADMIN_CHAT_ID:', process.env.ADMIN_CHAT_ID ? 'Configuré' : 'Non configuré');
  console.log('✅ NODE_ENV:', process.env.NODE_ENV || 'development');

  // Vérification des variables critiques
  if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN manquant - Arrêt du service');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL manquante - Mode dégradé forcé');
    dbConnected = false;
  } else {
    // Tentative de connexion à la base de données
    console.log('🔄 Connexion à la base de données PostgreSQL...');
    dbConnected = await syncDatabase();
  }

  // Démarrer le serveur web
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: https://caliparis.onrender.com/health`);
    console.log(`🔗 Webhook setup: https://caliparis.onrender.com/setup-webhook (POST)`);
    console.log(`🔗 Webhook info: https://caliparis.onrender.com/webhook-info`);
    console.log(`🗄️  Base de données: ${dbConnected ? '✅ Connectée' : '❌ Déconnectée'}`);
    
    if (!dbConnected) {
      console.log('⚠️  MODE DÉGRADÉ: Le bot fonctionne sans base de données');
    }
  });

  // Démarrer le bot
  try {
    if (process.env.NODE_ENV === 'production') {
      // En production, le webhook est configuré automatiquement
      botStarted = true;
      console.log('🤖 Bot prêt (mode webhook)');
      
      // Vérifier le statut du webhook après un délai
      setTimeout(async () => {
        try {
          const webhookInfo = await bot.telegram.getWebhookInfo();
          console.log('📊 Statut webhook:', webhookInfo.url ? '✅ Actif' : '❌ Inactif');
          if (webhookInfo.url) {
            console.log('📍 URL webhook:', webhookInfo.url);
          }
        } catch (error) {
          console.error('❌ Erreur vérification webhook:', error);
        }
      }, 3000);
      
    } else {
      // En développement, utiliser le mode polling
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
