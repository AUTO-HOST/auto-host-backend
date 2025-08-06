const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const { admin } = require('../firebaseAdmin');
const authMiddleware = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// === RUTA PARA CREAR UN PRODUCTO ===
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const sellerId = req.user.userId;
        const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

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
                // La línea file.makePublic() ha sido eliminada
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
});

// === OTRAS RUTAS (SIN CAMBIOS) ===

// RUTA PARA OBTENER TODOS LOS PRODUCTOS
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
            case 'priceAsc': sortOptions = { price: 1 }; break;
            case 'priceDesc': sortOptions = { price: -1 }; break;
            case 'recent': default: sortOptions = { createdAt: -1 }; break;
        }
        const totalProducts = await Product.countDocuments(filter);
        const products = await Product.find(filter).sort(sortOptions).skip(skip).limit(limitNumber);
        res.json({ products, totalProducts, currentPage: pageNumber, productsPerPage: limitNumber });
    } catch (err) {
        console.error("Error al obtener productos (MongoDB):", err);
        res.status(500).json({ message: "Error del servidor al obtener los productos" });
    }
});

// RUTA PARA OBTENER UN PRODUCTO POR SU ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Producto no encontrado.' });
        }
    } catch (err) {
        console.error("Error al obtener producto por ID (MongoDB):", err);
        res.status(500).json({ message: "Error del servidor al obtener el producto" });
    }
});

// RUTA: ACTUALIZAR UN PRODUCTO
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.user.userId;
        const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }
        if (product.user.toString() !== userId) { // .toString() es una buena práctica aquí
            return res.status(403).json({ message: 'Acceso denegado.' });
        }
        const updateData = { ...req.body };
        if (req.file) {
            if (product.imageUrl && !product.imageUrl.includes("placehold.it")) {
                try {
                    const oldFileName = product.imageUrl.split(`${bucket.name}/`)[1].split('?')[0];
                    if (oldFileName) {
                        const fileRef = bucket.file(oldFileName);
                        await fileRef.delete();
                    }
                } catch (storageErr) {
                    console.warn("ADVERTENCIA: No se pudo eliminar la imagen antigua:", storageErr.message);
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
            // La línea file.makePublic() ha sido eliminada
            updateData.imageUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        }
        const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true, runValidators: true });
        if (!updatedProduct) {
            return res.status(500).json({ message: 'Error al actualizar el producto.' });
        }
        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error("Error en ruta PUT /api/products/:id:", error);
        res.status(400).json({ message: 'Error al procesar la solicitud de actualización.', error: error.message });
    }
});

// RUTA: ELIMINAR UN PRODUCTO
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.user.userId;
        const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }
        if (product.user.toString() !== userId) {
            return res.status(403).json({ message: 'Acceso denegado.' });
        }
        if (product.imageUrl && !product.imageUrl.includes("placehold.it")) {
            try {
                const oldFileName = product.imageUrl.split(`${bucket.name}/`)[1].split('?')[0];
                if (oldFileName) {
                    const fileRef = bucket.file(oldFileName);
                    await fileRef.delete();
                }
            } catch (storageErr) {
                console.warn("ADVERTENCIA: No se pudo eliminar la imagen antigua:", storageErr.message);
            }
        }
        await Product.findByIdAndDelete(productId);
        res.status(200).json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error("Error en ruta DELETE /api/products/:id:", error);
        res.status(400).json({ message: 'Error al procesar la solicitud de eliminación.', error: error.message });
    }
});

module.exports = router;