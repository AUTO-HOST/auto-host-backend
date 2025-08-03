const jwt = require('jsonwebtoken');
const { admin } = require('../firebaseAdmin'); // Importamos la instancia de Firebase Admin SDK

const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ msg: 'No hay token de autenticación, autorización denegada' });
    }

    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
        const decodedToken = await admin.auth().verifyIdToken(tokenWithoutBearer);
        console.log("Token de Firebase verificado con éxito. UID:", decodedToken.uid);

        req.user = { userId: decodedToken.uid, email: decodedToken.email };

        next();

    } catch (err) {
        console.error("Error al verificar idToken de Firebase con Admin SDK:", err);
        let errorMessage = "Token no válido, autorización denegada.";
        if (err.code === 'auth/id-token-expired') {
            errorMessage = "Token expirado. Por favor, inicia sesión de nuevo.";
        } else if (err.code === 'auth/argument-error' || err.code === 'auth/invalid-token') {
            errorMessage = "Token no válido o mal formado.";
        } else if (err.code) {
            errorMessage = `Error de autenticación: ${err.code}.`;
        }
        res.status(401).json({ msg: errorMessage });
    }
};

module.exports = authMiddleware;