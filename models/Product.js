// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = mongoose.Schema(
  {
    user: {
      type: String, // <-- ID de usuario de Firebase
      required: true,
      ref: 'User', 
    },
    name: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    sellerEmail: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    condition: {
      type: String,
      required: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 1,
    },
    // --- LÍNEA AÑADIDA ---
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // --- FIN DE LÍNEA AÑADIDA ---
    isOnOffer: {
      type: Boolean,
      default: false,
    },
    originalPrice: {
      type: Number,
    },
    discountPercentage: {
      type: Number,
    },
    marca_refaccion: { type: String },
    lado: { type: String },
    numero_parte: { type: String },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema, 'productos'); // Colección 'productos'

module.exports = Product;