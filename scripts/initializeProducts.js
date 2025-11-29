// scripts/initializeProducts.js
const { Product } = require('../models');

async function initializeProducts() {
  try {
    console.log('📦 Initialisation des produits...');

    const products = [
      {
        name: '🍫 Space Cake ',
        description: 'Space cake artisanal. Effets relaxants et euphoriques.',
        price: 8.00,
        imageUrl: 'caliparis/images/mimosa.jpg.',
        videoUrl: '',
        stock: 100,
        isActive: true,
        category: 'edibles',
        quality: 'Premium'
      },
      {
        name: '💎 Résine Premium - 2g',
        description: 'Résine de haute qualité, riche en terpènes et CBD. Parfait pour la détente.',
        price: 25.00,
        imageUrl: 'https://i.imgur.com/resine-premium.jpg',
        videoUrl: '',
        stock: 50,
        isActive: true,
        category: 'resine',
        quality: 'Premium'
      },
      {
        name: '🌿 Fleur CBD - 1g',
        description: 'Fleur de CBD biologique, arômes fruités et effets relaxants sans psychoactifs.',
        price: 12.00,
        imageUrl: 'https://i.imgur.com/fleur-cbd.jpg',
        videoUrl: '',
        stock: 80,
        isActive: true,
        category: 'fleurs',
        quality: 'Bio'
      },
      {
        name: '🍯 Huile CBD - 10ml',
        description: 'Huile de CBD full spectrum, 10% de concentration. Idéale pour le bien-être quotidien.',
        price: 35.00,
        imageUrl: 'https://i.imgur.com/huile-cbd.jpg',
        videoUrl: '',
        stock: 30,
        isActive: true,
        category: 'huiles',
        quality: 'Full Spectrum'
      },
      {
        name: '✨ Cristaux CBD - 1g',
        description: 'Cristaux de CBD purs à 99%. Parfaits pour la fabrication de vos propres produits.',
        price: 20.00,
        imageUrl: 'https://i.imgur.com/cristaux-cbd.jpg',
        videoUrl: '',
        stock: 40,
        isActive: true,
        category: 'cristaux',
        quality: '99% Pur'
      }
    ];

    for (const productData of products) {
      const existingProduct = await Product.findOne({
        where: { name: productData.name }
      });

      if (!existingProduct) {
        await Product.create(productData);
        console.log(`✅ Produit créé: ${productData.name}`);
      } else {
        console.log(`📦 Produit existant: ${productData.name}`);
      }
    }

    console.log('🎉 Initialisation des produits terminée!');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des produits:', error);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  initializeProducts()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = initializeProducts;
