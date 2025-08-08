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
            const product = await Product.findById(item.productId);

            if (product) {
                product.stock -= item.quantity;
                if (product.stock <= 0) {
                    product.isAvailable = false;
                }
                await product.save();
            }
        }

        // --- PARTE 2: Guardar el registro del pedido en Firestore ---
        const newOrder = {
            buyerId: userId,
            buyerEmail: email,
            items: items,
            orderTotal: orderTotal,
            status: 'Pendiente',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection('orders').add(newOrder);

        // --- PARTE 3: Vaciar el carrito en Firestore ---
        const cartItemsRef = db.collection('carts').doc(userId).collection('items');
        const cartSnapshot = await cartItemsRef.get();
        const deletePromises = cartSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);

        res.status(201).json({ message: 'Pedido creado exitosamente' });

    } catch (error) {
        console.error("Error al crear el pedido:", error);
        res.status(500).json({ message: 'Error en el servidor al procesar el pedido.' });
    }
});


// --- NUEVA RUTA: OBTENER DETALLES DE UN PEDIDO ESPECÍFICO ---
// GET /api/orders/:orderId
router.get('/:orderId', authMiddleware, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.userId;

        const orderRef = db.collection('orders').doc(orderId);
        const doc = await orderRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Pedido no encontrado." });
        }

        const orderData = doc.data();

        // Verificación de seguridad: solo el comprador o un vendedor involucrado puede ver el pedido
        const isBuyer = orderData.buyerId === userId;
        const isSellerInvolved = orderData.items.some(item => item.sellerId === userId);

        if (!isBuyer && !isSellerInvolved) {
            return res.status(403).json({ message: "No tienes permiso para ver este pedido." });
        }

        // Convertimos el timestamp a un formato legible antes de enviarlo
        const finalOrderData = {
            ...orderData,
            id: doc.id,
            createdAt: orderData.createdAt.toDate().toISOString()
        };

        res.status(200).json(finalOrderData);

    } catch (error) {
        console.error("Error al obtener detalles del pedido:", error);
        res.status(500).json({ message: "Error en el servidor al obtener el pedido." });
    }
});


module.exports = router;