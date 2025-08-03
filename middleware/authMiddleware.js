const jwt = require('jsonwebtoken'); // Aunque se importa, solo para la estructura. No se usa para verificar idTokens de Firebase aquí.
const { admin } = require('../firebaseAdmin'); // IMPORTANTE: Importamos la instancia de Firebase Admin SDK

const authMiddleware = async (req, res, next) => { // ¡CAMBIADO a 'async' porque la verificación es asíncrona!
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ msg: 'No hay token de autenticación, autorización denegada' });
    }

    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
        // --- CAMBIO CRÍTICO AQUÍ: Usar Firebase Admin SDK para verificar el idToken ---
        const decodedToken = await admin.auth().verifyIdToken(tokenWithoutBearer);
        // El 'decodedToken' contiene el payload del idToken, incluyendo el UID de Firebase
        console.log("Token de Firebase verificado con éxito. UID:", decodedToken.uid);

        // Adjuntar información del usuario decodificada a la petición (req.user)
        // Usamos decodedToken.uid para userId, ya que Firebase Admin SDK lo garantiza
        req.user = { userId: decodedToken.uid, email: decodedToken.email };
        
        next(); // Pasar al siguiente middleware o a la función de ruta

    } catch (err) {
        console.error("Error al verificar idToken de Firebase con Admin SDK:", err);
        // Manejar errores específicos de Firebase Admin SDK o JWT
        let errorMessage = "Token no válido, autorización denegada.";
        if (err.code === 'auth/id-token-expired') {
            errorMessage = "Token expirado. Por favor, inicia sesión de nuevo.";
        } else if (err.code === 'auth/argument-error' || err.code === 'auth/invalid-token') {
            errorMessage = "Token no válido o mal formado.";
        } else if (err.code) { // Otros errores de Firebase Auth Admin
            errorMessage = `Error de autenticación: ${err.code}.`;
        }
        res.status(401).json({ msg: errorMessage });
    }
};

module.exports = authMiddleware; // Exporta el middleware para usarlo en tus rutas