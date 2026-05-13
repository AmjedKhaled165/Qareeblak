const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v2: cloudinary } = require('cloudinary');
const { BlobServiceClient } = require('@azure/storage-blob');

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────
const IMAGE_CONFIG = {
    maxWidth: Number(process.env.UPLOAD_IMAGE_MAX_WIDTH || 800),
    quality: Number(process.env.UPLOAD_IMAGE_QUALITY || 80),
    format: String(process.env.UPLOAD_IMAGE_FORMAT || 'webp').toLowerCase() === 'avif' ? 'avif' : 'webp',
};

const azureContainerName = process.env.AZURE_CONTAINER_NAME || 'images';
let azureContainerClientPromise;

const getOutputMimeType = () => (IMAGE_CONFIG.format === 'avif' ? 'image/avif' : 'image/webp');

const applyOutputFormat = (pipeline) => {
    if (IMAGE_CONFIG.format === 'avif') {
        return pipeline.avif({ quality: IMAGE_CONFIG.quality });
    }
    return pipeline.webp({ quality: IMAGE_CONFIG.quality });
};

const getAzureContainerClient = async () => {
    if (!process.env.AZURE_CONNECTION_STRING) return null;

    if (!azureContainerClientPromise) {
        azureContainerClientPromise = (async () => {
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(azureContainerName);
            await containerClient.createIfNotExists();
            return containerClient;
        })();
    }

    return azureContainerClientPromise;
};

// ─────────────────────────────────────────────────────────────────
// HELPER: Process buffer with sharp (for memoryStorage path)
// ─────────────────────────────────────────────────────────────────
const processBuffer = async (buffer) => {
    return await applyOutputFormat(
        sharp(buffer)
            .rotate()
            .resize({ width: IMAGE_CONFIG.maxWidth, withoutEnlargement: true })
    ).toBuffer();
};

// ─────────────────────────────────────────────────────────────────
// HELPER: Process file on disk (for diskStorage path)
// ─────────────────────────────────────────────────────────────────
const processFile = async (file) => {
    const outputPath = file.path.replace(path.extname(file.path), `.${IMAGE_CONFIG.format}`);

    await applyOutputFormat(
        sharp(file.path)
            .rotate()
            .resize({ width: IMAGE_CONFIG.maxWidth, withoutEnlargement: true })
    ).toFile(outputPath);

    // Delete original to save space
    try { await fs.unlink(file.path); } catch (_) { /* ignore */ }

    file.path = outputPath;
    file.mimetype = getOutputMimeType();
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
        req.file.mimetype = getOutputMimeType();
        req.file.originalname = req.file.originalname.replace(/\.[^.]+$/, `.${IMAGE_CONFIG.format}`);
        next();
    } catch (error) {
        console.error('[Sharp] Buffer optimization failed:', error.message);
        next(); // Proceed anyway
    }
};

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE 3: uploadToAzureBlob  — memoryStorage → Azure Blob
// ─────────────────────────────────────────────────────────────────
const uploadToAzureBlob = async (req, res, next) => {
    if (!req.file?.buffer) return next();

    try {
        const containerClient = await getAzureContainerClient();
        if (!containerClient) return next();

        const uniqueImageName = `chat-${Date.now()}-${Math.round(Math.random() * 1E9)}.${IMAGE_CONFIG.format}`;
        const blockBlobClient = containerClient.getBlockBlobClient(uniqueImageName);

        await blockBlobClient.uploadData(req.file.buffer, {
            blobHTTPHeaders: { blobContentType: req.file.mimetype || getOutputMimeType() }
        });

        req.file.azureUrl = blockBlobClient.url;
        req.file.location = blockBlobClient.url;
        next();
    } catch (error) {
        console.error('[Azure Blob] Upload failed:', error.message);
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE 4: uploadToCloudinary  — memoryStorage → Cloudinary
// ─────────────────────────────────────────────────────────────────
const uploadToCloudinary = async (req, res, next) => {
    if (!req.file) return next();

    if (req.file.location) return next();
    if (!process.env.CLOUDINARY_CLOUD_NAME) return next();

    try {
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'qareeblak/chat',
                    format: 'webp',          // Cloudinary also enforces WebP
                    quality: 'auto:good',    // Cloudinary secondary compression
                    transformation: [{ width: IMAGE_CONFIG.maxWidth, crop: 'limit' }],
                    headers: {
                        'Cache-Control': 'public, max-age=2592000' // Caching for 1 month
                    }
                },
                (error, result) => {
                    format: IMAGE_CONFIG.format,
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

module.exports = { optimizeImage, optimizeBuffer, uploadToAzureBlob, uploadToCloudinary };
