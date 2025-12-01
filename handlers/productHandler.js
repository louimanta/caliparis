// productHandler.js - Version complète avec variétés (corrigé)
const { Markup } = require('telegraf');
const { Product, Cart } = require('../models');
const { Op } = require('sequelize');
const variantsConfig = require('./variantsConfig');

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
  return 1;
}

// === FONCTION PRINCIPALE MODIFIÉE ===
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
      // VÉRIFIER SI CE PRODUIT A DES VARIÉTÉS CONFIGURÉES
      const productVariants = variantsConfig[product.id.toString()];
      const hasVariants = productVariants && productVariants.variants.length > 0;
      
      let message = `
🛍️ *${hasVariants ? productVariants.baseName : product.name}*`;

      if (hasVariants) {
        // Produit avec variétés
        const prices = productVariants.variants.map(v => v.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        if (minPrice === maxPrice) {
          message += `\n💰 ${minPrice}€/g`;
        } else {
          message += `\n💰 ${minPrice}€ - ${maxPrice}€/g`;
        }
        
        message += `\n🌿 ${productVariants.variants.length} variétés disponibles`;
      } else {
        // Produit sans variétés
        message += `\n💰 ${product.price}€/g`;
      }
      
      message += `\n📝 ${product.description.substring(0, 80)}...`;

      // Ajouter mention achat minimum UNIQUEMENT pour La Mousse
      if (product.category === 'la mousse') {
        message += '\n\n⚠️ *Achat minimum: 100g*';
      }

      message += '\n\n_Choisissez la quantité :_';

      // CRÉER LE CLAVIER
      let keyboard;
      
      if (hasVariants) {
        // Produit avec variétés
        keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🌿 Choisir la variété', `choose_variant_${product.id}`)],
          [
            Markup.button.callback('🎬 Vidéo', `video_${product.id}`),
            Markup.button.callback('📊 Détails', `details_${product.id}`)
          ]
        ]);
      } else {
        // Produit sans variétés
        keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('➕ 1g', `add_1_${product.id}`),
            Markup.button.callback('➕ 3g', `add_3_${product.id}`),
            Markup.button.callback('➕ 5g', `add_5_${product.id}`)
          ],
          [
            Markup.button.callback('➕ 10g', `add_10_${product.id}`),
            Markup.button.callback('➕ 20g', `add_20_${product.id}`),
            Markup.button.callback('➕ 100g', `add_100_${product.id}`)
          ],
          [
            Markup.button.callback('🎬 Vidéo', `video_${product.id}`),
            Markup.button.callback('📊 Détails', `details_${product.id}`)
          ]
        ]);
      }

      // AFFICHER AVEC PHOTO
      let imageUrl = product.imageUrl;
      if (imageUrl) {
        imageUrl = imageUrl.replace('.jpg.', '.jpg').trim();
        
        if (imageUrl.startsWith('http') && (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.png') || imageUrl.endsWith('.jpeg'))) {
          try {
            await ctx.replyWithPhoto(imageUrl, {
              caption: message,
              parse_mode: 'Markdown',
              ...keyboard
            });
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
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

  } catch (error) {
    console.error('❌ Erreur affichage produits:', error);
    await ctx.reply('❌ Erreur lors du chargement des produits. Veuillez réessayer.');
  }
}

// === NOUVELLE FONCTION : MENU DES VARIÉTÉS ===
async function showVariantsMenu(ctx, productId) {
  try {
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }
    
    const productVariants = variantsConfig[productId.toString()];
    if (!productVariants || productVariants.variants.length === 0) {
      return ctx.answerCbQuery('❌ Aucune variété disponible');
    }
    
    let message = `🌿 *${productVariants.baseName}*\n\n`;
    message += `Choisissez votre variété préférée :\n\n`;
    
    // Lister les variétés
    productVariants.variants.forEach((variant, index) => {
      message += `${index + 1}. *${variant.name}* - ${variant.price}€/g\n`;
      if (variant.description) {
        message += `   ${variant.description.substring(0, 60)}...\n`;
      }
      message += '\n';
    });
    
    // AJOUT : Information sur le minimum pour La Mousse
    if (product.category === 'la mousse') {
      message += '\n⚠️ *Achat minimum: 100g*\n';
    }
    
    message += '\n_Sélectionnez une variété pour ajouter 1g :_';
    
    // Créer les boutons
    const keyboardButtons = [];
    
    // Boutons pour chaque variété (1g par défaut)
    productVariants.variants.forEach(variant => {
      keyboardButtons.push([
        Markup.button.callback(
          `✅ ${variant.name} - ${variant.price}€/g`,
          `select_variant_${variant.id}_1`
        )
      ]);
    });
    
    // AJOUT : Options de quantité supplémentaires
    keyboardButtons.push([
      Markup.button.callback('➕ 3g', `custom_variant_${productId}_3`),
      Markup.button.callback('➕ 5g', `custom_variant_${productId}_5`),
      Markup.button.callback('➕ 10g', `custom_variant_${productId}_10`)
    ]);
    
    // Bouton retour
    keyboardButtons.push([
      Markup.button.callback('⬅️ Retour au catalogue', 'back_to_products')
    ]);
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboardButtons)
    });
    
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('❌ Erreur menu variétés:', error);
    await ctx.answerCbQuery('❌ Erreur chargement des variétés');
  }
}

