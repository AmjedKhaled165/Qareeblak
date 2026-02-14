const pool = require('./db');

async function listUsersJson() {
    try {
        const result = await pool.query(`
            SELECT id, name, username, phone, email, user_type, created_at
            FROM users 
            ORDER BY created_at DESC
            LIMIT 50
        `);

        console.log(JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error listing users:', error);
        process.exit(1);
    }
}

listUsersJson();
