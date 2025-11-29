// adminHandler.js - Version corrigée avec gestion de session
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

// Fonction utilitaire pour initialiser la session
function ensureSession(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }
  return ctx.session;
}

async function disableProduct(ctx) {
  try {
    const session = ensureSession(ctx);
    session.waitingForProductId = { action: 'disable' };
    
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
    const session = ensureSession(ctx);
    session.waitingForProductId = { action: 'enable' };
    
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
    const session = ensureSession(ctx);
    session.waitingForProductId = { action: 'delete' };
    
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
    const session = ensureSession(ctx);
    if (!session.waitingForProductId) return;

    const productId = parseInt(ctx.message.text);
    const action = session.waitingForProductId.action;
    
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
    delete session.waitingForProductId;
    
    await ctx.reply(resultMessage);

  } catch (error) {
    console.error('❌ Erreur traitement produit:', error);
    await ctx.reply('❌ Erreur lors du traitement.');
    const session = ensureSession(ctx);
    delete session.waitingForProductId;
  }
}

// Commande d'annulation
async function cancelProductAction(ctx) {
  const session = ensureSession(ctx);
  if (session.waitingForProductId) {
    delete session.waitingForProductId;
    await ctx.reply('✅ Action annulée.');
  }
}

// ... (le reste des fonctions adminHandler.js reste inchangé)
