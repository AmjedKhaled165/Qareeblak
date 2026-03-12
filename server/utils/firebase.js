const admin = require('firebase-admin');
const logger = require('./logger');

const normalizePrivateKey = (rawKey = '') => {
    let key = String(rawKey || '').trim();

    // Remove surrounding quotes that can be injected by env editors.
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")) || (key.startsWith('`') && key.endsWith('`'))) {
        key = key.slice(1, -1);
    }

    // Normalize escaped and platform newlines.
    key = key.replace(/\\r/g, '');
    key = key.replace(/\\n/g, '\n');
    key = key.replace(/\r/g, '');

    // Ensure valid PEM boundary line breaks.
    key = key.replace(/-----BEGIN PRIVATE KEY-----\s*/, '-----BEGIN PRIVATE KEY-----\n');
    key = key.replace(/\s*-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');

    // Trim trailing spaces from each line without touching payload characters.
    key = key
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();

    return `${key}\n`;
};

/**
 * Initialize Firebase Admin SDK
 * Uses environment variables for service account credentials
 */
const initializeFirebase = () => {
    try {
        if (admin.apps.length > 0) {
            return admin.app();
        }

        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId) {
            logger.warn('⚠️ Firebase Project ID missing. Google Sync/FCM will be limited.');
            return null;
        }

        // Production setup with Service Account
        if (clientEmail && privateKey) {
            // Normalize key formatting to survive env editor escaping/quoting issues.
            const formattedKey = normalizePrivateKey(privateKey);
            
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: formattedKey,
                }),
            });
            logger.info('🚀 Firebase Admin SDK initialized with Service Account');
        } else {
            // Limited initialization for basic tasks
            admin.initializeApp({
                projectId: projectId
            });
            logger.info(`ℹ️ Firebase initialized in limited mode (Project ID: ${projectId})`);
        }

        return admin.app();
    } catch (error) {
        logger.error(`❌ Firebase initialization failed: ${error.message}`);
        return null;
    }
};

module.exports = {
    admin,
    initializeFirebase
};
