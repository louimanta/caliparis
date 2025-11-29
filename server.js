// === AJOUTS POUR LA STABILITÉ ===

// Gestionnaire d'erreurs global pour Telegraf
bot.catch((err, ctx) => {
  console.error('❌ Erreur bot capturée:', err.message);
  // Ne pas crash l'application
});

// Redémarrage automatique en cas d'arrêt
async function maintainBot() {
  try {
    console.log('🔄 Maintenance du bot...');
    
    // Vérifier si le bot est toujours actif
    await bot.telegram.getMe();
    console.log('✅ Bot actif');
    
  } catch (error) {
    console.log('❌ Bot inactif, redémarrage...');
    try {
      await bot.stop();
      await bot.launch({ webhook: false });
      console.log('✅ Bot redémarré');
    } catch (restartError) {
      console.error('💥 Échec redémarrage:', restartError.message);
    }
  }
}

// Vérification périodique toutes les 10 minutes
setInterval(maintainBot, 10 * 60 * 1000);

console.log('🔧 Système de maintenance activé');
