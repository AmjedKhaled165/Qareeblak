/**
 * Chat Security & Disintermediation Protection Utility
 * Prevents phone number sharing, external messaging links, and off-platform deal circumvention.
 */

const logger = require('./logger');

// Regex for standard Egyptian phone numbers (English & Arabic numerals)
const EGYPTIAN_PHONE_REGEX = /(?:(?:\+?20|0020|0)?1[0125][0-9]{8})|(?:٠١[٠١٢٥][٠-٩]{٨})/gi;

// Regex for numbers separated by spaces, dots, dashes, underscores (e.g. 0 1 0 1 2 3 4 5 6 7 8)
const OBFUSCATED_PHONE_REGEX = /(?:0|٠)[\s._\-]*1[\s._\-]*[0125٠١٢٥](?:[\s._\-]*[0-9٠-٩]){8}/gi;

// External messaging & social contact URLs/keywords
const EXTERNAL_CONTACT_REGEX = /(?:wa\.me|whatsapp\.com|t\.me|telegram\.me|facebook\.com|fb\.me|instagram\.com|تواتس|واتساب|واتس|تليجرام|تليجرام|رقمي|كلمني على|اتصل بي على)/gi;

// Spelled out Arabic phone prefixes
const ARABIC_SPELLED_NUMBERS_REGEX = /(?:زيرو\s*(?:عشرة|عشره|حداشر|اثنا عشر|اثناعشر|خمسة عشر|خمسطعش))/gi;

/**
 * Sanitizes a chat message to remove sensitive phone numbers or external contact links.
 * @param {string} text - The input message string.
 * @returns {{ sanitizedMessage: string, isMasked: boolean }}
 */
function sanitizeChatMessage(text) {
    if (!text || typeof text !== 'string') {
        return { sanitizedMessage: text, isMasked: false };
    }

    let isMasked = false;
    let sanitized = text;

    const MASK_TEXT = '[تم حجب بيانات التواصل الخارجي لحمايتك وضمان تقديم الخدمة والسكن عبر المنصة 🛡️]';

    // 1. Check & Mask Obfuscated numbers (0 1 0 1 2 3 4 5 ...)
    if (OBFUSCATED_PHONE_REGEX.test(sanitized)) {
        isMasked = true;
        sanitized = sanitized.replace(OBFUSCATED_PHONE_REGEX, MASK_TEXT);
    }

    // 2. Check & Mask Direct Egyptian phone numbers
    if (EGYPTIAN_PHONE_REGEX.test(sanitized)) {
        isMasked = true;
        sanitized = sanitized.replace(EGYPTIAN_PHONE_REGEX, MASK_TEXT);
    }

    // 3. Check & Mask Spelled out numbers
    if (ARABIC_SPELLED_NUMBERS_REGEX.test(sanitized)) {
        isMasked = true;
        sanitized = sanitized.replace(ARABIC_SPELLED_NUMBERS_REGEX, MASK_TEXT);
    }

    // 4. Check & Mask external contact links / keywords
    if (EXTERNAL_CONTACT_REGEX.test(sanitized)) {
        isMasked = true;
        sanitized = sanitized.replace(EXTERNAL_CONTACT_REGEX, MASK_TEXT);
    }

    if (isMasked) {
        logger.warn(`🛡️ [Chat Security] Blocked contact info in message: "${text.substring(0, 30)}..."`);
    }

    return { sanitizedMessage: sanitized, isMasked };
}

module.exports = {
    sanitizeChatMessage
};
