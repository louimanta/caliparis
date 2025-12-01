const { Cart, Product } = require('../models');
const { hasMinimumPurchase, getMinimumQuantity } = require('./productHandler');
const variantsConfig = require('./variantsConfig'); // AJOUT IMPORT

// Fonction sécurisée pour accéder à la base de données AVEC LOGS
async function safeDbOperation(operation, fallbackValue = null) {
  try {
    console.log(`🔍 DB Operation: ${operation.name || 'anonymous'}`);
    const result = await operation();
    console.log(`✅ DB Operation réussie`);
    return result;
  } catch (error) {
    console.error(`❌ ERREUR DB dans ${operation.name || 'anonymous'}:`, error.message);
    console.error('Stack:', error.stack);
    return fallbackValue;
  }
}

// === FONCTION POUR AJOUTER DES VARIÉTÉS AU PANIER ===
async function handleAddVariantToCart(ctx, variantId, quantity) {
  try {
    console.log(`🛒 VARIÉTÉ - User: ${ctx.from.id}, Variant: ${variantId}, Qty: ${quantity}`);
    
    // Extraire l'ID du produit (format: "1_gelato41")
    const [productId, variantName] = variantId.split('_');
    console.log(`📊 Décodé - Produit: ${productId}, Variant: ${variantName}`);
    
    // Vérifier si la variété existe dans la config
    const productVariants = variantsConfig[productId];
    if (!productVariants) {
      console.log('❌ Configuration variétés non trouvée');
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }
    
    // Trouver la variété sélectionnée
    const selectedVariant = productVariants.variants.find(v => v.id === variantId);
    if (!selectedVariant) {
      console.log('❌ Variété non trouvée dans config:', variantId);
      return ctx.answerCbQuery('❌ Variété non disponible');
    }
    
    console.log(`🌿 Variété trouvée:`, selectedVariant);
    
    // Récupérer le produit de base pour vérifications
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product) {
      console.log('❌ Produit base non trouvé en DB');
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }
    
    // VÉRIFICATION ACHAT MINIMUM UNIQUEMENT POUR LA MOUSSE
    if (hasMinimumPurchase(product) && quantity < getMinimumQuantity(product)) {
      console.log(`❌ Quantité insuffisante pour La Mousse: ${quantity} < ${getMinimumQuantity(product)}`);
      return ctx.answerCbQuery(`❌ Achat minimum: ${getMinimumQuantity(product)}g pour ce produit`);
    }

    // Récupérer ou créer le panier
    let cart = await safeDbOperation(() => Cart.findOne({ where: { telegramId: ctx.from.id } }));
    console.log(`🛍️ Panier existant:`, cart ? 'OUI' : 'NON');
    
    if (!cart) {
      console.log(`🆕 Création nouveau panier pour user: ${ctx.from.id}`);
      cart = await safeDbOperation(() => Cart.create({
        telegramId: ctx.from.id,
        items: [],
        totalAmount: 0,
        lastActivity: new Date()
      }));
      
      if (!cart) {
        console.log('❌ Échec création panier');
        return ctx.answerCbQuery('❌ Erreur création panier');
      }
      console.log('✅ Nouveau panier créé');
    }

    // Conversion forcée en array
    const currentItems = Array.isArray(cart.items) ? cart.items : JSON.parse(cart.items || '[]');
    console.log(`📋 Items avant:`, currentItems);
    
    // Créer le nom complet avec variété
    const fullProductName = `${productVariants.baseName} (${selectedVariant.name})`;
    const totalPrice = selectedVariant.price * quantity;
    
    // Créer l'item avec informations de variété
    const newItem = {
      productId: parseInt(productId),
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      baseName: productVariants.baseName,
      name: fullProductName,
      quantity: quantity,
      unitPrice: selectedVariant.price,
      totalPrice: totalPrice,
      addedAt: new Date().toISOString()
    };
    
    console.log(`📦 Item créé:`, newItem);
    
    // Vérifier si cette variété existe déjà
    const existingItemIndex = currentItems.findIndex(item => 
      item.variantId === variantId
    );
    
    if (existingItemIndex > -1) {
      // Mettre à jour la quantité existante
      currentItems[existingItemIndex].quantity += quantity;
      currentItems[existingItemIndex].totalPrice = currentItems[existingItemIndex].quantity * selectedVariant.price;
      console.log(`📝 Item existant mis à jour:`, currentItems[existingItemIndex]);
    } else {
      // Ajouter un nouvel item
      currentItems.push(newItem);
      console.log(`🆕 Nouvel item ajouté:`, newItem);
    }

    // Mettre à jour le panier
    console.log(`💾 Mise à jour panier avec variété...`);
    const updated = await safeDbOperation(() => Cart.update({
      items: currentItems,
      totalAmount: currentItems.reduce((sum, item) => sum + item.totalPrice, 0),
      lastActivity: new Date()
    }, {
      where: { id: cart.id }
    }));
    console.log(`✅ Panier mis à jour via SQL:`, updated ? 'OUI' : 'NON');
    
    await ctx.answerCbQuery(`✅ ${quantity}g de ${selectedVariant.name} ajouté !`);
    
    // === MODIFICATION : AJOUT DES BOUTONS APRÈS AJOUT ===
    await ctx.reply(
      `✅ ${quantity}g de "${fullProductName}" ajouté au panier !\n\n🎯 *Que souhaitez-vous faire maintenant ?*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛒 Voir mon panier', callback_data: 'view_cart' },
              { text: '📦 Continuer mes achats', callback_data: 'back_to_products' }
            ]
          ]
        }
      }
    );
    
    console.log(`🎉 handleAddVariantToCart TERMINÉ avec succès`);
    
  } catch (error) {
    console.error('💥 ERREUR CRITIQUE handleAddVariantToCart:', error);
    console.error('Stack:', error.stack);
    await ctx.answerCbQuery('❌ Erreur ajout au panier');
  }
}

async function handleAddToCart(ctx, productId, quantity) {
  try {
    console.log(`🛒 ANCIEN - User: ${ctx.from.id}, Produit: ${productId}, Qty: ${quantity}`);
    
    const product = await safeDbOperation(() => Product.findByPk(productId));
    console.log(`📦 Produit trouvé:`, product ? product.name : 'NON');
    
    if (!product) {
      console.log('❌ Produit non trouvé en DB');
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    // VÉRIFICATION ACHAT MINIMUM UNIQUEMENT POUR LA MOUSSE
    if (hasMinimumPurchase(product) && quantity < getMinimumQuantity(product)) {
      console.log(`❌ Quantité insuffisante pour La Mousse: ${quantity} < ${getMinimumQuantity(product)}`);
      return ctx.answerCbQuery(`❌ Achat minimum: ${getMinimumQuantity(product)}g pour ce produit`);
    }

    let cart = await safeDbOperation(() => Cart.findOne({ where: { telegramId: ctx.from.id } }));
    console.log(`🛍️ Panier existant:`, cart ? 'OUI' : 'NON');
    
    if (!cart) {
      console.log(`🆕 Création nouveau panier pour user: ${ctx.from.id}`);
      cart = await safeDbOperation(() => Cart.create({
        telegramId: ctx.from.id,
        items: []
      }));
      
      if (!cart) {
        console.log('❌ Échec création panier');
        return ctx.answerCbQuery('❌ Erreur création panier');
      }
      console.log('✅ Nouveau panier créé');
    }

    console.log(`📋 Items avant:`, cart.items);
    
    // Conversion forcée en array
    const currentItems = Array.isArray(cart.items) ? cart.items : JSON.parse(cart.items || '[]');
    console.log(`📋 Items convertis avant:`, currentItems);
    
    const existingItemIndex = currentItems.findIndex(item => item.productId === productId);
    console.log(`🔍 Item existant index:`, existingItemIndex);
    
    if (existingItemIndex > -1) {
      currentItems[existingItemIndex].quantity += quantity;
      currentItems[existingItemIndex].totalPrice = currentItems[existingItemIndex].quantity * product.price;
      console.log(`📝 Item mis à jour:`, currentItems[existingItemIndex]);
    } else {
      const newItem = {
        productId: productId,
        name: product.name,
        quantity: quantity,
        unitPrice: product.price,
        totalPrice: quantity * product.price
      };
      currentItems.push(newItem);
      console.log(`🆕 Nouvel item ajouté:`, newItem);
    }

    console.log(`💾 Mise à jour panier...`);
    console.log(`📦 Items à sauvegarder:`, currentItems);
    
    // ✅ SOLUTION FINALE : Utiliser Cart.update() avec where
    const updated = await safeDbOperation(() => Cart.update({
      items: currentItems,
      totalAmount: currentItems.reduce((sum, item) => sum + item.totalPrice, 0),
      lastActivity: new Date()
    }, {
      where: { id: cart.id }
    }));
    console.log(`✅ Panier mis à jour via SQL:`, updated ? 'OUI' : 'NON');
    
    await ctx.answerCbQuery(`✅ ${quantity}g ajouté au panier`);
    
    // === MODIFICATION : AJOUT DES BOUTONS APRÈS AJOUT ===
    await ctx.reply(
      `✅ ${quantity}g de "${product.name}" ajouté au panier !\n\n🎯 *Que souhaitez-vous faire maintenant ?*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛒 Voir mon panier', callback_data: 'view_cart' },
              { text: '📦 Continuer mes achats', callback_data: 'back_to_products' }
            ]
          ]
        }
      }
    );
    
    console.log(`🎉 handleAddToCart TERMINÉ avec succès`);
    
  } catch (error) {
    console.error('💥 ERREUR CRITIQUE handleAddToCart:', error);
    console.error('Stack:', error.stack);
    await ctx.answerCbQuery('❌ Erreur ajout panier');
  }
}

