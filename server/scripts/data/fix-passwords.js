const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'qareeblak',
    user: 'postgres',
    password: 'qareeblak123'
});

async function updatePasswords() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);

        console.log('Update starting...');
        const result = await pool.query(
            "UPDATE users SET password = $1 WHERE email IN ('baraka@example.com', 'ahmed@example.com', 'admin@waticket.com')",
            [hashedPassword]
        );

        console.log(`✅ Updated ${result.rowCount} user passwords to hashed format.`);
    } catch (err) {
        console.error('❌ Error updating passwords:', err);
    } finally {
        await pool.end();
        process.exit();
    }
}

updatePasswords();
