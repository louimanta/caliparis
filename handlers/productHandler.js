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
          Markup.button.callback('📊 Détails', `details_${product.id}`)
        ]
      ]);
      
      // Amélioration mineure du message d'erreur
} catch (error) {
  console.error('❌ Erreur affichage produits:', error);
  await ctx.reply(
    '📦 *Catalogue temporairement indisponible*\n\n' +
    'Veuillez réessayer dans quelques instants.',
    { parse_mode: 'Markdown' }
  );
}

      // ✅ CORRECTION : Vérification et nettoyage de l'URL
      let imageUrl = product.imageUrl;
      if (imageUrl && imageUrl.endsWith('.jpg.')) {
        imageUrl = imageUrl.replace('.jpg.', '.jpg');
      }

      if (imageUrl) {
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

    const detailsMessage = `
🔍 *Détails Complets - ${product.name}*

📊 *Informations techniques:*
• Type: ${product.category || 'Non spécifié'}
• Qualité: ${product.quality || 'Standard'}

📝 *Description:*
${product.description}

💡 *Conseils:*
• Conserver au sec et à l'abri de la lumière
• Consommer avec modération
• Réservé aux adultes

📦 *Disponibilité:*
${product.stock}g en stock
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

module.exports = { showProducts, showProductVideo, showProductDetails };

