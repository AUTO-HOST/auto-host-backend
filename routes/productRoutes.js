const express = require('express');
const router = express.Router();
const Product = require('../models/Product'); // Ruta relativa desde routes/
const multer = require('multer');
const { admin } = require('../firebaseAdmin'); // Ruta relativa desde routes/

// --- CAMBIO IMPORTANTE AQUÍ ---
// Importa authMiddleware directamente como una función
const authMiddleware = require('../middleware/authMiddleware');
// --- FIN DEL CAMBIO IMPORTANTE ---

// ¡ELIMINADA LA LÍNEA GLOBAL DE BUCKET! Ahora se inicializa dentro de las rutas.
// const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);


// Configuración de Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// === RUTAS ===

router.post('/',
  (req, res, next) => { console.log("DEBUG: Solicitud POST /api/products enrutada."); next(); },
  authMiddleware,
  (req, res, next) => { console.log("DEBUG: authMiddleware procesado. Usuario:", req.user ? req.user.userId : "No autenticado"); next(); },
  upload.single('image'),
  (req, res, next) => { console.log("DEBUG: Multer procesado. Archivo:", req.file ? req.file.originalname : "No hay archivo"); next(); },
  async (req, res) => {
    console.log("¡Solicitud POST /api/products recibida en el backend - dentro de la lógica!");
    console.log("DEBUG: Contenido de req.body:", req.body);

    try {
      const sellerId = req.user.userId;
      // --- AÑADIDA AQUÍ: Inicialización del bucket dentro de la ruta POST ---
      const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
      // --- FIN DE LA LÍNEA AÑADIDA ---

      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ninguna imagen.' });
      }

      const sanitizedFilename = `${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const file = bucket.file(`products/${sanitizedFilename}`);

      const stream = file.createWriteStream({ metadata: { contentType: req.file.mimetype } });

      stream.on('error', (err) => {
        console.error("Error al subir a Firebase Storage:", err);
        res.status(500).send({ message: 'Error interno al subir la imagen.' });
      });

      stream.on('finish', async () => {
        try {
          await file.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

          const newProduct = new Product({
            ...req.body,
            imageUrl: publicUrl,
            user: sellerId
          });
          const savedProduct = await newProduct.save();

          res.status(201).json({ message: 'Producto creado con éxito', product: savedProduct });
        } catch (dbError) {
          console.error('Error al guardar el producto en DB:', dbError);
          res.status(500).json({ message: 'Error al crear el producto en la base de datos.' });
        }
      });

      stream.end(req.file.buffer);

    } catch (error) {
      console.error("Error en la ruta de creación de producto:", error);
      res.status(400).json({ message: 'Error al procesar la solicitud para crear el producto.', error: error.message });
    }
  }
);

// --- RUTA PARA OBTENER TODOS LOS PRODUCTOS ---
router.get('/', async (req, res) => {
    try {
        const { name, category, condition, minPrice, maxPrice, brand, sellerId, page, limit, sort } = req.query;

        let filter = {};

        if (name) { filter.name = { $regex: name, $options: 'i' }; }
        if (category && category !== 'Todas') { filter.category = category; }
        if (condition && condition !== 'Todas') { filter.condition = condition; }
        if (brand && brand !== 'Todas') { filter.marca_refaccion = brand; }
        if (sellerId) { filter.user = sellerId; }

        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) { filter.price.$gte = parseFloat(minPrice); }
            if (maxPrice) { filter.price.$lte = parseFloat(maxPrice); }
        }

        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 9;
        const skip = (pageNumber - 1) * limitNumber;

        let sortOptions = {};
        switch (sort) {
            case 'priceAsc':
                sortOptions = { price: 1 };
                break;
            case 'priceDesc':
                sortOptions = { price: -1 };
                break;
            case 'recent':
            default:
                sortOptions = { createdAt: -1 };
                break;
        }

        const totalProducts = await Product.countDocuments(filter);
        const products = await Product.find(filter)
                                     .sort(sortOptions)
                                     .skip(skip)
                                     .limit(limitNumber);

        res.json({
            products,
            totalProducts,
            currentPage: pageNumber,
            productsPerPage: limitNumber
        });

    } catch(err) {
        console.error("Error al obtener productos con filtros y paginación (MongoDB):", err);
        res.status(500).json({ message: "Error del servidor al obtener los productos" });
    }
});

// --- RUTA PARA OBTENER UN PRODUCTO POR SU ID ---
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Producto no encontrado.' });
        }
    } catch(err) {
        console.error("Error al obtener un producto por ID (MongoDB):", err);
        res.status(500).json({ message: "Error del servidor al obtener el producto" });
    }
});

// --- RUTA: ACTUALIZAR UN PRODUCTO ---
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
    console.log(`DEBUG: Solicitud PUT /api/products/${req.params.id} recibida.`);
    console.log("DEBUG: Contenido de req.body para PUT:", req.body);
    try {
        const productId = req.params.id;
        const userId = req.user.userId;

        // --- AÑADIDA AQUÍ: Inicialización del bucket dentro de la ruta PUT ---
        const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
        // --- FIN DE LA LÍNEA AÑADIDA ---

        const product = await Product.findById(productId);

        if (!product) {
            console.error("Error PUT: Producto no encontrado para actualizar.");
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }

        if (product.user !== userId) {
            console.error(`Error PUT: Acceso denegado. Producto ${productId} no pertenece a usuario ${userId}. Dueño real: ${product.user}`);
            return res.status(403).json({ message: 'Acceso denegado. No tienes permiso para editar este producto.' });
        }

        const updateData = { ...req.body };

        if (req.file) {
            if (product.imageUrl && !product.imageUrl.includes("placehold.it")) {
                try {
                    const fileName = product.imageUrl.split('/').pop().split('?')[0];
                    const fileRef = bucket.file(`products/${fileName}`);
                    await fileRef.delete();
                    console.log(`DEBUG: Imagen antigua ${fileName} eliminada de Storage.`);
                } catch (storageErr) {
                    console.warn("ADVERTENCIA: No se pudo eliminar la imagen antigua de Storage:", storageErr.message);
                }
            }
            const sanitizedFilename = `${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
            const file = bucket.file(`products/${sanitizedFilename}`);
            const stream = file.createWriteStream({ metadata: { contentType: req.file.mimetype } });

            await new Promise((resolve, reject) => {
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(req.file.buffer);
            });
            await file.makePublic();
            updateData.imageUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
            console.log(`DEBUG: Nueva imagen subida a Storage: ${updateData.imageUrl}`);
        } else {
            updateData.imageUrl = product.imageUrl;
            console.log("DEBUG: No se subió nueva imagen, manteniendo la existente.");
        }

        const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true, runValidators: true });

        if (!updatedProduct) {
            console.error("Error PUT: No se pudo actualizar el producto (Mongoose update falló).");
            return res.status(500).json({ message: 'Error al actualizar el producto.' });
        }

        console.log("DEBUG: Producto actualizado con éxito:", updatedProduct._id);
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error("Error en la ruta PUT /api/products/:id (MongoDB):", error);
        res.status(400).json({ message: 'Error al procesar la solicitud de actualización.', error: error.message });
    }
});

