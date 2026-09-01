// scripts/test-smtp.js
// Run from terminal: node scripts/test-smtp.js

const path = require('path');
const fs = require('fs');

// Attempt loading dotenv
try {
    require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    try {
        nodemailer = require(path.join(__dirname, '../server/node_modules/nodemailer'));
    } catch (e2) {
        console.error('❌ Could not locate nodemailer module. Make sure to run npm install in server directory.');
        process.exit(1);
    }
}

async function main() {
    console.log('--- Qareeblak SMTP Diagnostic Tool ---');
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    console.log(`SMTP Host: ${host}`);
    console.log(`SMTP Port: ${port}`);
    console.log(`SMTP User: ${user ? user : '❌ (NOT CONFIGURED)'}`);
    console.log(`SMTP Pass: ${pass ? '****' + pass.slice(-4) : '❌ (NOT CONFIGURED)'}`);

    if (!user || !pass) {
        console.error('\n❌ ERROR: SMTP_USER or SMTP_PASS is missing in your .env file.');
        console.error('Please configure SMTP_USER and SMTP_PASS to enable email sending.');
        process.exit(1);
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('\nVerifying SMTP connection...');
        await transporter.verify();
        console.log('✅ Success! SMTP connection verified. Credentials are valid.');

        // Optional test email
        const targetEmail = process.argv[2];
        if (targetEmail) {
            console.log(`\nSending test email to: ${targetEmail}...`);
            await transporter.sendMail({
                from: `"Qareeblak Diagnostic" <${user}>`,
                to: targetEmail,
                subject: 'Qareeblak SMTP Diagnostic Test 🚀',
                html: '<p>This is a test email sent from the Qareeblak SMTP diagnostic tool.</p>'
            });
            console.log('✅ Test email delivered successfully!');
        } else {
            console.log('\n💡 Tip: You can pass a recipient email as an argument to test delivery:');
            console.log('  node scripts/test-smtp.js test@example.com');
        }
    } catch (err) {
        console.error('\n❌ SMTP Error:', err.message);
        if (err.message.includes('Invalid login') || err.code === 'EAUTH') {
            console.error('💡 Hint: If using Gmail, ensure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Gmail password).');
        } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
            console.error('💡 Hint: Outbound port 465/587 may be blocked by your network or hosting provider firewall.');
        }
        process.exit(1);
    }
}

main();
