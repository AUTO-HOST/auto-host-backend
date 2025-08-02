// backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message'); // Importa el modelo de mensaje
const Conversation = require('../models/Conversation'); // Importa el modelo de conversación
const authMiddleware = require('../middleware/authMiddleware').authMiddleware; // Importa el middleware
const { admin } = require('../firebaseAdmin'); // Para Firebase Admin SDK y Firestore

const db = admin.firestore(); // Inicializa Firestore

// --- RUTA: ENVIAR MENSAJE (POST /api/messages/send) ---
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { receiverId, productId, productName, content, receiverEmail } = req.body;
        const senderId = req.user.uid;
        const senderEmail = req.user.email; // Email del usuario autenticado

        // Buscar/crear conversación en Firestore
        let conversationQuery = await db.collection('conversations')
            .where('productId', '==', productId)
            .where('participants', 'array-contains', senderId)
            .get();

        let conversationDoc;
        if (!conversationQuery.empty) {
            // Filtrar para encontrar la conversación que también contenga a receiverId
            conversationDoc = conversationQuery.docs.find(doc => doc.data().participants.includes(receiverId));
        }

        let conversationRef;
        if (!conversationDoc) {
            // Crear nueva conversación si no existe
            conversationRef = await db.collection('conversations').add({
                productId: productId,
                productName: productName,
                participants: [senderId, receiverId],
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log("Nueva conversación creada:", conversationRef.id);
        } else {
            conversationRef = db.collection('conversations').doc(conversationDoc.id);
            // Actualizar timestamp de última actividad
            await conversationRef.update({
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log("Conversación existente actualizada:", conversationRef.id);
        }

        // Crear el nuevo mensaje en una subcolección 'messages'
        const messagesSubcollectionRef = conversationRef.collection('messages');
        const newMessageRef = await messagesSubcollectionRef.add({
            senderId: senderId,
            senderEmail: senderEmail,
            content: content,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("Nuevo mensaje añadido:", newMessageRef.id);

        res.status(201).json({ message: 'Mensaje enviado', messageId: newMessageRef.id });

    } catch (error) {
        console.error('Error al enviar mensaje (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al enviar mensaje.' });
    }
});

// --- RUTA: OBTENER CONVERSACIONES DEL USUARIO (GET /api/messages/conversations) ---
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.uid;

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
        const userId = req.user.uid; // Usuario autenticado

        // Encontrar la conversación en Firestore
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

        // Obtener los mensajes de la subcolección 'messages'
        const messagesSnapshot = await db.collection('conversations')
            .doc(conversationDoc.id)
            .collection('messages')
            .orderBy('timestamp', 'asc') // Ordenar por timestamp
            .get();

        const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.status(200).json(messages);

    } catch (error) {
        console.error('Error al obtener mensajes de conversación (Firestore):', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener mensajes de conversación.' });
    }
});

module.exports = router;