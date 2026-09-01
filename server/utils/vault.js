const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes (256 bits)
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Enterprise PII Encryption Utility
 * Protects sensitive user data (Phone, Address, Email) at rest in the DB.
 */
class PIIVault {
    constructor() {
        if (!KEY && process.env.NODE_ENV === 'production') {
            logger.error('🔥 FATAL: ENCRYPTION_KEY is missing in production. PII protection disabled.');
        }
    }

    /**
     * @param {string} text
     * @returns {string|null} encrypted string (iv:authTag:encrypted)
     */
    encrypt(text) {
        if (!text || !KEY) return text;
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag().toString('hex');

            return `${iv.toString('hex')}:${authTag}:${encrypted}`;
        } catch (err) {
            logger.error('[Vault] Encryption failed:', err);
            return null;
        }
    }

    /**
     * @param {string} encryptedText
     * @returns {string|null} decrypted text
     */
    decrypt(encryptedText) {
        if (!encryptedText || !KEY || !encryptedText.includes(':')) return encryptedText;
        try {
            const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
            const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), Buffer.from(ivHex, 'hex'));

            decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (err) {
            logger.error('[Vault] Decryption failed (potential key mismatch or data corruption):', err);
            return null;
        }
    }
}

module.exports = new PIIVault();
