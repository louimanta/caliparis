const { Markup } = require('telegraf');
const bot = require('../bot');

class NotificationService {
  async notifyAdmin(order) {
    try {
      const productsText = order.products.map(p =>
        `• ${p.product?.name || 'Produit'} - ${p.quantity}g x ${p.product?.price || 0}€`
      ).join('\n');

      const totalGrams = order.products.reduce((sum, p) => sum + p.quantity, 0);

      const message = `
🆕 *NOUVELLE COMMANDE CaliParis* 🆕

📦 Commande #${order.id}
👤 Client: ${order.customerName} (${order.customerId})
📞 Contact: ${order.contactInfo}
💳 Paiement: ${order.paymentMethod}
💰 Total: ${order.total}€
📦 Grammes: ${totalGrams}g
⏰ Date: ${order.createdAt.toLocaleString('fr-FR')}

📋 Produits:
${productsText}

📍 Adresse:
${order.address}
      `.trim();

      await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Traitée', `admin_process_${order.id}`),
            Markup.button.callback('📞 Contacté', `admin_contact_${order.id}`)
          ],
          [
            Markup.button.callback('🚫 Annuler', `admin_cancel_${order.id}`),
            Markup.button.url('📞 Contacter', `tg://user?id=${order.customerId}`)
          ]
        ])
      });

      console.log(`✅ Notification admin envoyée pour commande #${order.id}`);
    } catch (error) {
      console.error('❌ Erreur notification admin:', error);
    }
  }

  async notifyDiscountRequest(userId, cart, totalGrams) {
    try {
      const productsText = cart.items.map(p =>
        `• ${p.product.name} - ${p.quantity}g x ${p.product.price}€`
      ).join('\n');

      const message = `
💎 *DEMANDE REMISE GROS* 💎

👤 Client: ${userId}
📦 Quantité totale: ${totalGrams}g
💰 Total normal: ${cart.total}€

📋 Produits:
${productsText}

⚡ *CONTACTER RAPIDEMENT POUR OFFRE PERSONNALISÉE!*
      `.trim();

      await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message, {
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

  async notifyLowStock(product) {
    try {
      const message = `
⚠️ *STOCK FAIBLE* ⚠️

🛍️ Produit: ${product.name}
📦 Stock actuel: ${product.stock}g
💰 Prix: ${product.price}€

Il est temps de réapprovisionner!
      `.trim();

      await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown'
      });

      console.log(`✅ Notification stock faible pour ${product.name}`);
    } catch (error) {
      console.error('❌ Erreur notification stock faible:', error);
    }
  }

  async notifyOrderUpdate(order, updateType) {
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

      await bot.telegram.sendMessage(order.customerId, message, {
        parse_mode: 'Markdown'
      });

      console.log(`✅ Notification mise à jour envoyée pour commande #${order.id}`);
    } catch (error) {
      console.error('❌ Erreur notification mise à jour:', error);
    }
  }
}

module.exports = new NotificationService();