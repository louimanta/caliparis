const express = require('express');
const bot = require('./bot');
const { sequelize, syncDatabase, testConnectionWithRetry } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variable pour suivre l'état de la base de données
let dbConnected = false;

// Health check endpoint amélioré
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnectionWithRetry();
    
    res.status(200).json({ 
      status: 'OK', 
      bot: 'running',
      database: dbStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      bot: 'running',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Stats endpoint (admin seulement) avec gestion d'erreur
app.get('/stats', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        error: 'Service temporairement indisponible',
        database: 'disconnected'
      });
    }

    const { Order, Product, Customer } = require('./models');
    
    const totalOrders = await Order.count();
    const pendingOrders = await Order.count({ where: { status: 'pending' } });
    const totalProducts = await Product.count({ where: { isActive: true } });
    const totalCustomers = await Customer.count();
    
    res.json({
      orders: {
        total: totalOrders,
        pending: pendingOrders
      },
      products: totalProducts,
      customers: totalCustomers,
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des statistiques',
      database: 'error'
    });
  }
});

// Webhook pour production
if (process.env.NODE_ENV === 'production') {
  const webhookPath = `/webhook/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(webhookPath));
  
  console.log(`🌐 Webhook configuré sur: ${webhookPath}`);
} else {
  // Mode polling en développement
  bot.launch();
  console.log('🔵 Bot en mode polling (développement)');
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

// Fonction de démarrage du serveur
async function startServer() {
  try {
    console.log('🚀 Démarrage de CaliParis Bot...');
    console.log('✅ BOT_TOKEN:', process.env.BOT_TOKEN ? 'Configuré' : 'Manquant');
    console.log('✅ DATABASE_URL:', process.env.DATABASE_URL ? 'Configuré' : 'Manquant');
    console.log('✅ ADMIN_CHAT_ID:', process.env.ADMIN_CHAT_ID ? 'Configuré' : 'Manquant');
    console.log('✅ NODE_ENV:', process.env.NODE_ENV || 'development');

    // Tentative de connexion à la base de données
    console.log('🔄 Tentative de connexion à la base de données...');
    dbConnected = await syncDatabase();

    if (dbConnected) {
      console.log('✅ Base de données connectée et synchronisée');
    } else {
      console.log('⚠️  Mode dégradé: fonctionnement sans base de données');
    }

    // Démarrer le serveur même sans base de données
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  Base de données: ${dbConnected ? '✅ Connectée' : '❌ Déconnectée'}`);
    });

  } catch (error) {
    console.error('❌ Erreur critique au démarrage:', error);
    process.exit(1);
  }
}

// Démarrer le serveur
startServer();

module.exports = app;
