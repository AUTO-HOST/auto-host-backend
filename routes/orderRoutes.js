const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Product = require('../models/Product'); // Importamos el modelo de Mongoose
const { admin } = require('../firebaseAdmin'); // Para interactuar con Firestore

const db = admin.firestore();

// --- RUTA: CREAR UN NUEVO PEDIDO ---
// POST /api/orders
router.post('/', authMiddleware, async (req, res) => {
    // Obtenemos los productos del carrito y la información del comprador desde el frontend
    const { items, orderTotal } = req.body;
    const { userId, email } = req.user;

    try {
        // --- PARTE 1: Actualizar el stock en MongoDB ---
        for (const item of items) {
            // Buscamos cada producto en nuestra base de datos de MongoDB
            const product = await Product.findById(item.productId);

            if (product) {
                // Reducimos el stock
                product.stock -= item.quantity;

                // Si el stock llega a 0, lo marcamos como no disponible
                if (product.stock <= 0) {
                    product.isAvailable = false;
                }

                // Guardamos los cambios del producto en MongoDB
                await product.save();
            }
        }

        // --- PARTE 2: Guardar el registro del pedido en Firestore ---
        const newOrder = {
            buyerId: userId,
            buyerEmail: email,
            items: items, // La lista de productos del carrito
            orderTotal: orderTotal,
            status: 'Pendiente',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Añadimos el nuevo pedido a la colección 'orders' en Firestore
        await db.collection('orders').add(newOrder);

        // --- PARTE 3: Vaciar el carrito en Firestore ---
        const cartItemsRef = db.collection('carts').doc(userId).collection('items');
        const cartSnapshot = await cartItemsRef.get();
        const deletePromises = cartSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);

        // Si todo sale bien, enviamos una respuesta de éxito
        res.status(201).json({ message: 'Pedido creado exitosamente' });

    } catch (error) {
        console.error("Error al crear el pedido:", error);
        res.status(500).json({ message: 'Error en el servidor al procesar el pedido.' });
    }
});

module.exports = router;