// === NOUVELLE FONCTION : SÉLECTION DE VARIÉTÉ ===
async function handleVariantSelection(ctx, variantId, quantity) {
  try {
    // NE PAS UTILISER CETTE FONCTION DIRECTEMENT
    // La logique est maintenant dans cartHandler.handleAddVariantToCart
    
    await ctx.answerCbQuery('🔄 Redirection vers panier...');
    
    // Rediriger vers cartHandler
    const { handleAddVariantToCart } = require('./cartHandler');
    await handleAddVariantToCart(ctx, variantId, quantity);
    
  } catch (error) {
    console.error('❌ Erreur sélection variété:', error);
    await ctx.answerCbQuery('❌ Erreur lors de l\'ajout');
  }
}

// === FONCTION POUR VARIANTES AVEC QUANTITÉS CUSTOM ===
async function handleCustomVariantQuantity(ctx, productId, quantity) {
  try {
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }
    
    const productVariants = variantsConfig[productId.toString()];
    if (!productVariants || productVariants.variants.length === 0) {
      return ctx.answerCbQuery('❌ Aucune variété disponible');
    }
    
    // Demander à l'utilisateur de choisir une variété
    let message = `🌿 *${productVariants.baseName}*\n\n`;
    message += `Vous avez sélectionné ${quantity}g.\n`;
    message += `Choisissez maintenant votre variété :\n\n`;
    
    productVariants.variants.forEach((variant, index) => {
      message += `${index + 1}. *${variant.name}* - ${variant.price * quantity}€ (${quantity}g)\n`;
    });
    
    // Créer les boutons pour chaque variété avec la quantité spécifiée
    const keyboardButtons = [];
    
    productVariants.variants.forEach(variant => {
      keyboardButtons.push([
        Markup.button.callback(
          `✅ ${variant.name} - ${variant.price * quantity}€`,
          `select_variant_${variant.id}_${quantity}`
        )
      ]);
    });
    
    keyboardButtons.push([
      Markup.button.callback('⬅️ Retour aux variétés', `choose_variant_${productId}`)
    ]);
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboardButtons)
    });
    
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('❌ Erreur quantité variété custom:', error);
    await ctx.answerCbQuery('❌ Erreur lors du traitement');
  }
}

// === FONCTIONS EXISTANTES (inchangées) ===
async function showProductVideo(ctx, productId) {
  try {
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product || !product.videoUrl) {
      return ctx.answerCbQuery('❌ Vidéo non disponible pour ce produit');
    }

    let videoUrl = product.videoUrl.trim();
    
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

    // Vérifier si le produit a des variétés
    const productVariants = variantsConfig[productId.toString()];
    const hasVariants = productVariants && productVariants.variants.length > 0;
    
    let detailsMessage = `
🔍 *Détails Complets - ${hasVariants ? productVariants.baseName : product.name}*`;

    // Ajouter les variétés si disponibles
    if (hasVariants) {
      detailsMessage += `\n\n🌿 *Variétés disponibles:*`;
      productVariants.variants.forEach((variant, index) => {
        detailsMessage += `\n${index + 1}. *${variant.name}* - ${variant.price}€/g`;
        if (variant.description) {
          detailsMessage += `\n   ${variant.description}`;
        }
      });
    }

    detailsMessage += `
📊 *Informations techniques:*
• Type: ${product.category || 'Non spécifié'}
• Qualité: ${product.quality || 'Standard'}
    `;

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
  // Nouvelles fonctions
  showVariantsMenu,
  handleVariantSelection,
  handleCustomVariantQuantity  // AJOUTÉ
};

