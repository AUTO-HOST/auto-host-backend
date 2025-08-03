const admin = require('firebase-admin');
require('dotenv').config(); // Mantén esta línea para que lea el .env en Render

try {
  // --- INICIO DE CÓDIGO MODIFICADO ---
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG) {
    try {
      // Intentamos parsear la configuración JSON desde la variable de entorno
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG);
    } catch (parseError) {
      console.error('❌ ERROR: No se pudo parsear la configuración de Firebase desde la variable de entorno:', parseError.message);
      throw new Error('Configuración de Firebase JSON inválida.');
    }
  } else {
    // Si no se encuentra la variable de entorno, lanzar un error
    throw new new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT_CONFIG no está definida.');
  }
  // --- FIN DE CÓDIGO MODIFICADO ---

  // Inicializa Firebase Admin SDK con las credenciales
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('✅ Firebase Admin SDK inicializado correctamente.');
  } else {
    console.error('ERROR: Las credenciales de Firebase no están disponibles. Firebase Admin SDK NO se inicializó.');
  }
  module.exports = { admin }; // Asegúrate de que 'admin' se exporta aquí

} catch (error) {
  console.error('❌ ERROR: No se pudo inicializar Firebase Admin SDK.');
  // Ajustamos los mensajes de error para que sean más específicos
  if (error.message.includes('FIREBASE_SERVICE_ACCOUNT_CONFIG no está definida')) {
    console.error('Asegúrate de haber configurado la variable de entorno FIREBASE_SERVICE_ACCOUNT_CONFIG en Render.com.');
  } else if (error.message.includes('JSON inválida')) {
    console.error('Asegúrate de que el valor de la variable FIREBASE_SERVICE_ACCOUNT_CONFIG sea un JSON válido.');
  } else {
    console.error('Error original:', error.message);
  }
}