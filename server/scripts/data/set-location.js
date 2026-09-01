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

// Set آدم's location (ID: 26) to a test location in New Assiut
async function setLocation() {
    try {
        // Set location for آدم (ID: 26) - منطقة شمال الجامعة
        await pool.query(`
            UPDATE users 
            SET latitude = 27.2697, longitude = 31.2896, last_location_update = NOW() 
            WHERE id = 26
        `);
        console.log('✅ Set location for آدم (ID: 26)');

        // Verify
        const result = await pool.query(`
            SELECT id, name, latitude, longitude, last_location_update 
            FROM users WHERE id = 26
        `);
        console.log('Verification:', result.rows[0]);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

setLocation();
