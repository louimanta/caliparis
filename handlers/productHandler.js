// productHandler.js - Version corrigée
const { Markup } = require('telegraf');
const { Product } = require('../models');
const { Op } = require('sequelize');

// Fonction utilitaire pour les opérations DB sécurisées
async function safeDbOperation(operation, fallback = null) {
  try {
    return await operation();
  } catch (error) {
    console.error('❌ Erreur DB:', error);
    return fallback;
  }
}

// Fonction pour vérifier si un produit a un achat minimum (UNIQUEMENT La Mousse)
function hasMinimumPurchase(product) {
  return product.category === 'la mousse';
}

// Fonction pour obtenir la quantité minimum (UNIQUEMENT La Mousse)
function getMinimumQuantity(product) {
  if (product.category === 'la mousse') {
    return 100;
  }
  return 1; // Quantité minimum par défaut pour les autres produits
}

async function showProducts(ctx) {
  try {
    const products = await safeDbOperation(() => Product.findAll({ 
      where: { 
        isActive: true
      },
      order: [['name', 'ASC']]
    }), []);

    if (!products || products.length === 0) {
      return ctx.reply('📦 Aucun produit disponible pour le moment.');
    }

    // Message d'introduction
    await ctx.reply('🎬 *Découvrez notre catalogue premium* 🌿\n\n_Sélectionnez vos produits préférés :_', {
      parse_mode: 'Markdown'
    });

    // Afficher chaque produit
    for (const product of products) {
      let message = `
🛍️ *${product.name}*
💰 ${product.price}€/g
📝 ${product.description}
      `.trim();

      // Ajouter mention achat minimum UNIQUEMENT pour La Mousse
      if (product.category === 'la mousse') {
        message += '\n\n⚠️ *Achat minimum: 100g*';
      }

      message += '\n\n_Choisissez la quantité :_';

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('➕ 1g', `add_1_${product.id}`),
          Markup.button.callback('➕ 3g', `add_3_${product.id}`),
          Markup.button.callback('➕ 5g', `add_5_${product.id}`)
        ],
        [
          Markup.button.callback('➕ 10g', `add_10_${product.id}`),
          Markup.button.callback('➕ 20g', `add_20_${product.id}`),
          Markup.button.callback('➕ 50g', `add_50_${product.id}`)
        ],
        [
          Markup.button.callback('🎬 Vidéo', `video_${product.id}`),
          Markup.button.callback('📊 Détails', `details_${product.id}`)
        ]
      ]);

      // Vérification et nettoyage de l'URL de l'image
      let imageUrl = product.imageUrl;
      if (imageUrl) {
        // Nettoyer l'URL
        imageUrl = imageUrl.replace('.jpg.', '.jpg').trim();
        
        // Vérifier si l'URL est valide
        if (imageUrl.startsWith('http') && (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.png') || imageUrl.endsWith('.jpeg'))) {
          try {
            await ctx.replyWithPhoto(imageUrl, {
              caption: message,
              parse_mode: 'Markdown',
              ...keyboard
            });
          } catch (photoError) {
            console.error(`❌ Erreur photo pour ${product.name}:`, photoError.message);
            // Fallback: envoyer sans photo
            await ctx.reply(message, {
              parse_mode: 'Markdown',
              ...keyboard
            });
          }
        } else {
          // URL invalide, envoyer sans photo
          await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...keyboard
          });
        }
      } else {
        // Pas d'URL d'image, envoyer sans photo
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }

      // Petite pause entre les produits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

  } catch (error) {
    console.error('❌ Erreur affichage produits:', error);
    await ctx.reply('❌ Erreur lors du chargement des produits. Veuillez réessayer.');
  }
}

async function showProductVideo(ctx, productId) {
  try {
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product || !product.videoUrl) {
      return ctx.answerCbQuery('❌ Vidéo non disponible pour ce produit');
    }

    await ctx.replyWithVideo(product.videoUrl, {
      caption: `🎬 *${product.name}*\n${product.description}`,
      parse_mode: 'Markdown'
    });

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur vidéo produit:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement de la vidéo');
  }
}

async function showProductDetails(ctx, productId) {
  try {
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    let detailsMessage = `
🔍 *Détails Complets - ${product.name}*

📊 *Informations techniques:*
• Type: ${product.category || 'Non spécifié'}
• Qualité: ${product.quality || 'Standard'}
    `;

    // Ajouter information achat minimum pour La Mousse
    if (product.category === 'la mousse') {
      detailsMessage += '\n• ⚠️ *Achat minimum: 100g*';
    }

    detailsMessage += `
📝 *Description:*
${product.description}

💡 *Conseils:*
• Conserver au sec et à l'abri de la lumière
• Consommer avec modération
• Réservé aux adultes
    `.trim();

    await ctx.reply(detailsMessage, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Retour aux produits', 'back_to_products')]
      ])
    });

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur détails produit:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement des détails');
  }
}

module.exports = { 
  showProducts, 
  showProductVideo, 
  showProductDetails,
  hasMinimumPurchase,
  getMinimumQuantity
};
