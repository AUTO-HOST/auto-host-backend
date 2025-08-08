const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { admin } = require('../firebaseAdmin');

const db = admin.firestore();

// --- RUTA: OBTENER EL HISTORIAL DE VENTAS DE UN VENDEDOR ---
// GET /api/sales
router.get('/', authMiddleware, async (req, res) => {
    try {
        const sellerId = req.user.userId; // Obtenemos el ID del vendedor autenticado

        // Creamos una consulta a la colección 'orders'
        const salesQuery = db.collection('orders')
            // Buscamos documentos donde el ID del vendedor esté en el array 'involvedSellerUids'
            .where('involvedSellerUids', 'array-contains', sellerId)
            // Ordenamos por fecha para mostrar las ventas más recientes primero
            .orderBy('createdAt', 'desc');

        const querySnapshot = await salesQuery.get();

        if (querySnapshot.empty) {
            // Si no hay ventas, devolvemos un array vacío
            return res.status(200).json([]);
        }

        const sales = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Para cada venta, filtramos los artículos para mostrar solo los de este vendedor
            const itemsSoldByCurrentUser = data.items.filter(item => item.sellerId === sellerId);
            
            return {
                orderId: doc.id,
                createdAt: data.createdAt.toDate().toISOString(),
                buyerEmail: data.buyerEmail,
                items: itemsSoldByCurrentUser, // Devolvemos solo los productos que vendió
                // Calculamos el total de esta venta específica para este vendedor
                saleTotal: itemsSoldByCurrentUser.reduce((sum, item) => sum + item.totalPrice, 0)
            };
        });

        res.status(200).json(sales);

    } catch (error) {
        console.error("Error al obtener el historial de ventas:", error);
        res.status(500).json({ message: "Error en el servidor al obtener las ventas." });
    }
});

module.exports = router;