// --- RUTA: ELIMINAR UN PRODUCTO ---
router.delete('/:id', authMiddleware, async (req, res) => {
    console.log(`DEBUG: Solicitud DELETE /api/products/${req.params.id} recibida.`);
    try {
        const productId = req.params.id;
        const userId = req.user.userId;

        console.log(`DEBUG: Intentando eliminar producto con ID: ${productId} por usuario: ${userId}`);

        let product;
        try {
            product = await Product.findById(productId);
            console.log(`DEBUG: Producto encontrado (si existe):`, product ? product._id : 'null/undefined');
        } catch (findError) {
            console.error("Error DELETE: Falló Product.findById:", findError.message);
            if (findError.name === 'CastError') {
                return res.status(400).json({ message: 'ID de producto inválido.' });
            }
            return res.status(500).json({ message: 'Error al buscar el producto para eliminar.' });
        }

        if (!product) {
            console.error("Error DELETE: Producto no encontrado para eliminar.");
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }

        console.log(`DEBUG: Producto encontrado. ID del producto: ${product._id}, ID de su dueño: ${product.user}`);
        console.log(`DEBUG: ID del usuario autenticado: ${userId}`);

        if (product.user !== userId) {
            console.error(`Error DELETE: Acceso denegado. Producto ${productId} no pertenece a usuario ${userId}. Dueño real: ${product.user}`);
            return res.status(403).json({ message: 'Acceso denegado. No tienes permiso para eliminar este producto.' });
        }
        console.log("DEBUG: Verificación de propiedad exitosa.");

        if (product.imageUrl && !product.imageUrl.includes("placehold.it")) {
            try {
                const fileName = product.imageUrl.split('/').pop().split('?')[0];
                const fileRef = bucket.file(`products/${fileName}`);
                await fileRef.delete();
                console.log(`DEBUG: Imagen ${fileName} eliminada de Storage.`);
            } catch (storageErr) {
                console.warn("ADVERTENCIA: No se pudo eliminar la imagen antigua de Storage:", storageErr.message);
            }
        }
        console.log("DEBUG: Lógica de eliminación de imagen completada.");

        const deletedProduct = await Product.findByIdAndDelete(productId);
        console.log(`DEBUG: Resultado de findByIdAndDelete:`, deletedProduct ? deletedProduct._id : 'null/undefined');

        if (!deletedProduct) {
            console.error("Error DELETE: No se pudo eliminar el producto (findByIdAndDelete falló).");
            return res.status(500).json({ message: 'Error al eliminar el producto.' });
        }

        console.log("DEBUG: Producto eliminado con éxito:", deletedProduct._id);
        res.status(200).json({ message: 'Producto eliminado exitosamente', deletedProduct: deletedProduct });

    } catch (error) {
        console.error("Error en la ruta DELETE /api/products/:id:", error);
        res.status(400).json({ message: 'Error al procesar la solicitud de eliminación.', error: error.message });
    }
});

module.exports = router;