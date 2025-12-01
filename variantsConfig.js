// variantsConfig.js
// Mapping des variétés pour chaque produit
// Format: productId -> {baseName, variants[]}

module.exports = {
  // EXEMPLE : Pour un produit avec ID 1 dans votre base
  "1": {
    baseName: "Caliplates",
    variants: [
      {
        id: "1_gelato41",  // ID unique pour le callback
        name: "Gelato 41",
        price: 20,       // Prix spécifique (peut être différent du produit de base)
        description: "Gelato 41 puissante et saveureux"
      },
      {
        id: "1_lemonsbars",
        name: "Lemon Bars",
        price: 20,
        description: "Lemon Bars cérébrale et énergisante"
      },
      {
        id: "1_kushmintz",
        name: "Kush Mintz",
        price: 20,
        description: "Kush Mintz douce et équilibrée"
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
