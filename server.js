const express = require('express');
const bot = require('./bot');
const { sequelize, syncDatabase } = require('./models');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let dbConnected = false;
let botStarted = false;

// ✅ AJOUTEZ cette fonction
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

app.get('/', (req, res) => {
  res.json({
    service: 'CaliParis Bot',
    status: 'running',
    database: dbConnected ? 'connected' : 'disconnected',
    message: dbConnected ? 'Service complet opérationnel' : 'Mode dégradé - Base de données hors ligne'
  });
});

if (process.env.NODE_ENV === 'production') {
  const webhookPath = `/webhook/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(webhookPath));
  console.log(`🌐 Webhook configuré sur: ${webhookPath}`);
}

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

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
    // ✅ CHANGEZ cette ligne seulement
    console.log('🔄 Connexion à la base de données PostgreSQL...');
    dbConnected = await initializeDatabase(); // ← CHANGÉ ICI
  }

  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: https://caliparis.onrender.com/health`);
    console.log(`🗄️  Base de données: ${dbConnected ? '✅ Connectée' : '❌ Déconnectée'}`);
    
    if (!dbConnected) {
      console.log('⚠️  MODE DÉGRADÉ: Le bot fonctionne sans base de données');
    }
  });

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

startApplication();

module.exports = app;
