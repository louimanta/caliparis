const { Sequelize, DataTypes } = require('sequelize');

// Configuration PostgreSQL pour Render
function createDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL manquante dans les variables d\'environnement');
    return null;
  }

  console.log('🔗 Configuration de la connexion PostgreSQL...');
  
  const sequelize = new Sequelize(databaseUrl, {
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
      evict: 15000
    },
    retry: {
      max: 5,
      timeout: 60000,
      match: [
        /ConnectionError/,
        /Connection terminated/,
        /ECONNRESET/,
        /SequelizeConnectionError/,
        /getaddrinfo ENOTFOUND/,
        /Connection refused/
      ]
    }
  });

  return sequelize;
}

// Créer l'instance Sequelize
const sequelize = createDatabaseConnection();

if (!sequelize) {
  console.error('❌ Impossible de créer la connexion à la base de données');
  process.exit(1);
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

// Test de connexion robuste
async function testConnection() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`🔄 Tentative de connexion ${attempts}/${maxAttempts}...`);
      
      await sequelize.authenticate();
      console.log('✅ Connexion PostgreSQL établie avec succès!');
      return true;
      
    } catch (error) {
      console.error(`❌ Tentative ${attempts} échouée:`, error.message);
      
      if (attempts < maxAttempts) {
        const delay = Math.min(attempts * 2000, 10000); // Backoff exponentiel
        console.log(`⏳ Nouvelle tentative dans ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Échec de toutes les tentatives de connexion');
        return false;
      }
    }
  }
}

// Synchronisation de la base de données
async function syncDatabase() {
  try {
    const isConnected = await testConnection();
    
    if (!isConnected) {
      console.log('⚠️  Mode dégradé: fonctionnement sans base de données');
      return false;
    }
    
    // Synchronisation en production (safe)
    if (process.env.NODE_ENV === 'production') {
      await sequelize.sync({ alter: false });
      console.log('✅ Modèles synchronisés (production safe)');
    } else {
      await sequelize.sync({ force: false });
      console.log('✅ Modèles synchronisés (développement)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur de synchronisation:', error);
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
  testConnection
};
