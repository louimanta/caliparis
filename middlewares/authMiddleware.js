const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];

function isAdmin(ctx, next) {
  if (ADMIN_IDS.includes(ctx.from.id.toString())) {
    return next();
  }
  
  // Si ce n'est pas un admin, répondre avec un message d'erreur
  if (ctx.callbackQuery) {
    return ctx.answerCbQuery('❌ Accès réservé aux administrateurs');
  }
  
  return ctx.reply('❌ Accès réservé aux administrateurs');
}

function isUser(ctx, next) {
  // Vérification basique que c'est un utilisateur Telegram valide
  if (ctx.from && ctx.from.id) {
    return next();
  }
  
  return ctx.reply('❌ Utilisateur non identifié');
}

function logUserAction(ctx, next) {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'no-username';
  const action = ctx.message?.text || ctx.callbackQuery?.data || 'unknown';
  
  console.log(`👤 User ${userId} (${username}) - Action: ${action}`);
  return next();
}

function rateLimit(limit = 10, windowMs = 60000) {
  const requests = new Map();
  
  return (ctx, next) => {
    const userId = ctx.from.id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Nettoyer les vieilles requêtes
    for (const [id, timestamps] of requests.entries()) {
      requests.set(id, timestamps.filter(time => time > windowStart));
      if (requests.get(id).length === 0) {
        requests.delete(id);
      }
    }
    
    // Vérifier la limite
    const userRequests = requests.get(userId) || [];
    if (userRequests.length >= limit) {
      if (ctx.callbackQuery) {
        return ctx.answerCbQuery('⚠️ Trop de requêtes. Attendez un moment.');
      }
      return ctx.reply('⚠️ Trop de requêtes. Veuillez attendre un moment.');
    }
    
    // Ajouter la nouvelle requête
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    return next();
  };
}

module.exports = {
  isAdmin,
  isUser,
  logUserAction,
  rateLimit
};
