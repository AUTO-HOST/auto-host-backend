// backend/models/Message.js
const mongoose = require('mongoose');

const messageSchema = mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: String, // Firebase UID
      required: true,
    },
    senderEmail: {
      type: String, // Email del sender (para mostrar en UI)
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model('Message', messageSchema, 'messages'); // Colección 'messages'

module.exports = Message;