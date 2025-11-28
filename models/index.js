const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Configuration robuste de la base de données
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
    evict: 10000
  },
  retry: {
    max: 3,
    match: [
      /ConnectionError/,
      /Connection terminated/,
      /ECONNRESET/,
      /SequelizeConnectionError/
    ]
  }
});

// Fonction de reconnexion automatique
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function setupConnectionHandlers() {
  sequelize.connectionManager.initPools();

  sequelize.connectionManager.on('disconnect', () => {
    console.log('🔄 Déconnexion de la base de données détectée');
  });

  sequelize.connectionManager.on('reconnect', () => {
    console.log('✅ Reconnexion à la base de données réussie');
    reconnectAttempts = 0;
  });
}

// Test de connexion avec retry
async function testConnectionWithRetry() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie');
    reconnectAttempts = 0;
    return true;
  } catch (error) {
    reconnectAttempts++;
    console.error(`❌ Tentative de connexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} échouée:`, error.message);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`🔄 Nouvelle tentative dans 5 secondes...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return testConnectionWithRetry();
    } else {
      console.error('❌ Échec de toutes les tentatives de connexion');
      return false;
    }
  }
}

// Modèle Product
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  videoUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'general'
  }
});

// Modèle Customer
const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegramId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

// Modèle Order
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'cancelled'),
    defaultValue: 'pending'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.ENUM('crypto', 'cash'),
    allowNull: false
  },
  paymentDetails: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customerNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  discountRequested: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  discountApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  finalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
});

// Modèle OrderItem
const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
});

// Modèle Cart
const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegramId: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  items: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  lastActivity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Relations
Customer.hasMany(Order, { foreignKey: 'customerId' });
Order.belongsTo(Customer, { foreignKey: 'customerId' });

Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

Product.hasMany(OrderItem, { foreignKey: 'productId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

// Synchronisation robuste de la base de données
async function syncDatabase() {
  try {
    const isConnected = await testConnectionWithRetry();
    
    if (!isConnected) {
      console.log('⚠️  Mode dégradé: fonctionnement sans base de données');
      return false;
    }
    
    await setupConnectionHandlers();
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: false });
      console.log('✅ Modèles synchronisés');
    } else {
      // En production, on utilise sync sans force
      await sequelize.sync();
      console.log('✅ Modèles synchronisés en production');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur de synchronisation de la base de données:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  Sequelize,
  Product,
  Customer,
  Order,
  OrderItem,
  Cart,
  syncDatabase,
  testConnectionWithRetry
};
