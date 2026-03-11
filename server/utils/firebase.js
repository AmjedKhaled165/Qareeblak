const admin = require('firebase-admin');
const logger = require('./logger');

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
            // Fix for private key newlines in different environments
            const formattedKey = privateKey.replace(/\\n/g, '\n');
            
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
