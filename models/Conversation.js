// backend/models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = mongoose.Schema(
  {
    participants: [
      {
        type: String, // Firebase UIDs
        required: true,
      },
    ],
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Conversation = mongoose.model('Conversation', conversationSchema, 'conversations'); // Colección 'conversations'

module.exports = Conversation;