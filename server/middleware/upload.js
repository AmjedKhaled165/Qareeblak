const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v2: cloudinary } = require('cloudinary');

/**
 * Middleware to optimize uploaded images (local disk storage path)
 * Auto-resizes to 800px max width, converts to webp, and compresses.
 */
const optimizeImage = async (req, res, next) => {
    if (!req.file && !req.files) return next();

    const processImage = async (file) => {
        const outputPath = file.path.replace(path.extname(file.path), '.webp');

        await sharp(file.path)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(outputPath);

        // Delete original file to save space
        await fs.unlink(file.path);

        // Update file info for next middleware
        file.path = outputPath;
        file.mimetype = 'image/webp';
    };

    try {
        if (req.file) {
            await processImage(req.file);
        } else if (req.files) {
            await Promise.all(Object.values(req.files).flat().map(processImage));
        }
        next();
    } catch (error) {
        console.error('Image optimization failed:', error);
        next(); // Proceed anyway, just log the failure
    }
};

/**
 * Middleware to upload image buffer to Cloudinary (memoryStorage path)
 * Requires: multer configured with memoryStorage and CLOUDINARY_* env vars set.
 * Attaches req.file.cloudinaryUrl and req.file.cloudinaryPublicId to the request.
 */
const uploadToCloudinary = async (req, res, next) => {
    if (!req.file) return next();

    try {
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'qareeblak/chat',
                    format: 'webp',
                    quality: 'auto:good',
                    transformation: [{ width: 800, crop: 'limit' }]
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
        console.error('Cloudinary upload failed:', error);
        next(error);
    }
};

module.exports = { optimizeImage, uploadToCloudinary };
