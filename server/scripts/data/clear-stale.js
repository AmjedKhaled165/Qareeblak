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

async function clearStaleLocation() {
    try {
        // Clear عمر's old test location (ID: 21) - it's outside New Assiut
        await pool.query(`
            UPDATE users 
            SET latitude = NULL, longitude = NULL, last_location_update = NULL 
            WHERE id = 21
        `);
        console.log('✅ Cleared stale location for عمر (ID: 21)');

        // Verify only آدم has location now
        const result = await pool.query(`
            SELECT id, name, latitude, longitude 
            FROM users 
            WHERE user_type = 'partner_courier' 
            AND latitude IS NOT NULL
        `);
        console.log('\nCouriers with locations now:');
        result.rows.forEach(r => {
            console.log(`  ${r.name} (ID: ${r.id}): (${r.latitude}, ${r.longitude})`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

clearStaleLocation();
