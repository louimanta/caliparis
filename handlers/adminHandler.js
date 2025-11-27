const { Markup } = require('telegraf');
const { Order, Product } = require('../models');

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
    const lowStockProducts = await Product.count({ where: { stock: { $lt: 10 } } });

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
      order: [['createdAt', 'ASC']],
      limit: 10
    });

    if (pendingOrders.length === 0) {
      return ctx.reply('✅ Aucune commande en attente');
    }

    for (const order of pendingOrders) {
      const productsText = order.products.map(p =>
        `• ${p.product?.name || 'Produit'} - ${p.quantity}g x ${p.product?.price || 0}€`
      ).join('\n');

      const message = `
📦 *Commande #${order.id}*
👤 Client: ${order.customerName} (${order.customerId})
📞 Contact: ${order.contactInfo}
💳 Paiement: ${order.paymentMethod}
💰 Total: ${order.total}€
⏰ Date: ${order.createdAt.toLocaleString('fr-FR')}

📋 Produits:
${productsText}

📍 Adresse:
${order.address}
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
    const order = await Order.findByPk(orderId);
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
      try {
        await ctx.telegram.sendMessage(
          order.customerId,
          `📦 *Mise à jour de votre commande #${order.id}*\n\n` +
          `✅ Votre commande a été traitée et sera expédiée prochainement.\n\n` +
          `Merci pour votre confiance ! 🌿`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('❌ Erreur notification client:', error);
      }
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