const { Markup } = require('telegraf');
const { Order, Product, Customer, OrderItem } = require('../models');
const { Op } = require('sequelize');

// Fonction utilitaire pour les opérations DB sécurisées
async function safeDbOperation(operation, fallback = null) {
  try {
    return await operation();
  } catch (error) {
    console.error('❌ Erreur DB:', error);
    return fallback;
  }
}

async function handleAdminCommands(ctx) {
  try {
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
          [Markup.button.callback('📈 Ventes aujourd\'hui', 'admin_sales_today')],
          [Markup.button.callback('🔍 Voir statuts', 'admin_show_statuses')]
        ])
      }
    );
  } catch (error) {
    console.error('❌ Erreur commandes admin:', error);
    await ctx.reply('❌ Erreur lors du chargement du panel admin');
  }
}

async function showAdminStats(ctx) {
  try {
    const totalOrders = await safeDbOperation(() => Order.count(), 0);
    const pendingOrders = await safeDbOperation(() => Order.count({ where: { status: 'pending' } }), 0);
    const totalProducts = await safeDbOperation(() => Product.count(), 0);
    const lowStockProducts = await safeDbOperation(() => Product.count({ where: { stock: { [Op.lt]: 10 } } }), 0);

    const statsMessage = `
📊 *Statistiques CaliParis*

📦 Commandes totales: ${totalOrders}
⏳ Commandes en attente: ${pendingOrders}
🛍️ Produits actifs: ${totalProducts}
⚠️ Produits stock faible: ${lowStockProducts}

💎 *Actions rapides:*
/gestion - Gérer les commandes
/produits - Gérer les produits
    `.trim();

    await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur stats admin:', error);
    await ctx.answerCbQuery('❌ Erreur statistiques');
  }
}

async function showPendingOrders(ctx) {
  try {
    const pendingOrders = await safeDbOperation(() => Order.findAll({
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
    }), []);

    if (!pendingOrders || pendingOrders.length === 0) {
      await ctx.reply('✅ Aucune commande en attente');
      return ctx.answerCbQuery();
    }

    for (const order of pendingOrders) {
      const customer = order.Customer || {};
      const productsText = order.OrderItems ? order.OrderItems.map(item => 
        `• ${item.Product?.name || 'Produit'} - ${item.quantity}g x ${item.unitPrice}€`
      ).join('\n') : 'Aucun produit';

      const message = `
📦 *Commande #${order.id}*
👤 Client: ${customer.firstName || ''} ${customer.lastName || ''} (@${customer.username || 'N/A'})
📞 Contact: ${customer.telegramId || 'N/A'}
💳 Paiement: ${order.paymentMethod || 'N/A'}
💰 Total: ${order.totalAmount || 0}€
⏰ Date: ${order.createdAt ? order.createdAt.toLocaleString('fr-FR') : 'N/A'}

📋 Produits:
${productsText}

📍 Adresse:
${order.deliveryAddress || 'Non spécifiée'}
      `.trim();

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Traitée', `admin_process_${order.id}`),
            Markup.button.callback('📞 Contact client', `admin_contact_${order.id}`)
          ],
          [Markup.button.callback('🚫 Annuler', `admin_cancel_${order.id}`)]
        ])
      });

      // Pause entre les messages
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur commandes en attente:', error);
    await ctx.answerCbQuery('❌ Erreur chargement commandes');
  }
}

