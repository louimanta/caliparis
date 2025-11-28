const { Markup } = require('telegraf');
const { Order, Product, Customer, OrderItem } = require('../models');
const notificationService = require('./notificationService');

async function handleAdminCommands(ctx) {
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];

  if (!adminIds.includes(ctx.from.id.toString())) {
    return ctx.reply('❌ Accès réservé aux administrateurs');
  }

  await ctx.reply(
    '👨‍💼 *Panel Administrateur*\n\nChoisissez une action:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistiques', 'admin_stats')],
        [Markup.button.callback('📦 Commandes en attente', 'admin_pending_orders')],
        [Markup.button.callback('🛍️ Gérer produits', 'admin_products')],
        [Markup.button.callback('📈 Ventes aujourd\'hui', 'admin_sales_today')]
      ])
    }
  );
}

async function showAdminStats(ctx) {
  try {
    const totalOrders = await Order.count();
    const pendingOrders = await Order.count({ where: { status: 'pending' } });
    const totalProducts = await Product.count();
    const lowStockProducts = await Product.count({ where: { stock: { [Symbol.for('lt')]: 10 } } });

    const statsMessage = `
📊 *Statistiques CaliParis*

📦 Commandes totales: ${totalOrders}
⏳ Commandes en attente: ${pendingOrders}
🛍️ Produits actifs: ${totalProducts}
⚠️ Produits stock faible: ${lowStockProducts}

💎 *Actions rapides:*
/gestion - Gérer les commandes
/produits - Gérer les produits
    `;

    await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur stats admin:', error);
    await ctx.answerCbQuery('❌ Erreur statistiques');
  }
}

async function showPendingOrders(ctx) {
  try {
    const pendingOrders = await Order.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: Customer,
          attributes: ['firstName', 'lastName', 'username', 'telegramId']
        },
        {
          model: OrderItem,
          include: [Product]
        }
      ],
      order: [['createdAt', 'ASC']],
      limit: 10
    });

    if (pendingOrders.length === 0) {
      return ctx.reply('✅ Aucune commande en attente');
    }

    for (const order of pendingOrders) {
      const customer = order.Customer;
      const productsText = order.OrderItems.map(item => 
        `• ${item.Product?.name || 'Produit'} - ${item.quantity}g x ${item.unitPrice}€`
      ).join('\n');

      const message = `
📦 *Commande #${order.id}*
👤 Client: ${customer.firstName} ${customer.lastName} (@${customer.username})
📞 Contact: ${customer.telegramId}
💳 Paiement: ${order.paymentMethod}
💰 Total: ${order.totalAmount}€
⏰ Date: ${order.createdAt.toLocaleString('fr-FR')}

📋 Produits:
${productsText}

📍 Adresse:
${order.deliveryAddress}
      `.trim();

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Traitée', `admin_process_${order.id}`),
            Markup.button.callback('📞 Contacté', `admin_contact_${order.id}`)
          ],
          [Markup.button.callback('🚫 Annuler', `admin_cancel_${order.id}`)]
        ])
      });
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur commandes en attente:', error);
    await ctx.answerCbQuery('❌ Erreur chargement commandes');
  }
}

// Gestion des actions admin sur les commandes
async function handleOrderAction(ctx, orderId, action) {
  try {
    const order = await Order.findByPk(orderId, {
      include: [Customer]
    });
    
    if (!order) {
      return ctx.answerCbQuery('❌ Commande non trouvée');
    }

    let newStatus, message;
    
    switch (action) {
      case 'process':
        newStatus = 'confirmed';
        message = '✅ Commande marquée comme traitée';
        break;
      case 'contact':
        newStatus = 'confirmed';
        message = '✅ Commande marquée comme contactée';
        break;
      case 'cancel':
        newStatus = 'cancelled';
        message = '🚫 Commande annulée';
        break;
      default:
        return ctx.answerCbQuery('❌ Action non reconnue');
    }

    await order.update({ status: newStatus });
    await ctx.answerCbQuery(message);

    // Notifier le client si nécessaire
    if (action === 'process' || action === 'contact') {
      await notificationService.notifyOrderUpdate(ctx, order, order.Customer.telegramId, 'confirmed');
    } else if (action === 'cancel') {
      await notificationService.notifyOrderUpdate(ctx, order, order.Customer.telegramId, 'cancelled');
    }

  } catch (error) {
    console.error('❌ Erreur action admin:', error);
    await ctx.answerCbQuery('❌ Erreur lors de l\'action');
  }
}

module.exports = {
  handleAdminCommands,
  showAdminStats,
  showPendingOrders,
  handleOrderAction
};
