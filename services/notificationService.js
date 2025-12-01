const { Markup } = require('telegraf');

class NotificationService {
  async notifyAdmin(ctx, order, customer, cart) {
    try {
      console.log('🎯 notifyAdmin appelée');
      console.log('📦 Paramètre cart:', typeof cart, cart);
      
      // Vérifier si cart est un objet avec items ou si c'est directement les items
      let items = [];
      
      if (cart && Array.isArray(cart)) {
        // Si cart est déjà un tableau (ancien format)
        items = cart;
      } else if (cart && cart.items && Array.isArray(cart.items)) {
        // Si cart est un objet avec propriété items (nouveau format)
        items = cart.items;
      } else if (cart && Array.isArray(cart)) {
        // Backup
        items = cart;
      } else {
        console.error('❌ Format cart invalide:', cart);
        return;
      }
      
      console.log(`📋 Items trouvés: ${items.length}`);

      const productsText = items.map(item => 
        `• ${item.name} - ${item.quantity}g x ${item.unitPrice}€`
      ).join('\n');

      const totalGrams = items.reduce((sum, item) => sum + item.quantity, 0);

      const message = `
🆕 *NOUVELLE COMMANDE CaliParis* 🆕

📦 Commande #${order.id}
👤 Client: ${customer.firstName || ''} ${customer.lastName || ''} (@${customer.username || 'N/A'})
📞 Telegram: ${customer.telegramId}
💳 Paiement: ${order.paymentMethod}
💰 Total: ${order.totalAmount}€
📦 Grammes: ${totalGrams}g
⏰ Date: ${order.createdAt.toLocaleString('fr-FR')}

📋 Produits:
${productsText}

📍 Adresse:
${order.deliveryAddress || 'À confirmer'}
      `.trim();

      // FORÇAGE: Utiliser directement l'ID hardcodé temporairement
      const adminChatId = 7965350707; // Votre ID
      
      console.log(`📞 Envoi à admin ID: ${adminChatId}`);
      
      // Envoi simple sans boutons d'abord
      await ctx.telegram.sendMessage(adminChatId, message, {
        parse_mode: 'Markdown'
      });
      
      console.log(`✅ Notification envoyée pour commande #${order.id}`);

    } catch (error) {
      console.error('💥 ERREUR notification admin:', error.message);
      console.error('Stack:', error.stack);
    }
  }
  
  async notifyDiscountRequest(ctx, userId, cart, totalGrams) {
    try {
      console.log('💎 notifyDiscountRequest appelée');
      
      // Même logique de gestion des formats
      let items = [];
      
      if (cart && Array.isArray(cart)) {
        items = cart;
      } else if (cart && cart.items && Array.isArray(cart.items)) {
        items = cart.items;
      }
      
      const productsText = items.map(item => 
        `• ${item.name} - ${item.quantity}g x ${item.unitPrice}€`
      ).join('\n');

      const message = `
💎 *DEMANDE REMISE GROS* 💎

👤 Client: ${userId}
📦 Quantité totale: ${totalGrams}g
💰 Total normal: ${cart.totalAmount || 0}€

📋 Produits:
${productsText}

⚡ *CONTACTER RAPIDEMENT POUR OFFRE PERSONNALISÉE!*
      `.trim();

      const adminChatId = 7965350707; // Votre ID
      
      await ctx.telegram.sendMessage(adminChatId, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('📞 Contacter maintenant', `tg://user?id=${userId}`)]
        ])
      });

      console.log(`✅ Notification remise envoyée pour client ${userId}`);
    } catch (error) {
      console.error('❌ Erreur notification remise:', error.message);
    }
  }

  // ... autres fonctions peuvent rester inchangées pour l'instant ...
}

module.exports = new NotificationService();
