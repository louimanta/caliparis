
// scripts/initializeProducts.js
const { Product } = require('../models');

async function initializeProducts() {
  try {
    console.log('📦 Initialisation des produits...');

    const products = [
      {
        name: '🍫 Mimosa',
        description: 'Space cake artisanal. Effets relaxants et euphoriques.',
        price: 8.00,
        imageUrl: 'https://cdn.jsdelivr.net/gh/louimanta/caliparis/images/mimosa.mp4',
        videoUrl: 'https://cdn.jsdelivr.net/gh/louimanta/caliparis/images/mimosa.mp4',
        stock: 100,
        isActive: true,
        category: 'edibles',
        quality: 'Premium'
      },
      {
        name: '💎Frozen Triangle Kush ',
        description: 'Résine de haute qualité, riche en terpènes. Parfait pour la détente.',
        price: 25.00,
        imageUrl: 'https://cdn.jsdelivr.net/gh/louimanta/caliparis/images/Frozen.jpg',
        videoUrl: '',
        stock: 50,
        isActive: true,
        category: 'resine',
        quality: 'Premium'
      },
      {
        name: '🌿 Cali Kush ',
        description: 'Fleur de CBD biologique, arômes fruités et effets relaxants sans psychoactifs.',
        price: 12.00,
        imageUrl: 'https://cdn.jsdelivr.net/gh/louimanta/caliparis/images/Cali.png',
        videoUrl: '',
        stock: 80,
        isActive: true,
        category: 'fleurs',
        quality: 'Bio'
      },
      {
        name: '🍯 Birthday Cake ',
        description: 'resine full spectrum, 10% de concentration. Idéale pour le bien-être quotidien.',
        price: 35.00,
        imageUrl: 'https://cdn.jsdelivr.net/gh/louimanta/caliparis/images/Birthday.jpg',
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
        imageUrl: 'https://cdn.jsdelivr.net/gh/louimanta/caliparis/images/cristaux-cbd.jpg',
        videoUrl: '',
        stock: 40,
        isActive: true,
        category: 'cristaux',
        quality: '99% Pur'
      }
    ];

    for (const productData of products) {
      const [product, created] = await Product.findOrCreate({
        where: { name: productData.name },
        defaults: productData
      });

      // Forcer la mise à jour si l'URL est incorrecte
      if (!created && product.imageUrl.endsWith('.jpg.')) {
        product.imageUrl = productData.imageUrl;
        await product.save();
        console.log(`🔧 URL corrigée pour: ${productData.name}`);
      }

      if (created) {
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
