// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema, 'users'); // Colección 'users'

module.exports = User;