// handlers/cartHandler.js
const { Product } = require('../models');

async function handleAddToCart(ctx, productId, quantity) {
  try {
    console.log(`🛍️ handleAddToCart - User: ${ctx.from.id}, Product: ${productId}, Qty: ${quantity}`);
    
    // Validation de la quantité
    if (!quantity || quantity <= 0) {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('❌ Quantité invalide');
      } else {
        await ctx.reply('❌ Quantité invalide');
      }
      return;
    }

    // Récupérer le produit depuis la base de données
    const product = await Product.findByPk(productId);
    if (!product) {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('❌ Produit non trouvé');
      } else {
        await ctx.reply('❌ Produit non trouvé');
      }
      return;
    }

    // Initialiser le panier si nécessaire
    if (!ctx.session.cart) {
      ctx.session.cart = [];
    }

    // Vérifier si le produit est déjà dans le panier
    const existingItemIndex = ctx.session.cart.findIndex(item => item.productId === productId);
    
    if (existingItemIndex > -1) {
      // Mettre à jour la quantité
      ctx.session.cart[existingItemIndex].quantity += quantity;
      console.log(`📈 Quantité mise à jour: ${ctx.session.cart[existingItemIndex].quantity}`);
    } else {
      // Ajouter un nouvel item
      ctx.session.cart.push({
        productId: productId,
        name: product.name,
        price: product.price.toString(),
        quantity: quantity,
        addedAt: new Date()
      });
      console.log(`🆕 Produit ajouté: ${product.name}`);
    }

    // Sauvegarder la session
    ctx.session = { ...ctx.session };
    
    console.log(`📊 Panier après ajout:`, ctx.session.cart);

    // Répondre différemment selon le type de contexte
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(`✅ ${quantity}g ajouté au panier!`);
    } else {
      await ctx.reply(`✅ ${quantity}g de ${product.name} ajouté au panier!`);
    }

  } catch (error) {
    console.error('❌ Erreur dans handleAddToCart:', error);
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Erreur lors de l\'ajout au panier');
    } else {
      await ctx.reply('❌ Erreur lors de l\'ajout au panier');
    }
    throw error;
  }
}

async function handleCustomQuantity(ctx, productId) {
  try {
    // Stocker l'ID du produit en attente de quantité
    ctx.session.awaitingCustomQuantity = productId;
    ctx.session = { ...ctx.session };

    await ctx.reply(
      `🔢 *Quantité personnalisée*\n\n` +
      `Veuillez entrer la quantité souhaitée (en grammes):\n` +
      `Exemple: 5 pour 5 grammes\n\n` +
      `❌ Pour annuler, utilisez /cancel`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Annuler', callback_data: `cancel_custom_${productId}` }]
          ]
        }
      }
    );

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('❌ Erreur dans handleCustomQuantity:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la demande de quantité');
  }
}

async function showCart(ctx) {
  try {
    console.log(`🛒 showCart - User: ${ctx.from.id}`);
    console.log(`📦 Contenu du panier:`, ctx.session.cart);
    
    if (!ctx.session.cart || ctx.session.cart.length === 0) {
      await ctx.reply(
        '🛒 *Votre panier est vide*\n\n' +
        'Ajoutez des produits depuis le catalogue pour commencer vos achats!',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📦 Voir le catalogue', callback_data: 'back_to_products' }]
            ]
          }
        }
      );
      return;
    }

    let total = 0;
    let cartText = '🛒 *VOTRE PANIER*\n\n';
    
    ctx.session.cart.forEach((item, index) => {
      const itemTotal = parseFloat(item.price) * item.quantity;
      total += itemTotal;
      cartText += `${index + 1}. ${item.name}\n`;
      cartText += `   💰 ${item.price}€/g x ${item.quantity}g = ${itemTotal}€\n\n`;
    });

    cartText += `💶 *TOTAL: ${total}€*\n\n`;
    cartText += `📍 Livraison: Paris et banlieue\n`;
    cartText += `🚚 Délai: 2h-4h`;

    const keyboard = [
      [{ text: '💰 Passer commande', callback_data: 'checkout' }],
      [{ text: '🗑️ Vider le panier', callback_data: 'clear_cart' }],
      [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }]
    ];

    await ctx.reply(cartText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('❌ Erreur dans showCart:', error);
    await ctx.reply('❌ Erreur lors du chargement du panier');
  }
}

async function clearCart(ctx) {
  try {
    ctx.session.cart = [];
    ctx.session = { ...ctx.session };
    
    await ctx.reply(
      '🗑️ *Panier vidé*\n\n' +
      'Votre panier a été vidé avec succès!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Voir le catalogue', callback_data: 'back_to_products' }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('❌ Erreur dans clearCart:', error);
    await ctx.reply('❌ Erreur lors du vidage du panier');
  }
}

async function handleQuantityMessage(ctx) {
  try {
    const messageText = ctx.message.text;
    
    // Vérifier si c'est un nombre (quantité personnalisée)
    const quantity = parseInt(messageText);
    
    if (isNaN(quantity) || quantity <= 0) {
      return false; // Ce n'est pas une quantité valide
    }

    // Vérifier si l'utilisateur a une session de quantité en cours
    if (!ctx.session.awaitingCustomQuantity) {
      return false;
    }

    const productId = ctx.session.awaitingCustomQuantity;
    
    // Nettoyer l'état d'attente
    delete ctx.session.awaitingCustomQuantity;
    ctx.session = { ...ctx.session };

    // Ajouter au panier
    await handleAddToCart(ctx, productId, quantity);

    // Supprimer le message de demande de quantité
    try {
      await ctx.deleteMessage();
    } catch (error) {
      console.log('Impossible de supprimer le message de quantité');
    }

    return true;

  } catch (error) {
    console.error('❌ Erreur dans handleQuantityMessage:', error);
    
    // Nettoyer l'état d'attente en cas d'erreur
    if (ctx.session.awaitingCustomQuantity) {
      delete ctx.session.awaitingCustomQuantity;
      ctx.session = { ...ctx.session };
    }
    
    await ctx.reply('❌ Erreur lors du traitement de la quantité');
    return true; // Marquer comme traité pour éviter le menu principal
  }
}

module.exports = {
  handleAddToCart,
  handleCustomQuantity,
  showCart,
  clearCart,
  handleQuantityMessage
};
