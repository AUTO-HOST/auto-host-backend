const jwt = require('jsonwebtoken'); // Necesitas tener 'jsonwebtoken' instalado (npm install jsonwebtoken)

const authMiddleware = (req, res, next) => {
    // 1. Obtener el token del encabezado de la petición
    // El token generalmente viene como "Bearer TOKEN_LARGO_AQUI"
    const token = req.header('Authorization');

    // 2. Verificar si no hay token
    if (!token) {
        // 401 Unauthorized: No hay token, el usuario no ha enviado credenciales
        return res.status(401).json({ msg: 'No hay token de autenticación, autorización denegada' });
    }

    // 3. Quitar la palabra "Bearer " del token
    // (Asegurarse de que el token es lo que esperamos)
    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
        // 4. Verificar el token
        // Usa el JWT_SECRET que tienes configurado en tus variables de entorno (local y en Render)
        const decoded = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);

        // 5. Adjuntar el objeto de usuario decodificado a la petición (req.user)
        // Esto hace que la información del usuario esté disponible en las rutas protegidas
        req.user = decoded.user; // Asumiendo que el payload de tu token tiene una propiedad 'user'
        
        // 6. Pasar al siguiente middleware o a la función de ruta
        next();

    } catch (err) {
        // Manejar diferentes errores del token
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: 'Token expirado' });
        }
        // 401 Unauthorized: Token no válido (firma incorrecta, formato incorrecto, etc.)
        res.status(401).json({ msg: 'Token no válido, autorización denegada' });
    }
};

module.exports = authMiddleware; // Exporta el middleware para usarlo en tus rutas