// Fonction pour découvrir les statuts valides
async function showOrderStatuses(ctx) {
  try {
    // Récupérer tous les statuts uniques existants
    const orders = await safeDbOperation(() => Order.findAll({
      attributes: ['status'],
      group: ['status'],
      raw: true
    }), []);

    const statuses = orders.map(o => o.status);
    
    const message = `
🔍 *Statuts de commande disponibles:*

${statuses.length > 0 ? statuses.map(s => `• ${s}`).join('\n') : 'Aucun statut trouvé'}

💡 *Utilisez ces statuts dans le code:*
- pending: En attente
- processing: En traitement  
- completed: Terminée
- cancelled: Annulée
- delivered: Livrée
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur statuts:', error);
    await ctx.answerCbQuery('❌ Erreur récupération statuts');
  }
}

// Gestion des actions admin sur les commandes - VERSION CORRIGÉE
async function handleOrderAction(ctx, orderId, action) {
  try {
    const order = await safeDbOperation(() => Order.findByPk(orderId, {
      include: [Customer]
    }));
    
    if (!order) {
      return ctx.answerCbQuery('❌ Commande non trouvée');
    }

    let newStatus, message;
    
    // UTILISER LES STATUTS VALIDES DE VOTRE ENUM POSTGRESQL
    switch (action) {
      case 'process':
        newStatus = 'completed'; // Statut valide
        message = '✅ Commande marquée comme traitée';
        break;
      case 'contact':
        newStatus = 'processing'; // Statut valide pour "contacté"
        message = '✅ Commande marquée comme contactée';
        break;
      case 'cancel':
        newStatus = 'cancelled'; // Statut valide
        message = '🚫 Commande annulée';
        break;
      default:
        return ctx.answerCbQuery('❌ Action non reconnue');
    }

    console.log(`🔄 Mise à jour commande #${orderId}: ${order.status} → ${newStatus}`);

    await order.update({ status: newStatus });
    await ctx.answerCbQuery(message);

    // Notifier le client
    try {
      const customerMessage = `
🔄 *Mise à jour de votre commande #${order.id}*

📦 Statut: ${getStatusText(newStatus)}
💰 Montant: ${order.totalAmount}€

Merci pour votre confiance! 🌿
      `.trim();

      if (order.Customer && order.Customer.telegramId) {
        await ctx.telegram.sendMessage(order.Customer.telegramId, customerMessage, {
          parse_mode: 'Markdown'
        });
      }
    } catch (notifyError) {
      console.error('❌ Erreur notification client:', notifyError);
    }

  } catch (error) {
    console.error('❌ Erreur action admin:', error);
    
    // Message d'erreur plus détaillé
    if (error.name === 'SequelizeDatabaseError') {
      await ctx.answerCbQuery('❌ Erreur base de données - Statut invalide');
    } else {
      await ctx.answerCbQuery('❌ Erreur lors de l\'action');
    }
  }
}

// Fonction utilitaire pour le texte du statut
function getStatusText(status) {
  const statusMap = {
    'pending': '⏳ En attente',
    'processing': '📞 En traitement',
    'completed': '✅ Terminée',
    'cancelled': '🚫 Annulée',
    'delivered': '📦 Livrée',
    'confirmed': '✅ Confirmée',
    'contacted': '📞 Contacté'
  };
  return statusMap[status] || status;
}

// Gestion des produits
async function showProductManagement(ctx) {
  try {
    const products = await safeDbOperation(() => Product.findAll({
      order: [['id', 'ASC']]
    }), []);

    if (!products || products.length === 0) {
      return ctx.reply('📦 Aucun produit dans la base de données.');
    }

    let message = '🛍️ *Gestion des Produits*\n\n';
    products.forEach(product => {
      message += `ID: ${product.id} | ${product.isActive ? '✅' : '❌'} ${product.name}\n`;
      message += `💰 ${product.price}€ | Stock: ${product.stock}g\n\n`;
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Voir produits actifs', 'admin_active_products')],
      [Markup.button.callback('🚫 Désactiver produit', 'admin_disable_product')],
      [Markup.button.callback('✅ Activer produit', 'admin_enable_product')],
      [Markup.button.callback('🗑️ Supprimer produit', 'admin_delete_product')],
      [Markup.button.callback('⬅️ Retour admin', 'back_to_admin')]
    ]);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur gestion produits:', error);
    await ctx.answerCbQuery('❌ Erreur lors du chargement des produits.');
  }
}

// === FONCTIONS MANQUANTES POUR LA SUPPRESSION ===

async function disableProduct(ctx) {
  try {
    ctx.session.waitingForProductId = { action: 'disable' };
    
    await ctx.reply(
      '🚫 *Désactiver un produit*\n\n' +
      'Entrez l\'ID du produit à désactiver :\n' +
      '(Utilisez /cancel pour annuler)',
      { parse_mode: 'Markdown' }
    );
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur désactivation:', error);
    await ctx.answerCbQuery('❌ Erreur');
  }
}

