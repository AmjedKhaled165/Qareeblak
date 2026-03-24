const xss = require('xss');

/**
 * Middleware to sanitize all incoming request data (body, query, params)
 * Prevents Cross-Site Scripting (XSS) by cleaning HTML tags.
 */
const xssSanitizer = (req, res, next) => {
    const sanitize = (data) => {
        if (typeof data === 'string') {
            return xss(data);
        }
        if (typeof data === 'object' && data !== null) {
            for (const key in data) {
                data[key] = sanitize(data[key]);
            }
        }
        return data;
    };

    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);

    next();
};

module.exports = xssSanitizer;
