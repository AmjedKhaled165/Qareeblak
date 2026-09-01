/* eslint-disable */
const db = require('./db');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('Usage: node server/reset-user-password.js <username_or_id> <new_password>');
    process.exit(1);
}

const identifier = args[0];
const newPassword = args[1];

async function resetPassword() {
    try {
        console.log(`🔐 Resetting password for user: "${identifier}"...`);

        // Determine if identifier is ID (numeric), Email (contains @), or Username (string)
        let queryStr = 'SELECT id, name, username, email FROM users WHERE username = $1';
        let queryParams = [identifier];

        if (!isNaN(identifier)) {
            queryStr = 'SELECT id, name, username, email FROM users WHERE id = $1';
            queryParams = [parseInt(identifier)];
        } else if (identifier.includes('@')) {
            queryStr = 'SELECT id, name, username, email FROM users WHERE email = $1';
            queryParams = [identifier];
        }

        const userCheck = await db.query(queryStr, queryParams);

        if (userCheck.rows.length === 0) {
            console.error(`❌ User not found: ${identifier}`);
            process.exit(1);
        }

        const user = userCheck.rows[0];
        console.log(`✅ Found user: ${user.name} (@${user.username}) - ID: ${user.id}`);

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update DB
        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

        console.log(`\n🎉 Password updated successfully for ${user.name}!`);
        console.log(`👉 New Password: ${newPassword}`);
        console.log(`👉 Hashed Value: ${hashedPassword.substring(0, 20)}...`);

    } catch (error) {
        console.error('❌ Error resetting password:', error);
    } finally {
        if (db.pool) {
            await db.pool.end();
        }
    }
}

resetPassword();
