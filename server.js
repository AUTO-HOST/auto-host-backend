const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Carga variables de entorno

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de CORS
app.use(cors({
  origin: '*', // Permite cualquier origen. En Render, Render asigna la URL de tu frontend.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ ERROR: La variable de entorno MONGO_URI no está definida.');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado exitosamente.'))
    .catch(err => {
      console.error('❌ ERROR al conectar con MongoDB:', err.message);
    });
}

// Importar e inicializar Firebase Admin SDK (para Storage y Auth)
// serviceAccountKey.json debe estar en la misma carpeta 'backend/'
const adminInit = require('./firebaseAdmin');
if (!adminInit || !adminInit.admin) {
    console.error('❌ ERROR: Firebase Admin SDK no se inicializó correctamente en server.js');
} else {
    console.log('✅ Firebase Admin SDK disponible en server.js');
}

// Cargar rutas
try {
  console.log("🔄 Cargando rutas...");

  const userRoutes = require('./routes/userRoutes');
  app.use('/api/users', userRoutes);
  console.log("✅ Rutas de usuario (/api/users) cargadas.");

  const productRoutes = require('./routes/productRoutes');
  app.use('/api/products', productRoutes);
  console.log("✅ Rutas de productos (/api/products) cargadas.");

  const messageRoutes = require('./routes/messageRoutes');
  app.use('/api/messages', messageRoutes);
  console.log("✅ Rutas de mensajes (/api/messages) cargadas.");

  const orderRoutes = require('./routes/orderRoutes');
  app.use('/api/orders', orderRoutes);
  console.log("✅ Rutas de pedidos (/api/orders) cargadas.");

  // --- ESTA ES LA ÚLTIMA PARTE QUE FALTABA ---
  const salesRoutes = require('./routes/salesRoutes');
  app.use('/api/sales', salesRoutes);
  console.log("✅ Rutas de ventas (/api/sales) cargadas.");
  // --- FIN ---

  console.log("🎉 Todas las rutas se cargaron exitosamente.");

} catch (error) {
    console.error('❌ ERROR FATAL AL CARGAR RUTAS:', error.message);
}

// El servidor empieza a escuchar en el puerto que Render le asigne
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend arrancado en el puerto ${PORT}`);
});

module.exports = app;
