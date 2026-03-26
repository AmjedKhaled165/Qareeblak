const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v2: cloudinary } = require('cloudinary');

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────
const IMAGE_CONFIG = {
    maxWidth: 800,          // Resize to max 800px width
    quality: 80,            // WebP quality (0-100)
    format: 'webp',         // Output format
};

// ─────────────────────────────────────────────────────────────────
// HELPER: Process buffer with sharp (for memoryStorage path)
// ─────────────────────────────────────────────────────────────────
const processBuffer = async (buffer) => {
    return await sharp(buffer)
        .resize({ width: IMAGE_CONFIG.maxWidth, withoutEnlargement: true })
        .webp({ quality: IMAGE_CONFIG.quality })
        .toBuffer();
};

// ─────────────────────────────────────────────────────────────────
// HELPER: Process file on disk (for diskStorage path)
// ─────────────────────────────────────────────────────────────────
const processFile = async (file) => {
    const outputPath = file.path.replace(path.extname(file.path), '.webp');

    await sharp(file.path)
        .resize({ width: IMAGE_CONFIG.maxWidth, withoutEnlargement: true })
        .webp({ quality: IMAGE_CONFIG.quality })
        .toFile(outputPath);

    // Delete original to save space
    try { await fs.unlink(file.path); } catch (_) { /* ignore */ }

    file.path = outputPath;
    file.mimetype = 'image/webp';
    file.filename = path.basename(outputPath);
};

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE 1: optimizeImage  — works on disk storage
// Use AFTER multer with diskStorage.
// ─────────────────────────────────────────────────────────────────
const optimizeImage = async (req, res, next) => {
    if (!req.file && !req.files) return next();

    try {
        if (req.file) {
            await processFile(req.file);
        } else if (req.files) {
            const files = Array.isArray(req.files)
                ? req.files
                : Object.values(req.files).flat();
            await Promise.all(files.map(processFile));
        }
        next();
    } catch (error) {
        console.error('[Sharp] Image optimization failed:', error.message);
        next(); // Proceed anyway – don't block the upload
    }
};

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE 2: optimizeBuffer  — works on memoryStorage (buffer)
// Use BEFORE uploadToCloudinary when multer uses memoryStorage.
// ─────────────────────────────────────────────────────────────────
const optimizeBuffer = async (req, res, next) => {
    if (!req.file?.buffer) return next();

    try {
        req.file.buffer = await processBuffer(req.file.buffer);
        req.file.mimetype = 'image/webp';
        req.file.originalname = req.file.originalname.replace(/\.\w+$/, '.webp');
        next();
    } catch (error) {
        console.error('[Sharp] Buffer optimization failed:', error.message);
        next(); // Proceed anyway
    }
};

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE 3: uploadToCloudinary  — memoryStorage → Cloudinary
// ─────────────────────────────────────────────────────────────────
const uploadToCloudinary = async (req, res, next) => {
    if (!req.file) return next();

    try {
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'qareeblak/chat',
                    format: 'webp',          // Cloudinary also enforces WebP
                    quality: 'auto:good',    // Cloudinary secondary compression
                    transformation: [{ width: IMAGE_CONFIG.maxWidth, crop: 'limit' }]
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        req.file.cloudinaryUrl = result.secure_url;
        req.file.cloudinaryPublicId = result.public_id;
        next();
    } catch (error) {
        console.error('[Cloudinary] Upload failed:', error.message);
        next(error);
    }
};

module.exports = { optimizeImage, optimizeBuffer, uploadToCloudinary };
