/* eslint-disable */
const db = require('./db');
const { pool } = db;

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('Usage: node server/update-user-role.js <username_or_email_or_id> <new_role>');
    console.log('Roles: partner_owner, partner_supervisor, partner_courier, customer, provider');
    process.exit(1);
}

const identifier = args[0];
const newRole = args[1];

async function updateUserRole() {
    try {
        console.log(`🔍 Searching for user: "${identifier}"...`);

        let queryStr = 'SELECT id, name, username, email, user_type FROM users WHERE username = $1 OR email = $1';
        let queryParams = [identifier];

        if (!isNaN(identifier)) {
            queryStr = 'SELECT id, name, username, email, user_type FROM users WHERE id = $1';
            queryParams = [parseInt(identifier)];
        }

        const userCheck = await db.query(queryStr, queryParams);

        if (userCheck.rows.length === 0) {
            console.error(`❌ User not found: ${identifier}`);
            process.exit(1);
        }

        const user = userCheck.rows[0];
        console.log(`✅ Found user: ${user.name} (ID: ${user.id})`);
        console.log(`Current Role: ${user.user_type}`);

        // Update DB
        await db.query('UPDATE users SET user_type = $1 WHERE id = $2', [newRole, user.id]);

        console.log(`\n🎉 Role updated successfully!`);
        console.log(`New Role: ${newRole}`);

    } catch (error) {
        console.error('❌ Error updating role:', error);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

updateUserRole();
