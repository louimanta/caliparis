const express = require('express');
const bot = require('./bot');
const { sequelize, testConnection, syncDatabase } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint amélioré
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.status(200).json({ 
      status: dbConnected ? 'OK' : 'WARNING',
      bot: 'running',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      bot: 'running',
      database: 'error',
      error: error.message 
    });
  }
});

// Stats endpoint (admin seulement)
app.get('/stats', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      return res.status(503).json({ error: 'Base de données non disponible' });
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
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook pour production
if (process.env.NODE_ENV === 'production') {
  const webhookPath = `/webhook/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(webhookPath));
  
  console.log(`🌐 Webhook configuré sur: ${webhookPath}`);
} else {
  // Mode polling en développement
  console.log('🔵 Mode développement - Démarrage du bot...');
  startBot();
}

// Fonction de démarrage du bot avec gestion d'erreur
async function startBot() {
  try {
    console.log('🔄 Tentative de connexion à la base de données...');
    
    const dbSynced = await syncDatabase();
    if (!dbSynced) {
      console.log('⚠️  Base de données non disponible, démarrage en mode limité');
      // Démarrer le bot même sans DB avec des fonctionnalités limitées
      bot.launch();
      console.log('🤖 Bot démarré en mode limité (sans base de données)');
      return;
    }
    
    // Charger les produits initiaux si nécessaire
    const { Product } = require('./models');
    const productCount = await Product.count();
    if (productCount === 0) {
      console.log('📦 Aucun produit trouvé, chargement des échantillons...');
      try {
        require('./scripts/initializeProducts')();
      } catch (error) {
        console.log('⚠️  Impossible de charger les produits initiaux:', error.message);
      }
    }
    
    bot.launch();
    console.log('🤖 Bot CaliParis démarré avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur critique lors du démarrage:', error.message);
    // Démarrer le bot même en cas d'erreur
    bot.launch();
    console.log('🤖 Bot démarré en mode de secours');
  }
}

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // En production, démarrer le bot après le serveur
  if (process.env.NODE_ENV === 'production') {
    startBot();
  }
});

module.exports = app;
