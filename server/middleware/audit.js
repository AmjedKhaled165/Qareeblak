const logger = require('../utils/logger');

/**
 * Middleware to log all sensitive or state-changing requests
 * Essential for security audits and troubleshooting production issues.
 */
const auditLogger = (req, res, next) => {
    // Only log state-changing methods
    const sensitiveMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (sensitiveMethods.includes(req.method)) {
        const userId = req.user ? req.user.id : 'anonymous';
        const userEmail = req.user ? req.user.email : 'N/A';

        // Don't log passwords or sensitive tokens
        const sanitizedBody = { ...req.body };
        const sensitiveFields = ['password', 'token', 'oldPassword', 'newPassword', 'secret'];
        sensitiveFields.forEach(field => {
            if (sanitizedBody[field]) sanitizedBody[field] = '[REDACTED]';
        });

        logger.info('AUDIT_LOG', {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            userId,
            userEmail,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            body: sanitizedBody
        });
    }
    next();
};

module.exports = auditLogger;
