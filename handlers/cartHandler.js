const { Cart, Product } = require('../models');

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

async function handleAddToCart(ctx, productId, quantity) {
  try {
    console.log(`🛒 DEBUT handleAddToCart - User: ${ctx.from.id}, Produit: ${productId}, Qty: ${quantity}`);
    
    const product = await safeDbOperation(() => Product.findByPk(productId));
    console.log(`📦 Produit trouvé:`, product ? product.name : 'NON');
    
    if (!product) {
      console.log('❌ Produit non trouvé en DB');
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    if (product.stock < quantity) {
      console.log(`❌ Stock insuffisant: ${product.stock} < ${quantity}`);
      return ctx.answerCbQuery('❌ Stock insuffisant');
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
    
    // ✅ SOLUTION FINALE : Utiliser Cart.update() avec where pour contourner le bug Sequelize
    const updated = await safeDbOperation(() => Cart.update({
      items: currentItems,
      totalAmount: currentItems.reduce((sum, item) => sum + item.totalPrice, 0),
      lastActivity: new Date()
    }, {
      where: { id: cart.id }
    }));
    console.log(`✅ Panier mis à jour via SQL:`, updated ? 'OUI' : 'NON');
    
    await ctx.answerCbQuery(`✅ ${quantity}g ajouté au panier`);
    await ctx.reply(`🛒 ${quantity}g de "${product.name}" ajouté au panier! cliquer sur Mon panier pour finaliser votre commande.`);
    
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
    
    await ctx.reply(
      '🔢 Entrez la quantité souhaitée (en grammes) :\nExemple: 5 pour 5 grammes',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Annuler', callback_data: `cancel_custom_${productId}` }]
          ]
        }
      }
    );

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
    console.log(`📋 Longueur de items:`, Array.isArray(cart.items) ? cart.items.length : 'NON-ARRAY');
    
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
      console.log(`🔍 Récupération produit: ${item.productId}`);
      const product = await safeDbOperation(() => Product.findByPk(item.productId));
      if (product) {
        message += `🌿 ${product.name}\n`;
        message += `   📦 Quantité: ${item.quantity}g\n`;
        message += `   💰 Prix: ${item.totalPrice}€\n\n`;
        totalAmount += item.totalPrice;
        console.log(`✅ Produit affiché: ${product.name}`);
      } else {
        console.log(`❌ Produit non trouvé: ${item.productId}`);
        message += `🌿 ${item.name || `Produit #${item.productId}`}\n`;
        message += `   📦 Quantité: ${item.quantity}g\n`;
        message += `   💰 Prix: ${item.totalPrice}€\n\n`;
        totalAmount += item.totalPrice;
      }
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
      
      // ✅ Utiliser aussi Cart.update() pour le vidage
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
  handleCustomQuantity, 
  handleCustomQuantityResponse,
  showCart, 
  clearCart,
  safeDbOperation
};

