require('dotenv').config();
console.log('🚀 Démarrage de CaliParis Bot...');
console.log('✅ BOT_TOKEN:', process.env.BOT_TOKEN ? 'Configuré' : 'Manquant');
console.log('✅ DATABASE_URL:', process.env.DATABASE_URL ? 'Configuré' : 'Manquant');
console.log('✅ ADMIN_CHAT_ID:', process.env.ADMIN_CHAT_ID ? 'Configuré' : 'Manquant');
console.log('✅ NODE_ENV:', process.env.NODE_ENV);

const express = require('express');
const bot = require('./bot');
const { syncDatabase } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    bot: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
    console.log('🔄 Tentative de connexion à la base de données...');
    
    // Synchroniser la base de données (optionnel)
    try {
      await syncDatabase();
      console.log('✅ Base de données synchronisée');
    } catch (dbError) {
      console.log('⚠️  Base de données non disponible:', dbError.message);
      console.log('🤖 Démarrage en mode sans base de données...');
    }
    
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`✅ Serveur démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check disponible`);
    });
    
  } catch (error) {
    console.error('❌ Erreur critique lors du démarrage:', error);
    process.exit(1);
  }
}

// Démarrer l'application
startApplication();

module.exports = app;
