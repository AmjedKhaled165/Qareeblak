const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function assignDriver() {
    try {
        await pool.query('INSERT INTO courier_supervisors (courier_id, supervisor_id) VALUES (21, 17) ON CONFLICT DO NOTHING');
        console.log('✅ Driver عمر (ID: 21) assigned to Manager حاتم (ID: 17)');

        // Verify
        const result = await pool.query('SELECT * FROM courier_supervisors WHERE courier_id = 21');
        console.log('Assignments for driver 21:', result.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

assignDriver();
