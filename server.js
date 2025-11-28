require('dotenv').config();
const express = require('express');
const bot = require('./bot');
const { syncDatabase } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test simple sans base de données
    res.status(200).json({ 
      status: 'OK',
      bot: 'running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message 
    });
  }
});

// Stats endpoint simplifié
app.get('/stats', (req, res) => {
  res.json({
    status: 'Bot en fonctionnement',
    timestamp: new Date().toISOString()
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
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Fonction de démarrage
async function startApplication() {
  try {
    console.log('🚀 Démarrage de l\'application...');
    
    // Synchroniser la base de données (optionnel)
    try {
      console.log('🔄 Tentative de connexion à la base de données...');
      await syncDatabase();
    } catch (dbError) {
      console.log('⚠️  Mode sans base de données:', dbError.message);
    }
    
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`✅ Serveur démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    console.error('❌ Erreur critique lors du démarrage:', error);
    process.exit(1);
  }
}

// Démarrer l'application
startApplication();

module.exports = app;
