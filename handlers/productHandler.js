// handlers/productHandler.js
const { Product } = require('../models');

async function showProducts(ctx) {
  try {
    console.log(`📦 showProducts - User: ${ctx.from.id}`);
    
    // CORRECTION: Utiliser isActive au lieu de available
    const products = await Product.findAll({
      where: { isActive: true }
    });

    if (products.length === 0) {
      await ctx.reply(
        '❌ Aucun produit disponible pour le moment.\n\nRevenez plus tard!',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let productsText = '📦 *CATALOGUE CALIPARIS*\n\n';
    productsText += '🌟 *Qualité Premium Garantie*\n\n';
    productsText += 'Choisissez votre produit:\n\n';

    const keyboard = [];

    products.forEach(product => {
      productsText += `*${product.name}*\n`;
      productsText += `💶 ${product.price}€/g\n`;
      productsText += `📝 ${product.description}\n\n`;

      keyboard.push([
        { 
          text: `🛍️ ${product.name} - ${product.price}€/g`, 
          callback_data: `details_${product.id}`
        }
      ]);
    });

    keyboard.push([
      { text: '🛒 Voir mon panier', callback_data: 'view_cart' },
      { text: '🏠 Menu principal', callback_data: 'back_to_menu' }
    ]);

    await ctx.reply(productsText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('❌ Erreur dans showProducts:', error);
    await ctx.reply('❌ Erreur lors du chargement des produits');
  }
}

async function showProductDetails(ctx, productId) {
  try {
    console.log(`📋 showProductDetails - User: ${ctx.from.id}, Product: ${productId}`);
    
    const product = await Product.findByPk(productId);
    
    if (!product) {
      await ctx.answerCbQuery('❌ Produit non trouvé');
      return;
    }

    let productText = `*${product.name}*\n\n`;
    productText += `📝 *Description:* ${product.description}\n`;
    productText += `💶 *Prix:* ${product.price}€/g\n`;
    productText += `⭐ *Qualité:* ${product.quality || 'Premium'}\n\n`;
    productText += `📍 *Livraison:* Paris et banlieue\n`;
    productText += `🚚 *Délai:* 2h-4h\n\n`;
    productText += `Choisissez la quantité:`;

    const keyboard = [
      [
        { text: '➕ 1g', callback_data: `add_1_${product.id}` },
        { text: '➕ 3g', callback_data: `add_3_${product.id}` },
        { text: '➕ 5g', callback_data: `add_5_${product.id}` }
      ],
      [
        { text: '🔢 Quantité personnalisée', callback_data: `custom_${product.id}` }
      ],
      [
        { text: '🎬 Voir la vidéo', callback_data: `video_${product.id}` }
      ],
      [
        { text: '📦 Retour au catalogue', callback_data: 'back_to_products' },
        { text: '🛒 Voir panier', callback_data: 'view_cart' }
      ]
    ];

    await ctx.reply(productText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('❌ Erreur dans showProductDetails:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement des détails');
  }
}

async function showProductVideo(ctx, productId) {
  try {
    console.log(`🎬 showProductVideo - User: ${ctx.from.id}, Product: ${productId}`);
    
    // Pour l'instant, message temporaire
    await ctx.reply(
      '🎬 *Vidéo de présentation*\n\n' +
      'Les vidéos des produits seront bientôt disponibles!\n\n' +
      'En attendant, vous pouvez consulter les détails du produit.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Voir les détails', callback_data: `details_${productId}` }],
            [{ text: '📦 Retour au catalogue', callback_data: 'back_to_products' }]
          ]
        }
      }
    );

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('❌ Erreur dans showProductVideo:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement de la vidéo');
  }
}

module.exports = {
  showProducts,
  showProductDetails,
  showProductVideo
};