async function handleCustomQuantity(ctx, productId) {
  try {
    console.log(`🔢 Demande quantité personnalisée - Produit: ${productId}`);
    
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    let message = '🔢 Entrez la quantité souhaitée (en grammes) :\nExemple: 5 pour 5 grammes';
    
    // Message spécifique pour La Mousse
    if (product.category === 'la mousse') {
      message = `🔢 *Entrez la quantité souhaitée pour ${product.name}*\n\n⚠️ *Achat minimum: 100g*\n\nExemple: 100 pour 100 grammes`;
    }
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Annuler', callback_data: `cancel_custom_${productId}` }]
        ]
      }
    });

    // Stocker l'attente dans la session
    ctx.session.waitingForCustomQuantity = {
      productId: productId,
      timestamp: Date.now()
    };

    console.log(`⏳ Session configurée pour quantité personnalisée`);

  } catch (error) {
    console.error('Erreur quantité personnalisée:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la saisie');
  }
}

async function handleCustomQuantityResponse(ctx) {
  try {
    console.log(`📨 Réponse quantité personnalisée reçue:`, ctx.message.text);
    
    if (!ctx.session.waitingForCustomQuantity) {
      console.log('❌ Aucune session quantité personnalisée');
      return;
    }

    const quantity = parseFloat(ctx.message.text);
    const productId = ctx.session.waitingForCustomQuantity.productId;

    console.log(`🔢 Quantité parsée: ${quantity}, Produit: ${productId}`);

    if (isNaN(quantity) || quantity <= 0) {
      console.log('❌ Quantité invalide');
      await ctx.reply('❌ Veuillez entrer un nombre valide (ex: 5 pour 5 grammes)');
      return;
    }

    // Vérification supplémentaire pour La Mousse
    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (product && product.category === 'la mousse' && quantity < 100) {
      await ctx.reply('❌ Achat minimum: 100g pour ce produit');
      delete ctx.session.waitingForCustomQuantity;
      return;
    }

    // Supprimer l'état d'attente
    delete ctx.session.waitingForCustomQuantity;
    console.log('✅ Session quantité personnalisée supprimée');

    // Ajouter au panier
    await handleAddToCart(ctx, productId, quantity);
    
  } catch (error) {
    console.error('Erreur réponse quantité:', error);
    await ctx.reply('❌ Erreur lors du traitement de la quantité');
  }
}

