const admin = require('firebase-admin');
require('dotenv').config();

try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG);
    } catch (parseError) {
      console.error('❌ ERROR: No se pudo parsear la configuración de Firebase desde la variable de entorno:', parseError.message);
      throw new Error('Configuración de Firebase JSON inválida.');
    }
  } else {
    throw new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT_CONFIG no está definida.');
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('✅ Firebase Admin SDK inicializado correctamente.');
  } else {
    console.error('ERROR: Las credenciales de Firebase no están disponibles. Firebase Admin SDK NO se inicializó.');
  }
  module.exports = { admin };

} catch (error) {
  console.error('❌ ERROR: No se pudo inicializar Firebase Admin SDK.');
  if (error.message.includes('FIREBASE_SERVICE_ACCOUNT_CONFIG no está definida')) {
    console.error('Asegúrate de haber configurado la variable de entorno FIREBASE_SERVICE_ACCOUNT_CONFIG en Render.com.');
  } else if (error.message.includes('JSON inválida')) {
    console.error('Asegúrate de que el valor de la variable FIREBASE_SERVICE_ACCOUNT_CONFIG sea un JSON válido.');
  } else {
    console.error('Error original:', error.message);
  }
}