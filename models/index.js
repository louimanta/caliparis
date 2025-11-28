// models/index.js
const { 
  sequelize,
  Sequelize,
  Product,
  Customer,
  Order,
  OrderItem,
  Cart 
} = require('./index');

module.exports = {
  sequelize,
  Sequelize,
  Product,
  Customer,
  Order,
  OrderItem,
  Cart
};