async function enableProduct(ctx) {
  try {
    ctx.session.waitingForProductId = { action: 'enable' };
    
    await ctx.reply(
      '✅ *Activer un produit*\n\n' +
      'Entrez l\'ID du produit à activer :\n' +
      '(Utilisez /cancel pour annuler)',
      { parse_mode: 'Markdown' }
    );
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur activation:', error);
    await ctx.answerCbQuery('❌ Erreur');
  }
}

async function deleteProduct(ctx) {
  try {
    ctx.session.waitingForProductId = { action: 'delete' };
    
    await ctx.reply(
      '🗑️ *SUPPRIMER UN PRODUIT*\n\n' +
      '⚠️  *ATTENTION: Action irréversible!*\n\n' +
      'Entrez l\'ID du produit à supprimer :\n' +
      '(Utilisez /cancel pour annuler)',
      { parse_mode: 'Markdown' }
    );
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    await ctx.answerCbQuery('❌ Erreur');
  }
}

async function handleProductIdInput(ctx) {
  try {
    if (!ctx.session.waitingForProductId) return;

    const productId = parseInt(ctx.message.text);
    const action = ctx.session.waitingForProductId.action;
    
    if (isNaN(productId)) {
      return ctx.reply('❌ ID invalide. Entrez un nombre.');
    }

    const product = await safeDbOperation(() => Product.findByPk(productId));
    if (!product) {
      return ctx.reply('❌ Produit non trouvé.');
    }

    let resultMessage = '';

    switch (action) {
      case 'disable':
        await product.update({ isActive: false });
        resultMessage = `🚫 Produit "${product.name}" (ID: ${product.id}) désactivé.`;
        break;
      
      case 'enable':
        await product.update({ isActive: true });
        resultMessage = `✅ Produit "${product.name}" (ID: ${product.id}) activé.`;
        break;
      
      case 'delete':
        await product.destroy();
        resultMessage = `🗑️ Produit "${product.name}" (ID: ${product.id}) supprimé définitivement.`;
        break;
    }

    // Nettoyer la session
    delete ctx.session.waitingForProductId;
    
    await ctx.reply(resultMessage);

  } catch (error) {
    console.error('❌ Erreur traitement produit:', error);
    await ctx.reply('❌ Erreur lors du traitement.');
    delete ctx.session.waitingForProductId;
  }
}

// Commande d'annulation
async function cancelProductAction(ctx) {
  if (ctx.session && ctx.session.waitingForProductId) {
    delete ctx.session.waitingForProductId;
    await ctx.reply('✅ Action annulée.');
  }
}

// Ventes aujourd'hui
async function showSalesToday(ctx) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = await safeDbOperation(() => Order.findAll({
      where: {
        createdAt: {
          [Op.between]: [today, tomorrow]
        },
        status: ['completed', 'delivered'] // Commandes terminées ou livrées
      },
      include: [OrderItem]
    }), []);

    const totalSales = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = todayOrders.length;

    const message = `
📈 *Ventes Aujourd'hui*

📦 Commandes: ${totalOrders}
💰 Chiffre d'affaires: ${totalSales.toFixed(2)}€
🕒 Période: ${today.toLocaleDateString('fr-FR')}

${totalOrders > 0 ? '🎉 Bonne journée de vente!' : '📊 Aucune vente aujourd\'hui'}
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur ventes aujourd\'hui:', error);
    await ctx.answerCbQuery('❌ Erreur calcul des ventes');
  }
}

// Produits actifs
async function showActiveProducts(ctx) {
  try {
    const products = await safeDbOperation(() => Product.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    }), []);

    if (!products || products.length === 0) {
      return ctx.reply('📦 Aucun produit actif.');
    }

    let message = '✅ *Produits Actifs*\n\n';
    products.forEach(product => {
      message += `🛍️ ${product.name}\n`;
      message += `💰 ${product.price}€/g | Stock: ${product.stock}g\n`;
      message += `📝 ${product.description.substring(0, 50)}...\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('❌ Erreur produits actifs:', error);
    await ctx.answerCbQuery('❌ Erreur chargement produits');
  }
}

module.exports = {
  handleAdminCommands,
  showAdminStats,
  showPendingOrders,
  handleOrderAction,
  showProductManagement,
  showSalesToday,
  showActiveProducts,
  showOrderStatuses,
  // === AJOUT DES NOUVELLES FONCTIONS ===
  disableProduct,
  enableProduct,
  deleteProduct,
  handleProductIdInput,
  cancelProductAction
};
