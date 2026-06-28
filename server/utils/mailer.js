const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Singleton SMTP transporter.
 * Reuses a single connection pool instead of creating a new transport per email.
 * Falls back gracefully when SMTP credentials are not configured.
 */
let _transporter = null;

function getTransporter() {
    if (_transporter) return _transporter;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('[Mailer] SMTP credentials missing — email sending is disabled.');
        return null;
    }

    _transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.zoho.com',
        port: parseInt(process.env.SMTP_PORT, 10) || 465,
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        pool: true,       // Reuse connections
        maxConnections: 3, // Limit concurrent SMTP connections
        maxMessages: 100,  // Recycle connection after 100 messages
    });

    // Verify connection on first use (non-blocking)
    _transporter.verify()
        .then(() => logger.info('[Mailer] ✅ SMTP connection verified successfully.'))
        .catch((err) => logger.warn(`[Mailer] ⚠️ SMTP verification failed: ${err.message}`));

    return _transporter;
}

/**
 * Send an email using the platform SMTP configuration.
 *
 * @param {object} options
 * @param {string} options.to       - Recipient email address
 * @param {string} options.subject  - Email subject line
 * @param {string} options.html     - Email HTML body
 * @returns {Promise<boolean>} true if sent, false if SMTP is not configured
 * @throws {Error} if SMTP is configured but sending fails
 */
async function sendMail({ to, subject, html }) {
    const transporter = getTransporter();

    if (!transporter) {
        logger.warn(`[Mailer] Cannot send email to ${to} — SMTP not configured.`);
        return false;
    }

    const from = `"Qareeblak | قريبلك" <${process.env.SMTP_USER}>`;

    await transporter.sendMail({ from, to, subject, html });
    logger.info(`[Mailer] Email sent to ${to} (subject: ${subject})`);
    return true;
}

module.exports = { sendMail };
