const logger = require('../utils/logger');
const AppError = require('../utils/appError');

const handleJWTError = () => new AppError('رمز غير صالح، الرجاء تسجيل الدخول مجددا', 401);
const handleJWTExpiredError = () => new AppError('انتهت صلاحية الجلسة، قم بتسجيل الدخول', 401);

const sendErrorDev = (err, req, res) => {
    res.status(err.statusCode || 500).json({
        status: err.status || 'error',
        error: err.message,
        stack: err.stack,
        internalError: err
    });
};

const sendErrorProd = (err, req, res) => {
    // Operational
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err.message
        });
    }

    // Programming or unknown errors (Leak zero details but alert Sentry)
    logger.error('💥 UNEXPECTED ERROR 💥', err);
    
    // Capture to Sentry if initialized
    try {
        const Sentry = require('@sentry/node');
        if (process.env.SENTRY_DSN) {
            Sentry.captureException(err);
        }
    } catch (e) {
        // Sentry failed or not installed, ignore
    }

    return res.status(500).json({
        status: 'error',
        error: 'حدث خطأ داخلي في الخادم - مراقب السيرفر سجل العطل وسيتم مراجعته'
    });
};

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // To prevent crashing, log internally first
    logger.error(`Error processing path ${req.originalUrl}: ${err.message}`);

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, req, res);
    } else {
        let error = Object.assign({}, err);
        error.message = err.message;
        error.name = err.name;

        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error, req, res);
    }
};