async function showCart(ctx) {
  try {
    console.log(`👀 DEBUT showCart - User: ${ctx.from.id}`);
    
    const cart = await safeDbOperation(() => Cart.findOne({ where: { telegramId: ctx.from.id } }));
    console.log(`🛍️ Panier trouvé:`, cart ? 'OUI' : 'NON');
    
    if (!cart) {
      console.log('❌ Aucun panier trouvé');
      return ctx.reply(
        '🛒 Votre panier est vide\n\n' +
        '📦 Parcourez notre catalogue pour ajouter des produits!',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📦 Voir le catalogue', callback_data: 'back_to_products' }]
            ]
          }
        }
      );
    }

    console.log(`📋 Items dans panier (RAW):`, cart.items);
    console.log(`📋 Type de items:`, typeof cart.items);
    
    // FORCER la conversion en array si nécessaire
    const items = Array.isArray(cart.items) ? cart.items : JSON.parse(cart.items || '[]');
    console.log(`📋 Items convertis:`, items);
    console.log(`📋 Nombre d'items convertis:`, items.length);
    
    if (!items || items.length === 0) {
      console.log('🛒 Panier vide après conversion');
      return ctx.reply(
        '🛒 Votre panier est vide\n\n' +
        '📦 Parcourez notre catalogue pour ajouter des produits!',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📦 Voir le catalogue', callback_data: 'back_to_products' }]
            ]
          }
        }
      );
    }

    console.log(`📋 Items valides:`, items.length);
    
    let message = '🛒 *Votre Panier*\n\n';
    let totalAmount = 0;

    for (const item of items) {
      console.log(`🔍 Item du panier:`, item);
      
      // AFFICHAGE AVEC VARIÉTÉ SI DISPONIBLE
      if (item.variantName) {
        // Produit avec variété
        message += `🌿 ${item.baseName || item.name}\n`;
        message += `   🍃 Variété: ${item.variantName}\n`;
        message += `   📦 Quantité: ${item.quantity}g\n`;
        message += `   💰 Prix: ${item.totalPrice}€\n\n`;
        console.log(`✅ Variété affichée: ${item.variantName}`);
      } else {
        // Produit sans variété
        console.log(`📦 Récupération produit sans variété: ${item.productId}`);
        const product = await safeDbOperation(() => Product.findByPk(item.productId));
        if (product) {
          message += `🌿 ${product.name}\n`;
          message += `   📦 Quantité: ${item.quantity}g\n`;
          message += `   💰 Prix: ${item.totalPrice}€\n\n`;
          console.log(`✅ Produit affiché: ${product.name}`);
        } else {
          console.log(`❌ Produit non trouvé: ${item.productId}`);
          message += `🌿 ${item.name || `Produit #${item.productId}`}\n`;
          message += `   📦 Quantité: ${item.quantity}g\n`;
          message += `   💰 Prix: ${item.totalPrice}€\n\n`;
        }
      }
      
      totalAmount += item.totalPrice;
    }

    message += `💵 *Total: ${totalAmount}€*`;

    // Appliquer remise automatique pour grosses quantités
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    console.log(`📊 Quantité totale: ${totalQuantity}g`);

    if (totalQuantity >= 30) {
      const discount = totalQuantity >= 50 ? 15 : 10;
      message += '\n\n💎 *Remise Gros Quantité Activée!*';
      message += `\n📦 Quantité totale: ${totalQuantity}g`;
      message += `\n🎁 Remise: ${discount}% appliquée`;
      console.log(`🎁 Remise appliquée: ${discount}%`);
    } else if (totalQuantity >= 20) {
      message += '\n\n💡 *Ajoutez 10g de plus pour une remise de 10%!*';
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Passer la commande', callback_data: 'checkout' }],
          [{ text: '🎁 Demander une remise', callback_data: 'ask_discount' }],
          [
            { text: '📦 Continuer les achats', callback_data: 'back_to_products' },
            { text: '🗑 Vider le panier', callback_data: 'clear_cart' }
          ]
        ]
      },
      parse_mode: 'Markdown'
    };

    await ctx.reply(message, keyboard);
    console.log(`✅ showCart TERMINÉ - Message panier envoyé`);
    
  } catch (error) {
    console.error('💥 ERREUR CRITIQUE showCart:', error);
    console.error('Stack:', error.stack);
    await ctx.reply('❌ Erreur lors du chargement du panier. Veuillez réessayer.');
  }
}

async function clearCart(ctx) {
  try {
    console.log(`🗑️ DEBUT clearCart - User: ${ctx.from.id}`);
    
    const cart = await safeDbOperation(() => Cart.findOne({ where: { telegramId: ctx.from.id } }));
    if (cart) {
      console.log(`📋 Items avant vidage:`, cart.items.length);
      
      await safeDbOperation(() => Cart.update({
        items: [],
        totalAmount: 0,
        lastActivity: new Date()
      }, {
        where: { id: cart.id }
      }));
      
      console.log('✅ Panier vidé');
    } else {
      console.log('ℹ️ Aucun panier à vider');
    }
    
    await ctx.reply('✅ Panier vidé avec succès');
    console.log(`✅ clearCart TERMINÉ`);
    
  } catch (error) {
    console.error('Erreur vidage panier:', error);
    await ctx.reply('❌ Erreur lors du vidage du panier');
  }
}

module.exports = { 
  handleAddToCart, 
  handleAddVariantToCart, // AJOUTÉ
  handleCustomQuantity, 
  handleCustomQuantityResponse,
  showCart, 
  clearCart,
  safeDbOperation
};
