const multer = require('multer');
const path = require('path');
const fs = require('node:fs');
const { mkdir } = require('node:fs/promises');

const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// S3 Client setup
let s3;
let storage;

if (process.env.CLOUDINARY_CLOUD_NAME) {
    // Cloudinary path: hold file in RAM buffer, uploadToCloudinary middleware in upload.js handles the actual upload
    storage = multer.memoryStorage();
} else if (process.env.AWS_REGION && process.env.AWS_S3_BUCKET_NAME) {
    s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        // Setup endpoint for Cloudflare R2 / DigitalOcean Spaces if needed
        ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT })
    });

    storage = multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const folder = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
            cb(null, `${folder}/chat/chat_${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    });

    // We don't need local uploads, but leave fallback logic below
} else {
    // FALLBACK: Local disk storage ONLY for dev environment missing S3 vars
    const uploadDir = path.join(__dirname, '../uploads/chat');
    (async () => {
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch { /* directory already exists */ }
    })();

    storage = multer.diskStorage({
        destination: (req, file, cb) => {
            if (process.env.NODE_ENV === 'production') {
                console.warn('❌ CRITICAL: Running PM2 cluster Production without S3. Uploads will break across nodes.');
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'chat_' + uniqueSuffix + path.extname(file.originalname));
        }
    });
}

// File filter (strictly safe images only against XSS)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('هذا النوع من الملفات غير مسموح به. مسموح فقط بـ JPG, PNG, WEBP.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

module.exports = upload;
