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
    
    // ✅ CORRECTION : FORCER la conversion en array à la lecture
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

    // ✅ CORRECTION : SAUVEGARDER l'array converti
    cart.items = currentItems;
    cart.totalAmount = currentItems.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.lastActivity = new Date();
    
    console.log(`💾 Sauvegarde panier...`);
    console.log(`📦 Items après:`, cart.items);
    console.log(`💰 Total:`, cart.totalAmount);
    
    const saved = await safeDbOperation(() => cart.save());
    console.log(`✅ Panier sauvegardé:`, saved ? 'OUI' : 'NON');
    
    await ctx.answerCbQuery(`✅ ${quantity}g ajouté au panier`);
    await ctx.reply(`🛒 ${quantity}g de "${product.name}" ajouté au panier!`);
    
    console.log(`🎉 handleAddToCart TERMINÉ avec succès`);
    
  } catch (error) {
    console.error('💥 ERREUR CRITIQUE handleAddToCart:', error);
    console.error('Stack:', error.stack);
    await ctx.answerCbQuery('❌ Erreur ajout panier');
  }
}
