
require('dotenv').config();
const express = require('express');
const { bot, startBot } = require('./bot');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware pour parser le JSON
app.use(express.json());

// Route health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Bot CaliParis en ligne',
    timestamp: new Date().toISOString()
  });
});

// Configuration du webhook pour la production
if (process.env.NODE_ENV === 'production') {
  const WEBHOOK_PATH = `/webhook/${process.env.BOT_TOKEN}`;
  
  console.log(`🌐 Configuration webhook sur: ${WEBHOOK_PATH}`);
  
  // Configurer le webhook
  app.use(bot.webhookCallback(WEBHOOK_PATH));
  
  // Définir le webhook au démarrage
  async function setupWebhook() {
    try {
      const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`;
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook configuré sur: ${WEBHOOK_PATH}`);
      console.log(`🔗 URL: ${webhookUrl}`);
    } catch (error) {
      console.error('❌ Erreur configuration webhook:', error);
    }
  }
  
  setupWebhook();
} else {
  console.log('🔧 Mode développement - Webhook désactivé');
}

// Démarrer le serveur
app.listen(PORT, async () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Démarrer le bot (initialisation BD, etc.)
  await startBot();
});

// Gestion propre de l'arrêt
process.once('SIGINT', () => {
  console.log('🛑 Arrêt du serveur (SIGINT)...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur (SIGTERM)...');
  bot.stop('SIGTERM');
  process.exit(0);
});
