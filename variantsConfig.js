// variantsConfig.js
// Mapping des variétés pour chaque produit
// Format: productId -> {baseName, variants[]}

module.exports = {
  // EXEMPLE : Pour un produit avec ID 1 dans votre base
  "1": {
    baseName: "Birthday",
    variants: [
      {
        id: "1_ogkush",  // ID unique pour le callback
        name: "OG Kush",
        price: 20,       // Prix spécifique (peut être différent du produit de base)
        description: "Variété OG Kush puissante et terreuse"
      },
      {
        id: "1_amnesia",
        name: "Amnesia",
        price: 22,
        description: "Variété Amnesia cérébrale et énergisante"
      },
      {
        id: "1_bluedream",
        name: "Blue Dream",
        price: 25,
        description: "Variété Blue Dream douce et équilibrée"
      }
    ]
  },
  
  // EXEMPLE : Pour un produit avec ID 2 (La Mousse)
  "2": {
    baseName: "La Mousse",
    variants: [
      {
        id: "2_classic",
        name: "Classic",
        price: 15,
        description: "La Mousse classique premium",
        minQuantity: 100  // Règle spéciale
      }
    ]
  }
  
  // Ajoutez d'autres produits ici selon vos IDs
  // "3": { baseName: "Space Cake", variants: [...] }
};
