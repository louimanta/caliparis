// handlers/startHandler.js
async function handleStart(ctx) {
  try {
    const userName = ctx.from.first_name;
    const userId = ctx.from.id;
    
    console.log(`🚀 Start command - User: ${userId} (${userName})`);

    const welcomeMessage = 
      `🌟 *BIENVENUE CHEZ CALIPARIS* 🌟\n\n` +
      `Salut ${userName} ! 👋\n\n` +
      `*Votre boutique premium de confiance* 💎\n\n` +
      `🛒 *Comment ça marche ?*\n` +
      `1. 📦 Parcourez notre catalogue\n` +
      `2. 🛍️ Ajoutez vos produits au panier\n` +
      `3. 💰 Validez votre commande\n` +
      `4. 🚚 Recevez sous 2h-4h\n\n` +
      `📍 *Zone de livraison:* Paris et banlieue\n` +
      `💳 *Paiements:* Crypto ou Cash\n\n` +
      `🎁 *Première commande ?* Service premium garanti !`;

    await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['📦 Voir le catalogue', '🛒 Mon panier'],
          ['🎬 Vidéo présentation', '📞 Contact'],
          ['ℹ️ Informations', '💎 Commandes en gros']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });

    // Initialiser le panier si nécessaire
    if (!ctx.session.cart) {
      ctx.session.cart = [];
      ctx.session = { ...ctx.session };
    }

  } catch (error) {
    console.error('❌ Erreur dans handleStart:', error);
    await ctx.reply(
      '❌ Une erreur est survenue lors du démarrage.\n\nVeuillez réessayer.',
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = {
  handleStart
};
