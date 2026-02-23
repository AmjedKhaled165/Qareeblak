/* eslint-disable */
const db = require('./db');
const { pool } = db;

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('Usage: node server/update-user-email.js <current_email_or_id> <new_email>');
    console.log('Example: node server/update-user-email.js old@example.com new@example.com');
    process.exit(1);
}

const identifier = args[0];
const newEmail = args[1];

async function updateUserEmail() {
    try {
        console.log(`🔍 Searching for user: "${identifier}"...`);

        // Determine if identifier is ID (numeric) or Email/Username
        let queryStr = 'SELECT id, name, username, email FROM users WHERE username = $1 OR email = $1';
        let queryParams = [identifier];

        if (!isNaN(identifier)) {
            queryStr = 'SELECT id, name, username, email FROM users WHERE id = $1';
            queryParams = [parseInt(identifier)];
        }

        const userCheck = await db.query(queryStr, queryParams);

        if (userCheck.rows.length === 0) {
            console.error(`❌ User not found: ${identifier}`);
            process.exit(1);
        }

        const user = userCheck.rows[0];
        console.log(`✅ Found user: ${user.name} (ID: ${user.id})`);
        console.log(`📧 Current Email: ${user.email}`);

        // Check if new email is valid format (basic check)
        if (!newEmail.includes('@')) {
            console.error('❌ Invalid email format for new email.');
            process.exit(1);
        }

        // Check if new email is already taken
        const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [newEmail]);
        if (emailCheck.rows.length > 0) {
            console.error(`❌ The email "${newEmail}" is already used by another account (ID: ${emailCheck.rows[0].id}).`);
            process.exit(1);
        }

        // Update DB
        await db.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, user.id]);

        console.log(`\n🎉 Email updated successfully for ${user.name}!`);
        console.log(`Old Email: ${user.email}`);
        console.log(`New Email: ${newEmail}`);

    } catch (error) {
        console.error('❌ Error updating email:', error);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

updateUserEmail();
