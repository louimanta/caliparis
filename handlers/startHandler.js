const { Markup } = require('telegraf');
const { Customer } = require('../models');

async function handleStart(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name || '';

  // Enregistrer ou mettre à jour le client
  await Customer.upsert({
    telegramId: userId,
    username: username,
    firstName: firstName,
    lastName: lastName
  });

  const welcomeMessage = `
🌿 *Bienvenue chez CaliParis* 🌿

*Qualité Premium • Livraison Discrète • 24h/48h*

🎬 Découvrez nos produits premium avec photos et vidéos

Choisissez une option ci-dessous :
  `;

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    ...Markup.keyboard([
      ['📦 Voir le catalogue', '🛒 Mon panier'],
      ['🎬 Vidéo présentation', '📞 Contact'],
      ['ℹ️ Informations', '💎 Commandes en gros']
    ]).resize()
  });
}

module.exports = { handleStart };
