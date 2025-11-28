
const { Product } = require('../models');

async function handleAddToCart(ctx, productId, quantity) {
  try {
    console.log(`🛍️ handleAddToCart - User: ${ctx.from.id}, Product: ${productId}, Qty: ${quantity}`);
    
    // Initialiser le panier si inexistant
    if (!ctx.session.cart) {
      ctx.session.cart = [];
      console.log('🆕 Panier initialisé');
    }
    
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new Error('Produit non trouvé');
    }
    
    // Vérifier si le produit est déjà dans le panier
    const existingItemIndex = ctx.session.cart.findIndex(item => item.productId === productId);
    
    if (existingItemIndex > -1) {
      // Mettre à jour la quantité
      ctx.session.cart[existingItemIndex].quantity += quantity;
      console.log(`📈 Quantité mise à jour: ${ctx.session.cart[existingItemIndex].quantity}`);
    } else {
      // Ajouter nouveau produit
      ctx.session.cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        addedAt: new Date()
      });
      console.log(`🆕 Produit ajouté: ${product.name}`);
    }
    
    // SAUVEGARDER EXPLICITEMENT LA SESSION
    ctx.session = { ...ctx.session };
    
    console.log(`📊 Panier après ajout:`, ctx.session.cart);
    
    await ctx.answerCbQuery(`✅ ${quantity}g de ${product.name} ajouté au panier!`);
    
  } catch (error) {
    console.error('❌ Erreur dans handleAddToCart:', error);
    throw error;
  }
}

async function handleCustomQuantity(ctx, productId) {
  try {
    console.log(`🔢 Quantité personnalisée pour produit: ${productId}`);
    
    const product = await Product.findByPk(productId);
    if (!product) {
      await ctx.answerCbQuery('❌ Produit non trouvé');
      return;
    }
    
    await ctx.reply(
      `🔢 *Quantité personnalisée - ${product.name}*\n\n` +
      `Entrez la quantité souhaitée (en grammes):\n` +
      `• Prix: ${product.price}€/g\n` +
      `• Exemple: 5 pour 5 grammes`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Annuler', callback_data: `cancel_custom_${productId}` }]
          ]
        }
      }
    );
    
    // Stocker le produit en attente de quantité
    ctx.session.pendingProduct = productId;
    ctx.session = { ...ctx.session };
    
  } catch (error) {
    console.error('❌ Erreur dans handleCustomQuantity:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la saisie de quantité');
  }
}

async function showCart(ctx) {
  try {
    console.log(`🛒 showCart - User: ${ctx.from.id}`);
    console.log(`📦 Contenu du panier:`, ctx.session.cart);
    
    // Vérifier si le panier existe et n'est pas vide
    if (!ctx.session.cart || ctx.session.cart.length === 0) {
      await ctx.reply(
        '🛒 *Votre panier est vide*\n\n' +
        'Ajoutez des produits depuis le catalogue 📦',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    let total = 0;
    let message = '🛒 *Votre Panier CaliParis*\n\n';
    
    for (const item of ctx.session.cart) {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      message += `• ${item.name} - ${item.quantity}g - ${itemTotal}€\n`;
    }
    
    message += `\n💶 *Total: ${total}€*\n\n`;
    message += 'Choisissez une action:';
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Continuer mes achats', callback_data: 'back_to_products' }],
          [{ text: '💰 Commander', callback_data: 'checkout' }],
          [{ text: '🗑️ Vider le panier', callback_data: 'clear_cart' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur dans showCart:', error);
    await ctx.reply('❌ Erreur lors du chargement du panier');
  }
}

async function clearCart(ctx) {
  try {
    console.log(`🗑️ clearCart - User: ${ctx.from.id}`);
    
    ctx.session.cart = [];
    ctx.session = { ...ctx.session };
    
    console.log('✅ Panier vidé avec succès');
    
    await ctx.reply(
      '🗑️ *Panier vidé*\n\n' +
      'Votre panier a été vidé avec succès!',
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('❌ Erreur dans clearCart:', error);
    await ctx.reply('❌ Erreur lors du vidage du panier');
  }
}

// Handler pour les messages de quantité personnalisée
async function handleQuantityMessage(ctx) {
  try {
    if (!ctx.session.pendingProduct) return false;
    
    const quantity = parseInt(ctx.message.text);
    if (isNaN(quantity) || quantity <= 0) {
      await ctx.reply('❌ Veuillez entrer un nombre valide (ex: 5)');
      return true;
    }
    
    const productId = ctx.session.pendingProduct;
    delete ctx.session.pendingProduct;
    
    await handleAddToCart(ctx, productId, quantity);
    
    // Supprimer le message de demande de quantité
    await ctx.deleteMessage();
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur dans handleQuantityMessage:', error);
    await ctx.reply('❌ Erreur lors de l\'ajout de la quantité');
    return true;
  }
}

module.exports = {
  handleAddToCart,
  handleCustomQuantity,
  showCart,
  clearCart,
  handleQuantityMessage
};
