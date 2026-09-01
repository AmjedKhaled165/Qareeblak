const { z } = require('zod');
const logger = require('./logger');

/**
 * Enterprise Validation Service
 * Ensures the system never processes "garbage" data.
 * Patterns used by Stripe and Amazon for API reliability.
 */
class ValidationManager {
    /**
     * Middleware to validate request body
     */
    validateBody(schema) {
        return (req, res, next) => {
            try {
                schema.parse(req.body);
                next();
            } catch (err) {
                logger.warn(`Validation failed for ${req.originalUrl}:`, err.errors);
                return res.status(400).json({
                    error: 'بيانات غير صالحة',
                    details: err.errors.map(e => ({ path: e.path, message: e.message }))
                });
            }
        };
    }

    /**
     * Standard Schemas
     */
    get schemas() {
        return {
            id: z.number().positive(),
            phone: z.string().regex(/^01[0125][0-9]{8}$/, 'رقم هاتف مصري غير صحيح'),
            email: z.string().email(),
            pagination: z.object({
                page: z.number().default(1),
                limit: z.number().max(100).default(20)
            })
        };
    }
}

module.exports = new ValidationManager();
