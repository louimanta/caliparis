const { Markup } = require('telegraf');

class NotificationService {
  async notifyAdmin(ctx, order, customer, cart) {
    try {
      const productsText = cart.items.map(item => 
        `• ${item.name} - ${item.quantity}g x ${item.unitPrice}€`
      ).join('\n');

      const totalGrams = cart.items.reduce((sum, item) => sum + item.quantity, 0);

      const message = `
🆕 *NOUVELLE COMMANDE CaliParis* 🆕

📦 Commande #${order.id}
👤 Client: ${customer.firstName} ${customer.lastName} (@${customer.username})
📞 Telegram: ${customer.telegramId}
💳 Paiement: ${order.paymentMethod}
💰 Total: ${order.totalAmount}€
📦 Grammes: ${totalGrams}g
⏰ Date: ${order.createdAt.toLocaleString('fr-FR')}

📋 Produits:
${productsText}

📍 Adresse:
${order.deliveryAddress}
      `.trim();

      await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Traitée', `admin_process_${order.id}`),
            Markup.button.callback('📞 Contacté', `admin_contact_${order.id}`)
          ],
          [
            Markup.button.callback('🚫 Annuler', `admin_cancel_${order.id}`),
            Markup.button.url('📞 Contacter', `tg://user?id=${customer.telegramId}`)
          ]
        ])
      });

      console.log(`✅ Notification admin envoyée pour commande #${order.id}`);
    } catch (error) {
      console.error('❌ Erreur notification admin:', error);
    }
  }

  async notifyDiscountRequest(ctx, userId, cart, totalGrams) {
    try {
      const productsText = cart.items.map(item => 
        `• ${item.name} - ${item.quantity}g x ${item.unitPrice}€`
      ).join('\n');

      const message = `
💎 *DEMANDE REMISE GROS* 💎

👤 Client: ${userId}
📦 Quantité totale: ${totalGrams}g
💰 Total normal: ${cart.totalAmount}€

📋 Produits:
${productsText}

⚡ *CONTACTER RAPIDEMENT POUR OFFRE PERSONNALISÉE!*
      `.trim();

      await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('📞 Contacter maintenant', `tg://user?id=${userId}`)]
        ])
      });

      console.log(`✅ Notification remise envoyée pour client ${userId}`);
    } catch (error) {
      console.error('❌ Erreur notification remise:', error);
    }
  }

  async notifyLowStock(ctx, product) {
    try {
      const message = `
⚠️ *STOCK FAIBLE* ⚠️

🛍️ Produit: ${product.name}
📦 Stock actuel: ${product.stock}g
💰 Prix: ${product.price}€

Il est temps de réapprovisionner!
      `.trim();

      await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown'
      });

      console.log(`✅ Notification stock faible pour ${product.name}`);
    } catch (error) {
      console.error('❌ Erreur notification stock faible:', error);
    }
  }

  async notifyOrderUpdate(ctx, order, customerId, updateType) {
    try {
      let message = '';

      switch (updateType) {
        case 'confirmed':
          message = `✅ Votre commande #${order.id} a été confirmée et sera expédiée prochainement.`;
          break;
        case 'shipped':
          message = `🚚 Votre commande #${order.id} a été expédiée. Livraison imminente!`;
          break;
        case 'cancelled':
          message = `❌ Votre commande #${order.id} a été annulée. Contactez-nous pour plus d'informations.`;
          break;
        default:
          return;
      }

      await ctx.telegram.sendMessage(customerId, message, {
        parse_mode: 'Markdown'
      });

      console.log(`✅ Notification mise à jour envoyée pour commande #${order.id}`);
    } catch (error) {
      console.error('❌ Erreur notification mise à jour:', error);
    }
  }
}

module.exports = new NotificationService();
