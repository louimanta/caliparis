const { Product, sequelize } = require('../models');

async function initializeProducts() {
  try {
    console.log('📦 Initialisation des produits...');

    const products = [
      {
        name: '🌿 Cali Weed - Qualité Premium',
        description: 'Notre fleur signature, cultivée avec soin pour une expérience exceptionnelle. Arômes puissants et effets équilibrés.',
        price: 12.00,
        imageUrl: ' https://images.leafly.com/flower-images/defaults/generic/strain-40.png ',
        videoUrl: ' https://www.youtube.com/watch?v=fNMQZbsJp8k',
        stock: 50,
        category: 'weed'
      },
      {
        name: '🍫 Space Cake - 25mg THC',
        description: 'Délicieux space cake artisanal. Parfait pour une expérience douce et prolongée. Dosage précis pour votre confort.',
        price: 8.00,
        imageUrl: ' https://images.leafly.com/flower-images/blue-dream.png ',
        videoUrl: 'https://www.youtube.com/watch?v=fNMQZbsJp8k ',
        stock: 30,
        category: 'edibles'
      },
      {
        name: '💎 Résine Premium - 2g',
        description: 'Résine de haute pureté, extraction soignée pour préserver les terpènes et cannabinoïdes.',
        price: 25.00,
        imageUrl: ' https://leafly-public.imgix.net/strains/photos/5SPDG4T4TcSO8PgLgWHO_SourDiesel_AdobeStock_171888473.jpg',
        videoUrl: 'https://www.youtube.com/watch?v=fNMQZbsJp8k ',
        stock: 20,
        category: 'concentrates'
      },
      {
        name: '🛡️ Kit Sécurité Complet',
        description: 'Tout le nécessaire pour consommer en toute sécurité : grinder, filtres, emballage discret.',
        price: 15.00,
        imageUrl: ' https://images.leafly.com/flower-images/granddaddy-purple.png',
        videoUrl: 'https://www.youtube.com/watch?v=fNMQZbsJp8k',
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
