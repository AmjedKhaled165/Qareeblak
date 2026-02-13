const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Middleware to optimize uploaded images
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

module.exports = { optimizeImage };
