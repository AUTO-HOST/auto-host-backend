const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { admin } = require('../firebaseAdmin');
const Product = require('../models/Product'); // Asegúrate que la ruta a tu modelo es correcta

const db = admin.firestore();

// --- RUTA: ENVIAR MENSAJE (VERSIÓN CORREGIDA Y MÁS SEGURA) ---
router.post('/send', authMiddleware, async (req, res) => {
    try {
        // Ya no necesitamos que el frontend nos envíe el receiverId
        const { productId, productName, content } = req.body;
        const senderId = req.user.userId; // CORREGIDO
        const senderEmail = req.user.email;

        // --- NUEVA LÓGICA ---
        // 1. Buscar el producto para encontrar al vendedor
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado." });
        }
        // Obtenemos el ID del vendedor directamente desde el producto
        const receiverId = product.user.toString();
        // --- FIN DE LA NUEVA LÓGICA ---

        // El resto del código para buscar o crear la conversación
        let conversationQuery = await db.collection('conversations')
            .where('productId', '==', productId)
            .where('participants', 'array-contains', senderId)
            .get();

        let conversationDoc;
        if (!conversationQuery.empty) {
            conversationDoc = conversationQuery.docs.find(doc => doc.data().participants.includes(receiverId));
        }

        let conversationRef;
        if (!conversationDoc) {
            // Crear nueva conversación si no existe
            conversationRef = await db.collection('conversations').add({
                productId: productId,
                productName: productName,
                participants: [senderId, receiverId],
                participantEmails: [senderEmail, product.sellerEmail], // Asumiendo que tienes sellerEmail en tu producto
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            // Usar conversación existente
            conversationRef = db.collection('conversations').doc(conversationDoc.id);
            await conversationRef.update({
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Añadir el nuevo mensaje a la subcolección
        const messagesSubcollectionRef = conversationRef.collection('messages');
        const newMessageRef = await messagesSubcollectionRef.add({
            senderId: senderId,
            senderEmail: senderEmail,
            content: content,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ message: 'Mensaje enviado', messageId: newMessageRef.id });

    } catch (error) {
        console.error('Error al enviar mensaje (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al enviar mensaje.' });
    }
});

// --- RUTA: OBTENER CONVERSACIONES DEL USUARIO ---
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId; // CORREGIDO

        if (!userId) {
            return res.status(400).json({ message: 'No se pudo verificar la identidad del usuario.' });
        }

        const conversationsSnapshot = await db.collection('conversations')
            .where('participants', 'array-contains', userId)
            .orderBy('lastMessageAt', 'desc')
            .get();

        const conversations = conversationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.status(200).json(conversations);

    } catch (error) {
        console.error('Error al obtener conversaciones (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener conversaciones.' });
    }
});

// --- RUTA: OBTENER MENSAJES DE UNA CONVERSACIÓN ESPECÍFICA ---
router.get('/:productId/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const { productId, otherUserId } = req.params;
        const userId = req.user.userId; // CORREGIDO

        let conversationQuery = await db.collection('conversations')
            .where('productId', '==', productId)
            .where('participants', 'array-contains', userId)
            .get();

        let conversationDoc;
        if (!conversationQuery.empty) {
            conversationDoc = conversationQuery.docs.find(doc => doc.data().participants.includes(otherUserId));
        }

        if (!conversationDoc) {
            return res.status(404).json({ message: 'Conversación no encontrada.' });
        }

        const messagesSnapshot = await db.collection('conversations')
            .doc(conversationDoc.id)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .get();

        const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.status(200).json(messages);

    } catch (error) {
        console.error('Error al obtener mensajes de conversación (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener mensajes de conversación.' });
    }
});

module.exports = router;