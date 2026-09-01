const Sentry = require('@sentry/node');
const logger = require('./logger');

/**
 * Enterprise Monitoring Utility
 * Combines Winston for local logging and Sentry for cloud error tracking.
 */
class Monitoring {
    static init() {
        if (process.env.SENTRY_DSN) {
            Sentry.init({
                dsn: process.env.SENTRY_DSN,
                environment: process.env.NODE_ENV || 'development',
                tracesSampleRate: 1.0,
            });
            logger.info('🛰️ Sentry Monitoring initialized');
        }
    }

    static captureException(error, context = {}) {
        logger.error(error.message, { stack: error.stack, ...context });
        if (process.env.SENTRY_DSN) {
            Sentry.captureException(error, { extra: context });
        }
    }

    static logEvent(message, level = 'info', data = {}) {
        logger.log(level, message, data);
        if (process.env.SENTRY_DSN && level === 'error') {
            Sentry.captureMessage(message, { level, extra: data });
        }
    }
}

module.exports = Monitoring;
