// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Para encriptar contraseñas
const jwt = require('jsonwebtoken'); // Para tokens JWT
const { admin } = require('../firebaseAdmin'); // Para interactuar con Firebase Admin SDK
const User = require('../models/User'); // Importa el modelo de usuario de Mongoose
const authMiddleware = require('../middleware/authMiddleware');

// --- RUTA: REGISTRO DE USUARIO (POST /api/users/register) ---
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, userType } = req.body;

    // 1. Crear usuario en Firebase Authentication (para obtener Firebase UID)
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password, // Firebase Auth maneja el hashing internamente
    });
    console.log("Usuario de Firebase creado:", userRecord.uid);

    // 2. Guardar perfil de usuario en Firestore (para datos adicionales)
    // Opcional: si ya tienes un modelo User en MongoDB, guarda aquí también.
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: email,
      name: name,
      userType: userType || 'Comprador', // 'Comprador' o 'Vendedor'
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("Perfil de Firestore guardado para UID:", userRecord.uid);

    // 3. Opcional: Guardar usuario en MongoDB (si tu base de datos principal es MongoDB)
    const newUser = new User({
      firebaseUid: userRecord.uid,
      email: email,
    });
    await newUser.save();
    console.log("Usuario guardado en MongoDB para UID:", newUser.firebaseUid);

    // Generar un token JWT para la sesión (opcional, si no usas tokens de Firebase directamente)
    const token = jwt.sign({ userId: userRecord.uid, email: email, userType: userType || 'Comprador' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({
      message: 'Usuario registrado con éxito',
      userId: userRecord.uid,
      email: email,
      token: token,
    });

  } catch (error) {
    console.error('Error en el registro de usuario:', error);
    // Manejo de errores específicos de Firebase Auth
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ message: 'El email ya está registrado.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al registrar el usuario.' });
  }
});

// --- RUTA: INICIO DE SESIÓN DE USUARIO (POST /api/users/login) ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Autenticar con Firebase Authentication
    const userRecord = await admin.auth().getUserByEmail(email);

    // Generar un token JWT (o usar el idToken de Firebase si viene del frontend)
    const token = jwt.sign({ userId: userRecord.uid, email: userRecord.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Obtener el perfil de usuario de Firestore
    const userProfileDoc = await admin.firestore().collection('users').doc(userRecord.uid).get();
    const userProfile = userProfileDoc.exists ? userProfileDoc.data() : null;

    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token: token,
      userId: userRecord.uid,
      email: userRecord.email,
      userType: userProfile ? userProfile.userType : 'Comprador', // Asumiendo userType está en Firestore
    });

  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al iniciar sesión.' });
  }
});

// --- RUTA: OBTENER PERFIL DE USUARIO (GET /api/users/profile) ---
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid; // ID de Firebase del usuario autenticado

    // Obtener el perfil del usuario de Firestore
    const userProfileDoc = await admin.firestore().collection('users').doc(userId).get();
    const userProfile = userProfileDoc.exists ? userProfileDoc.data() : null;

    if (!userProfile) {
      return res.status(404).json({ message: 'Perfil de usuario no encontrado en Firestore.' });
    }

    res.status(200).json(userProfile);
  } catch (error) {
    console.error('Error al obtener perfil de usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener el perfil.' });
  }
});

module.exports = router;