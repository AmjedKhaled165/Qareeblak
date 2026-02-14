const pool = require('./db');

async function listAllUsers() {
    try {
        const result = await pool.query(`
            SELECT id, name, username, phone, email, user_type, created_at
            FROM users 
            ORDER BY created_at DESC
            LIMIT 20
        `);

        console.log('--- Recent Users ---');
        console.table(result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error listing users:', error);
        process.exit(1);
    }
}

listAllUsers();
