// services/notificationService.js
const { Telegraf } = require('telegraf');

class NotificationService {
    constructor() {
        this.bot = null;
    }

    // Méthode pour initialiser avec le bot principal
    setBot(botInstance) {
        this.bot = botInstance;
    }

    async notifyAdmins(message) {
        try {
            if (!this.bot) {
                console.error('❌ Bot non initialisé dans le service de notification');
                return false;
            }

            console.log('📤 Envoi notification aux admins...');
            
            const adminIds = process.env.ADMIN_IDS ? 
                process.env.ADMIN_IDS.split(',').map(id => id.trim()) : 
                ['7965350707', '8442884695'];

            console.log(`👥 Admins à notifier: ${adminIds}`);

            let notificationsSent = 0;

            for (const adminId of adminIds) {
                try {
                    await this.bot.telegram.sendMessage(adminId, message, {
                        parse_mode: 'Markdown'
                    });
                    console.log(`✅ Notification envoyée à l'admin: ${adminId}`);
                    notificationsSent++;
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.error(`❌ Erreur envoi admin ${adminId}:`, error.message);
                }
            }

            console.log(`📊 Notifications envoyées: ${notificationsSent}/${adminIds.length}`);
            return notificationsSent > 0;

        } catch (error) {
            console.error('❌ Erreur générale notification:', error);
            return false;
        }
    }

    // Méthode pour formater les messages de commande
    formatOrderMessage(order, user, cartItems) {
        const username = user.username ? `@${user.username}` : user.first_name;
        const userId = user.id;
        
        let productsText = '';
        if (cartItems && cartItems.length > 0) {
            cartItems.forEach(item => {
                const itemTotal = parseFloat(item.price) * item.quantity;
                productsText += `• ${item.name} - ${item.quantity}x - ${itemTotal}€\n`;
            });
        } else {
            productsText = '• Aucun produit trouvé\n';
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');

        return `🆕 *NOUVELLE COMMANDE #${order.id}* 🆕\n\n` +
            `👤 *CLIENT:* ${username}\n` +
            `🔢 *ID:* ${userId}\n` +
            `📞 *CONTACT:* https://t.me/${user.username || user.id}\n\n` +
            `📦 *PRODUITS COMMANDÉS:*\n${productsText}\n` +
            `💶 *TOTAL: ${order.totalAmount}€*\n` +
            `💳 *MODE DE PAIEMENT:* ${order.paymentMethod}\n` +
            `🕒 *DATE:* ${dateStr} ${timeStr}\n\n` +
            `📍 *ZONE:* Paris et banlieue\n` +
            `🚚 *LIVRAISON:* 2h-4h\n\n` +
            `⚡ *ACTION RAPIDE:*\n` +
            `📞 Contacter: tg://user?id=${userId}`;
    }

    // Méthode pour formater les demandes de remise
    formatDiscountMessage(user, cartItems, totalQuantity, total) {
        const username = user.username ? `@${user.username}` : user.first_name;
        
        let productsText = '';
        if (cartItems && cartItems.length > 0) {
            cartItems.forEach(item => {
                const itemTotal = parseFloat(item.price) * item.quantity;
                productsText += `• ${item.name} - ${item.quantity}g - ${itemTotal}€\n`;
            });
        }

        return `💎 *DEMANDE DE REMISE - GROS* 💎\n\n` +
            `👤 *CLIENT:* ${username} (${user.id})\n` +
            `📞 *CONTACT:* https://t.me/${user.username || user.id}\n\n` +
            `📦 *PRODUITS:*\n${productsText}\n` +
            `⚖️ *QUANTITÉ TOTALE:* ${totalQuantity}g\n` +
            `💶 *TOTAL NORMAL:* ${total}€\n\n` +
            `📍 *ACTION:* Contacter pour négocier remise\n` +
            `📞 *LIEN:* tg://user?id=${user.id}`;
    }
}

// Créer une instance unique
const notificationService = new NotificationService();

module.exports = notificationService;
