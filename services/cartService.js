const { Cart, Product } = require('../models');

class CartService {
  async getCart(userId) {
    let cart = await Cart.findOne({ where: { telegramId: userId } });
    
    if (!cart) {
      cart = await Cart.create({
        telegramId: userId,
        items: [],
        totalAmount: 0,
        lastActivity: new Date()
      });
    }
    
    return cart;
  }

  async addToCart(userId, product, quantity) {
    const cart = await this.getCart(userId);
    const existingItemIndex = cart.items.findIndex(item => item.productId === product.id);

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].quantity * product.price;
    } else {
      cart.items.push({
        productId: product.id,
        name: product.name,
        quantity: quantity,
        unitPrice: product.price,
        totalPrice: quantity * product.price
      });
    }

    cart.totalAmount = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.lastActivity = new Date();
    
    await cart.save();
    return cart;
  }

  async removeFromCart(userId, productId) {
    const cart = await this.getCart(userId);
    cart.items = cart.items.filter(item => item.productId !== productId);
    cart.totalAmount = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.lastActivity = new Date();
    
    await cart.save();
    return cart;
  }

  async updateQuantity(userId, productId, quantity) {
    const cart = await this.getCart(userId);
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (itemIndex > -1) {
      if (quantity <= 0) {
        return this.removeFromCart(userId, productId);
      }
      
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].totalPrice = quantity * cart.items[itemIndex].unitPrice;
      cart.totalAmount = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
      cart.lastActivity = new Date();
      
      await cart.save();
    }
    
    return cart;
  }

  async clearCart(userId) {
    const cart = await this.getCart(userId);
    cart.items = [];
    cart.totalAmount = 0;
    cart.lastActivity = new Date();
    
    await cart.save();
    return cart;
  }

  async getCartSize(userId) {
    const cart = await this.getCart(userId);
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  async getCartSummary(userId) {
    const cart = await this.getCart(userId);
    return {
      itemCount: cart.items.length,
      totalQuantity: await this.getCartSize(userId),
      total: cart.totalAmount,
      items: cart.items
    };
  }

  // Nettoyer les paniers anciens (24h+)
  async cleanupOldCarts() {
    const { Op } = require('sequelize');
    const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    await Cart.destroy({
      where: {
        lastActivity: {
          [Op.lt]: twentyFourHoursAgo
        }
      }
    });
  }
}

module.exports = new CartService();
