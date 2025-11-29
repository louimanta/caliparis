const { Markup } = require('telegraf');
const { Product } = require('../models');
const { Op } = require('sequelize');
const { safeDbOperation } = require('./cartHandler');

async function showProducts(ctx) {
  try {
    const products = await safeDbOperation(() => Product.findAll({ 
      where: { 
        isActive: true, 
        stock: { [Op.gt]: 0 }
      },
      order: [['name', 'ASC']],
      limit: 6 // ← Limité à 6 produits
    }), []);

    if (!products || products.length === 0) {
      return ctx.reply('📦 Aucun produit disponible pour le moment.');
    }

    // Message d'introduction
    await ctx.reply('🎬 *Découvrez notre catalogue premium* 🌿\n\n_Sélectionnez vos produits préférés :_', {
      parse_mode: 'Markdown'
    });

    // Organiser les produits en paires de 2
    const productPairs = [];
    for (let i = 0; i < products.length; i += 2) {
      productPairs.push(products.slice(i, i + 2));
    }

    // Afficher chaque paire de produits
    for (const pair of productPairs) {
      const productMessages = [];

      for (const product of pair) {
        const message = `
🛍️ *${product.name}*
💰 ${product.price}€/g
📦 Stock: ${product.stock}g
        `.trim();

        productMessages.push({
          message,
          product,
          hasImage: product.imageUrl && product.imageUrl.startsWith('http')
        });
      }

      // Créer le message combiné pour les 2 produits
      if (productMessages.length === 2) {
        await sendProductPair(ctx, productMessages[0], productMessages[1]);
      } else {
        // Cas où il reste un seul produit (dernière paire)
        await sendSingleProduct(ctx, productMessages[0]);
      }

      // Pause entre les paires
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Boutons de navigation en bas
    await ctx.reply('📦 *Navigation*', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Voir plus de produits', 'more_products')],
        [Markup.button.callback('🛒 Voir mon panier', 'view_cart')]
      ])
    });

  } catch (error) {
    console.error('❌ Erreur affichage produits:', error);
    await ctx.reply(
      '📦 *Catalogue temporairement indisponible*\n\nVeuillez réessayer dans quelques instants.',
      { parse_mode: 'Markdown' }
    );
  }
}

// Fonction pour envoyer une paire de produits
async function sendProductPair(ctx, product1, product2) {
  const combinedMessage = `
${product1.message}

${product2.message}

_Choisissez un produit :_
  `.trim();

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(`📦 ${product1.product.name.substring(0, 12)}...`, `select_${product1.product.id}`),
      Markup.button.callback(`📦 ${product2.product.name.substring(0, 12)}...`, `select_${product2.product.id}`)
    ]
  ]);

  // Essayer d'envoyer avec une image du premier produit, sinon message texte
  if (product1.hasImage) {
    let imageUrl = product1.product.imageUrl;
    if (imageUrl && imageUrl.endsWith('.jpg.')) {
      imageUrl = imageUrl.replace('.jpg.', '.jpg');
    }
    
    await ctx.replyWithPhoto(imageUrl, {
      caption: combinedMessage,
      parse_mode: 'Markdown',
      ...keyboard
    });
  } else {
    await ctx.reply(combinedMessage, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

// Fonction pour un produit seul
async function sendSingleProduct(ctx, productData) {
  const message = `
${productData.message}

_Choisissez la quantité :_
  `.trim();

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`📦 Voir ${productData.product.name}`, `select_${productData.product.id}`)]
  ]);

  if (productData.hasImage) {
    let imageUrl = productData.product.imageUrl;
    if (imageUrl && imageUrl.endsWith('.jpg.')) {
      imageUrl = imageUrl.replace('.jpg.', '.jpg');
    }
    
    await ctx.replyWithPhoto(imageUrl, {
      caption: message,
      parse_mode: 'Markdown',
      ...keyboard
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

// Nouvelle fonction pour afficher les détails d'un produit sélectionné
async function showProductDetailsPage(ctx, productId) {
  try {
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    const message = `
🛍️ *${product.name}*
💰 ${product.price}€/g
📝 ${product.description}
📦 Stock: ${product.stock}g disponible(s)

_Choisissez la quantité :_
    `.trim();

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ 1g', `add_1_${product.id}`),
        Markup.button.callback('➕ 3g', `add_3_${product.id}`),
        Markup.button.callback('➕ 5g', `add_5_${product.id}`)
      ],
      [
        Markup.button.callback('➕ 10g', `add_10_${product.id}`),
        Markup.button.callback('➕ 20g', `add_20_${product.id}`),
        Markup.button.callback('⚡ Autre', `custom_${product.id}`)
      ],
      [
        Markup.button.callback('🎬 Vidéo', `video_${product.id}`),
        Markup.button.callback('📊 Détails', `details_${product.id}`),
        Markup.button.callback('⬅️ Retour', 'back_to_products')
      ]
    ]);

    // Essayer d'envoyer avec image
    let imageUrl = product.imageUrl;
    if (imageUrl && imageUrl.endsWith('.jpg.')) {
      imageUrl = imageUrl.replace('.jpg.', '.jpg');
    }

    if (imageUrl && imageUrl.startsWith('http')) {
      await ctx.replyWithPhoto(imageUrl, {
        caption: message,
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur détails produit:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement du produit');
  }
}

// Fonction pour voir plus de produits (pagination)
async function showMoreProducts(ctx) {
  await ctx.reply('🔍 Fonctionnalité "Voir plus" bientôt disponible !');
  await ctx.answerCbQuery();
}

// Garder les fonctions existantes pour vidéo et détails
async function showProductVideo(ctx, productId) {
  // ... votre code existant ...
}

async function showProductDetails(ctx, productId) {
  // ... votre code existant ...
}

module.exports = { 
  showProducts, 
  showProductVideo, 
  showProductDetails,
  showProductDetailsPage,
  showMoreProducts
};
