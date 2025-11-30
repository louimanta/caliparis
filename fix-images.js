// fix-images.js
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// Configuration Railway PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

// Modèle Product
const Product = sequelize.define('Product', {
  name: DataTypes.STRING,
  description: DataTypes.TEXT,
  price: DataTypes.FLOAT,
  imageUrl: DataTypes.STRING,
  videoUrl: DataTypes.STRING,
  isActive: DataTypes.BOOLEAN,
  category: DataTypes.STRING,
  quality: DataTypes.STRING
}, { tableName: 'Products' });

async function fixAllProducts() {
  try {
    console.log('🔧 Connexion à la base de données Railway...');
    await sequelize.authenticate();
    console.log('✅ Connecté à la DB Railway');
    
    const products = await Product.findAll();
    console.log(`📦 ${products.length} produits à traiter...`);
    
    let fixedCount = 0;
    
    for (const product of products) {
      console.log(`🔍 Traitement: ${product.name} (ID: ${product.id})`);
      
      let needsUpdate = false;
      
      // Vérifier et corriger imageUrl
      if (product.imageUrl && product.imageUrl.includes('api.telegram.org')) {
        console.log(`🗑️ Image invalide pour: ${product.name}`);
        product.imageUrl = null;
        needsUpdate = true;
      }
      
      // Vérifier et corriger videoUrl
      if (product.videoUrl && product.videoUrl.includes('api.telegram.org')) {
        console.log(`🗑️ Vidéo invalide pour: ${product.name}`);
        product.videoUrl = null;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await product.save();
        fixedCount++;
        console.log(`✅ ${product.name} corrigé`);
      }
    }
    
    console.log(`🎉 ${fixedCount} produits corrigés sur ${products.length}`);
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixAllProducts();
