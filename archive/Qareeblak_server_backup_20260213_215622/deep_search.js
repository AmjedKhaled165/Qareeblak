const pool = require('./db');

async function search() {
    try {
        const result = await pool.query(`
            SELECT id, name, username, phone, email, user_type, created_at 
            FROM users 
            WHERE phone LIKE '%015%' OR name ILIKE '%amjed%' OR username ILIKE '%amjed%'
        `);
        console.log(JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

search();
