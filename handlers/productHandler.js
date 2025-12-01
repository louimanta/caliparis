// productHandler.js - Version corrigée avec variétés
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

// === FONCTION PRINCIPALE EXISTANTE ===
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

// === NOUVELLE FONCTION : CATALOGUE AVEC VARIÉTÉS ===
async function showCatalogueGrouped(ctx) {
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

    // Grouper par nom de base (avant le tiret)
    const groupedProducts = {};
    products.forEach(product => {
      // Extraire le nom de base
      const nameParts = product.name.split(' - ');
      const baseName = nameParts[0].trim();
      
      if (!groupedProducts[baseName]) {
        groupedProducts[baseName] = [];
      }
      groupedProducts[baseName].push(product);
    });

    // Message d'introduction
    await ctx.reply('🎬 *Catalogue CaliParis - Variétés Premium* 🌿\n\n_Sélectionnez un produit :_', {
      parse_mode: 'Markdown'
    });

    // Afficher chaque groupe
    for (const [baseName, variants] of Object.entries(groupedProducts)) {
      const hasVariants = variants.length > 1;
      const firstProduct = variants[0];
      
      let message = `\n🍃 *${baseName.toUpperCase()}*\n`;
      
      if (hasVariants) {
        // Afficher le prix le plus bas
        const minPrice = Math.min(...variants.map(v => parseFloat(v.price)));
        const maxPrice = Math.max(...variants.map(v => parseFloat(v.price)));
        
        if (minPrice === maxPrice) {
          message += `💰 ${minPrice}€/g\n`;
        } else {
          message += `💰 ${minPrice}€ - ${maxPrice}€/g\n`;
        }
        message += `🌿 ${variants.length} variétés disponibles\n`;
      } else {
        message += `💰 ${firstProduct.price}€/g\n`;
      }
      
      if (firstProduct.description) {
        message += `📝 ${firstProduct.description.substring(0, 80)}...\n`;
      }

      // Ajouter mention achat minimum UNIQUEMENT pour La Mousse
      if (firstProduct.category === 'la mousse') {
        message += '\n⚠️ *Achat minimum: 100g*';
      }

      const keyboard = Markup.inlineKeyboard([
        hasVariants 
          ? [Markup.button.callback('🌿 Voir les variétés', `variants_${baseName.replace(/\s+/g, '_')}`)]
          : [
              Markup.button.callback('➕ 1g', `add_1_${firstProduct.id}`),
              Markup.button.callback('➕ 3g', `add_3_${firstProduct.id}`),
              Markup.button.callback('➕ 5g', `add_5_${firstProduct.id}`)
            ],
        hasVariants
          ? []
          : [
              Markup.button.callback('➕ 10g', `add_10_${firstProduct.id}`),
              Markup.button.callback('➕ 20g', `add_20_${firstProduct.id}`),
              Markup.button.callback('➕ 50g', `add_50_${firstProduct.id}`)
            ],
        [
          Markup.button.callback('🎬 Vidéo', `video_${firstProduct.id}`),
          Markup.button.callback('📊 Détails', `details_${firstProduct.id}`)
        ]
      ]);

      // Envoyer avec photo si disponible
      if (firstProduct.imageUrl) {
        try {
          let imageUrl = firstProduct.imageUrl.replace('.jpg.', '.jpg').trim();
          
          if (imageUrl.startsWith('http') && (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.png') || imageUrl.endsWith('.jpeg'))) {
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
        } catch (photoError) {
          await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...keyboard
          });
        }
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

  } catch (error) {
    console.error('❌ Erreur catalogue groupé:', error);
    await ctx.reply('❌ Erreur lors du chargement du catalogue');
  }
}

// === NOUVELLE FONCTION : AFFICHER LES VARIÉTÉS D'UN PRODUIT ===
async function showProductVariants(ctx, baseProductNameEncoded) {
  try {
    // Décoder le nom du produit
    const baseProductName = baseProductNameEncoded.replace(/_/g, ' ');
    
    // Chercher tous les produits avec le même nom de base
    const variants = await safeDbOperation(() => Product.findAll({
      where: {
        name: { [Op.like]: `${baseProductName}%` },
        isActive: true
      },
      order: [['price', 'ASC']]
    }), []);

    if (!variants || variants.length === 0) {
      return ctx.reply(`❌ Aucune variété disponible pour ${baseProductName}`);
    }

    // Message avec toutes les variétés
    let message = `🌿 *${baseProductName}*\n\n`;
    message += `Choisissez votre variété :\n\n`;

    variants.forEach((product, index) => {
      // Extraire le nom de la variété
      const variantName = product.name.replace(baseProductName, '').replace(' - ', '').trim();
      const displayName = variantName || 'Classique';
      
      message += `${index + 1}. *${displayName}*\n`;
      message += `💰 ${product.price}€/g\n`;
      if (product.description) {
        message += `📝 ${product.description.substring(0, 60)}...\n`;
      }
      message += `\n`;
    });

    // Créer les boutons pour chaque variété
    const keyboardButtons = variants.map((product, index) => {
      const variantName = product.name.replace(baseProductName, '').replace(' - ', '').trim().substring(0, 10);
      return [
        Markup.button.callback(
          `➕ ${variantName || 'Classique'}`, 
          `add_1_${product.id}`
        )
      ];
    });

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        ...keyboardButtons,
        [Markup.button.callback('⬅️ Retour catalogue', 'back_to_catalogue')]
      ])
    });

  } catch (error) {
    console.error('❌ Erreur variétés:', error);
    await ctx.reply('❌ Erreur chargement des variétés');
  }
}

// === FONCTIONS EXISTANTES ===
async function showProductVideo(ctx, productId) {
  try {
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product || !product.videoUrl) {
      return ctx.answerCbQuery('❌ Vidéo non disponible pour ce produit');
    }

    // Nettoyer l'URL de la vidéo
    let videoUrl = product.videoUrl.trim();
    
    // Vérifier si c'est une URL Telegram (ne fonctionne pas en public)
    if (videoUrl.includes('api.telegram.org')) {
      return ctx.answerCbQuery('❌ URL vidéo non accessible. Recréez le produit avec une vidéo valide.');
    }

    await ctx.replyWithVideo(videoUrl, {
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

// === EXPORTS ===
module.exports = { 
  showProducts, 
  showProductVideo, 
  showProductDetails,
  hasMinimumPurchase,
  getMinimumQuantity,
  // === NOUVELLES FONCTIONS ===
  showCatalogueGrouped,
  showProductVariants
};
