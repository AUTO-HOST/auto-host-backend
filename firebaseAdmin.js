const admin = require('firebase-admin');
require('dotenv').config(); // Mantén esta línea para que lea el .env en Render

try {
  // serviceAccountKey.json debe estar en la misma carpeta 'backend/'
  const serviceAccount = require('./serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Usamos process.env.FIREBASE_STORAGE_BUCKET para Render.
    // Render leerá esta variable de entorno que configurarás en su interfaz.
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET 
  });

  console.log('✅ Firebase Admin SDK inicializado correctamente.');
  module.exports = { admin };

} catch (error) {
  console.error('❌ ERROR: No se pudo inicializar Firebase Admin SDK.');
  if (error.code === 'MODULE_NOT_FOUND') {
      console.error('Asegúrate de que el archivo "serviceAccountKey.json" exista en la carpeta "backend".');
  } else {
      console.error('Error original:', error.message);
  }
}