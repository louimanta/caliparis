const express = require('express');
const bot = require('./bot');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ 
      status: 'OK', 
      bot: 'running',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      bot: 'running',
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Stats endpoint (admin seulement)
app.get('/stats', async (req, res) => {
  try {
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
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;