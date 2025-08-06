// backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { admin } = require('../firebaseAdmin');

const db = admin.firestore();

// --- RUTA: ENVIAR MENSAJE (POST /api/messages/send) ---
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { receiverId, productId, productName, content } = req.body;
        const senderId = req.user.userId; // CORREGIDO: de uid a userId
        const senderEmail = req.user.email;

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
            conversationRef = await db.collection('conversations').add({
                productId: productId,
                productName: productName,
                participants: [senderId, receiverId],
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            conversationRef = db.collection('conversations').doc(conversationDoc.id);
            await conversationRef.update({
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

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

// --- RUTA: OBTENER CONVERSACIONES DEL USUARIO (GET /api/messages/conversations) ---
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId; // CORREGIDO: de uid a userId

        if (!userId) { // Añadida una validación para seguridad
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

// --- RUTA: OBTENER MENSAJES DE UNA CONVERSACIÓN ESPECÍFICA (GET /api/messages/:productId/:otherUserId) ---
router.get('/:productId/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const { productId, otherUserId } = req.params;
        const userId = req.user.userId; // CORREGIDO: de uid a userId

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