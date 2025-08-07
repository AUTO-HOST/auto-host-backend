const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { admin } = require('../firebaseAdmin');
const Product = require('../models/Product');

const db = admin.firestore();

// --- RUTA: INICIAR CONVERSACIÓN ---
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { productId, productName, content } = req.body;
        const senderId = req.user.userId;
        const senderEmail = req.user.email;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado." });
        }
        const receiverId = product.user.toString();

        let conversationQuery = await db.collection('conversations')
            .where('productId', '==', productId)
            .where('participants', 'array-contains', senderId)
            .get();

        let conversationDoc = conversationQuery.docs.find(doc => doc.data().participants.includes(receiverId));

        if (!conversationDoc) {
            const conversationRef = await db.collection('conversations').add({
                productId: productId,
                productName: productName,
                participants: [senderId, receiverId],
                participantInfo: {
                    [senderId]: senderEmail,
                    [receiverId]: product.sellerEmail
                },
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageContent: content
            });
            const messagesSubcollectionRef = conversationRef.collection('messages');
            await messagesSubcollectionRef.add({
                senderId: senderId,
                content: content,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const conversationRef = db.collection('conversations').doc(conversationDoc.id);
            await conversationRef.update({
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageContent: content
            });
            const messagesSubcollectionRef = conversationRef.collection('messages');
            await messagesSubcollectionRef.add({
                senderId: senderId,
                content: content,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        res.status(201).json({ message: 'Mensaje enviado' });
    } catch (error) {
        console.error('Error al enviar mensaje (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al enviar mensaje.' });
    }
});

// --- RUTA: OBTENER CONVERSACIONES DEL USUARIO (MEJORADA) ---
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversationsSnapshot = await db.collection('conversations')
            .where('participants', 'array-contains', userId)
            .orderBy('lastMessageAt', 'desc')
            .get();

        const conversations = conversationsSnapshot.docs.map(doc => {
            const data = doc.data();
            const otherParticipantId = data.participants.find(p => p !== userId);
            return {
                id: doc.id,
                ...data,
                otherParticipantId: otherParticipantId,
                otherParticipantEmail: data.participantInfo[otherParticipantId],
                lastMessageAt: data.lastMessageAt.toDate().toISOString()
            };
        });
        res.status(200).json(conversations);
    } catch (error) {
        console.error('Error al obtener conversaciones (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener conversaciones.' });
    }
});

// --- RUTA: ENVIAR RESPUESTA ---
router.post('/reply/:conversationId', authMiddleware, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;
        const senderId = req.user.userId;
        const conversationRef = db.collection('conversations').doc(conversationId);
        const messagesSubcollectionRef = conversationRef.collection('messages');
        await messagesSubcollectionRef.add({
            senderId: senderId,
            content: content,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        await conversationRef.update({
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageContent: content
        });
        res.status(201).json({ message: 'Respuesta enviada' });
    } catch (error) {
        console.error('Error al enviar respuesta (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al enviar respuesta.' });
    }
});

// --- RUTA: OBTENER MENSAJES DE UNA CONVERSACIÓN ---
router.get('/:conversationId/messages', authMiddleware, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const messagesSnapshot = await db.collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .get();
        const messages = messagesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate().toISOString()
        }));
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error al obtener mensajes de conversación (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener mensajes de conversación.' });
    }
});

module.exports = router;