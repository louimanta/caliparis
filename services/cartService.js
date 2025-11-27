const userCarts = new Map();

class CartService {
  getCart(userId) {
    if (!userCarts.has(userId)) {
      userCarts.set(userId, { 
        items: [], 
        total: 0, 
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    return userCarts.get(userId);
  }

  addToCart(userId, product, quantity) {
    const cart = this.getCart(userId);
    const existingItem = cart.items.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ 
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image
        }, 
        quantity 
      });
    }

    this.calculateTotal(cart);
    cart.updatedAt = new Date();
    
    return cart;
  }

  removeFromCart(userId, productId) {
    const cart = this.getCart(userId);
    cart.items = cart.items.filter(item => item.product.id !== productId);
    this.calculateTotal(cart);
    cart.updatedAt = new Date();
    
    return cart;
  }

  updateQuantity(userId, productId, quantity) {
    const cart = this.getCart(userId);
    const item = cart.items.find(item => item.product.id === productId);
    
    if (item) {
      if (quantity <= 0) {
        return this.removeFromCart(userId, productId);
      }
      item.quantity = quantity;
      this.calculateTotal(cart);
      cart.updatedAt = new Date();
    }
    
    return cart;
  }

  calculateTotal(cart) {
    cart.total = cart.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);
  }

  clearCart(userId) {
    userCarts.delete(userId);
  }

  getCartSize(userId) {
    const cart = this.getCart(userId);
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getCartSummary(userId) {
    const cart = this.getCart(userId);
    return {
      itemCount: cart.items.length,
      totalQuantity: this.getCartSize(userId),
      total: cart.total,
      items: cart.items
    };
  }

  // Nettoyer les paniers anciens (24h+)
  cleanupOldCarts() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    for (const [userId, cart] of userCarts.entries()) {
      if (cart.updatedAt < twentyFourHoursAgo) {
        userCarts.delete(userId);
      }
    }
  }
}

module.exports = new CartService();
