const pool = require('./db');

async function checkUsers() {
    try {
        const result = await pool.query(`
            SELECT id, name, username, email, phone, user_type, length(password) as pass_len
            FROM users 
            WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
            ORDER BY id DESC
        `);

        console.log('--- Current Partner Users ---');
        console.table(result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error checking users:', error);
        process.exit(1);
    }
}

checkUsers();
