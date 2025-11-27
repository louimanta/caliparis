const { Product, sequelize } = require('../models');

async function initializeProducts() {
  try {
    console.log('📦 Initialisation des produits...');

    const products = [
      {
        name: '🌿 Cali Weed - Qualité Premium',
        description: 'Notre fleur signature, cultivée avec soin pour une expérience exceptionnelle. Arômes puissants et effets équilibrés.',
        price: 12.00,
        imageUrl: 'https://i.imgur.com/placeholder1.jpg',
        videoUrl: 'https://i.imgur.com/video1.mp4',
        stock: 50,
        category: 'weed'
      },
      {
        name: '🍫 Space Cake - 25mg THC',
        description: 'Délicieux space cake artisanal. Parfait pour une expérience douce et prolongée. Dosage précis pour votre confort.',
        price: 8.00,
        imageUrl: 'https://i.imgur.com/placeholder2.jpg',
        videoUrl: 'https://i.imgur.com/video2.mp4',
        stock: 30,
        category: 'edibles'
      },
      {
        name: '💎 Résine Premium - 2g',
        description: 'Résine de haute pureté, extraction soignée pour préserver les terpènes et cannabinoïdes.',
        price: 25.00,
        imageUrl: 'https://i.imgur.com/placeholder3.jpg',
        videoUrl: 'https://i.imgur.com/video3.mp4',
        stock: 20,
        category: 'concentrates'
      },
      {
        name: '🛡️ Kit Sécurité Complet',
        description: 'Tout le nécessaire pour consommer en toute sécurité : grinder, filtres, emballage discret.',
        price: 15.00,
        imageUrl: 'https://i.imgur.com/placeholder4.jpg',
        videoUrl: 'https://i.imgur.com/video4.mp4',
        stock: 100,
        category: 'accessories'
      }
    ];

    for (const productData of products) {
      const [product, created] = await Product.findOrCreate({
        where: { name: productData.name },
        defaults: productData
      });
      
      if (created) {
        console.log(`✅ Produit créé: ${product.name}`);
      } else {
        console.log(`⚠️ Produit existant: ${product.name}`);
      }
    }

    console.log('🎉 Initialisation des produits terminée!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  initializeProducts();
}

module.exports = initializeProducts;
