const pino = require('pino');

// Enterprise logging strategy using Pino (3x faster than Winston, 6x faster than Bunyan)
// Designed for PM2 & Docker environments where stdout/stderr aggregation is preferred
const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    // Do not log PII (Personally Identifiable Information) or Passwords
    redact: [
        'req.headers.authorization',
        'req.body.password',
        'req.body.oldPassword',
        'req.body.newPassword',
        'res.body.token',
        'password'
    ],
    // Time formatting for readability and ISO parsing
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
    // Only use pretty print in development, production should be JSON
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined
});

module.exports = logger;
