const { Cart, Product } = require('../models');

async function handleAddToCart(ctx, productId, quantity) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      return ctx.answerCbQuery('❌ Produit non trouvé');
    }

    if (product.stock < quantity) {
      return ctx.answerCbQuery('❌ Stock insuffisant');
    }

    let cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart) {
      cart = await Cart.create({
        telegramId: ctx.from.id,
        items: [],
        totalAmount: 0
      });
    }

    // Vérifier si cart.items existe, sinon initialiser
    if (!cart.items) {
      cart.items = [];
    }

    const existingItemIndex = cart.items.findIndex(item => item.productId == productId);
    
    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].quantity * product.price;
    } else {
      cart.items.push({
        productId: productId,
        name: product.name,
        quantity: quantity,
        unitPrice: product.price,
        totalPrice: quantity * product.price
      });
    }

    cart.totalAmount = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.lastActivity = new Date();
    
    await cart.save();
    
    await ctx.answerCbQuery(`✅ ${quantity}g ajouté au panier`);
    await ctx.reply(`🛒 ${quantity}g de "${product.name}" ajouté au panier!`);
    
  } catch (error) {
    console.error('Erreur ajout panier:', error);
    await ctx.answerCbQuery('❌ Erreur ajout panier');
  }
}

async function handleCustomQuantity(ctx, productId) {
  try {
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
    if (!ctx.session) {
      ctx.session = {};
    }
    ctx.session.waitingForCustomQuantity = {
      productId: productId,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('Erreur quantité personnalisée:', error);
    await ctx.answerCbQuery('❌ Erreur lors de la saisie');
  }
}

async function handleCustomQuantityResponse(ctx) {
  try {
    if (!ctx.session || !ctx.session.waitingForCustomQuantity) {
      await ctx.reply('❌ Session expirée, veuillez recommencer');
      return;
    }

    const quantity = parseFloat(ctx.message.text);
    const productId = ctx.session.waitingForCustomQuantity.productId;

    if (isNaN(quantity) || quantity <= 0) {
      await ctx.reply('❌ Veuillez entrer un nombre valide (ex: 5 pour 5 grammes)');
      return;
    }

    // Vérifier le stock
    const product = await Product.findByPk(productId);
    if (!product) {
      await ctx.reply('❌ Produit non trouvé');
      return;
    }

    if (product.stock < quantity) {
      await ctx.reply(`❌ Stock insuffisant. Stock disponible: ${product.stock}g`);
      return;
    }

    // Supprimer l'état d'attente
    delete ctx.session.waitingForCustomQuantity;

    // Ajouter au panier
    await handleAddToCart(ctx, productId, quantity);
    
  } catch (error) {
    console.error('Erreur réponse quantité:', error);
    await ctx.reply('❌ Erreur lors du traitement de la quantité');
  }
}

async function showCart(ctx) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!cart || !cart.items || cart.items.length === 0) {
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

    let message = '🛒 *Votre Panier*\n\n';
    let totalAmount = 0;

    for (const item of cart.items) {
      const product = await Product.findByPk(item.productId);
      if (product) {
        message += `🌿 ${product.name}\n`;
        message += `   📦 Quantité: ${item.quantity}g\n`;
        message += `   💰 Prix: ${item.totalPrice}€\n\n`;
        totalAmount += item.totalPrice;
      }
    }

    message += `💵 *Total: ${totalAmount}€*`;

    // Appliquer remise automatique pour grosses quantités
    const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    let discountMessage = '';

    if (totalQuantity >= 30) {
      discountMessage = '\n\n💎 *Remise Gros Quantité Activée!*';
      const discount = totalQuantity >= 100 ? 20 : totalQuantity >= 50 ? 15 : 10;
      message += discountMessage;
      message += `\n📦 Quantité totale: ${totalQuantity}g`;
      message += `\n🎁 Remise: ${discount}% appliquée`;
      
      // Calculer le prix après remise
      const discountedAmount = totalAmount * (1 - discount/100);
      message += `\n💵 *Total après remise: ${discountedAmount.toFixed(2)}€*`;
    } else if (totalQuantity >= 20) {
      discountMessage = '\n\n💡 *Ajoutez 10g de plus pour une remise de 10%!*';
      message += discountMessage;
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
    
  } catch (error) {
    console.error('Erreur affichage panier:', error);
    await ctx.reply('❌ Erreur lors du chargement du panier');
  }
}

async function clearCart(ctx) {
  try {
    const cart = await Cart.findOne({ where: { telegramId: ctx.from.id } });
    if (cart) {
      cart.items = [];
      cart.totalAmount = 0;
      await cart.save();
    }
    await ctx.reply('✅ Panier vidé avec succès');
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
  clearCart 
};
