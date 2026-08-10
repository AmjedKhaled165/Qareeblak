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

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        logger.warn('[Mailer] SMTP credentials missing (SMTP_USER/SMTP_PASS) — email sending is disabled.');
        return null;
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    const isSecure = port === 465; // SSL on 465, STARTTLS on 587 or 25

    _transporter = nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
        },
        pool: true,       // Reuse connections
        maxConnections: 3, // Limit concurrent SMTP connections
        maxMessages: 100,  // Recycle connection after 100 messages
    });

    // Verify connection on first use (non-blocking)
    _transporter.verify()
        .then(() => logger.info(`[Mailer] ✅ SMTP connection verified successfully to ${host}:${port}`))
        .catch((err) => logger.warn(`[Mailer] ⚠️ SMTP verification failed for ${host}:${port} — ${err.message}`));

    return _transporter;
}

/**
 * Verify SMTP connection on demand.
 * @returns {Promise<boolean>}
 */
async function verifySmtpConnection() {
    const transporter = getTransporter();
    if (!transporter) return false;
    try {
        await transporter.verify();
        return true;
    } catch (err) {
        logger.error(`[Mailer] Verification failed: ${err.message}`);
        return false;
    }
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
        logger.warn(`[Mailer] Cannot send email to ${to} — SMTP credentials not configured.`);
        return false;
    }

    const from = process.env.SMTP_FROM || `"Qareeblak | قريبلك" <${process.env.SMTP_USER}>`;

    try {
        await transporter.sendMail({ from, to, subject, html });
        logger.info(`[Mailer] Email sent successfully to ${to} (subject: "${subject}")`);
        return true;
    } catch (err) {
        logger.error(`[Mailer] Failed to send email to ${to}: ${err.message}`);
        throw err;
    }
}

module.exports = { sendMail, verifySmtpConnection, getTransporter };

