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

async function checkAndSeedLocations() {
    try {
        console.log('🔍 Checking existing locations...');
        const res = await pool.query(`
            SELECT id, name, username, latitude, longitude, last_location_update
            FROM users
            WHERE user_type = 'partner_courier'
        `);

        console.log(`Found ${res.rowCount} couriers.`);
        const hasLocation = res.rows.filter(r => r.latitude !== null).length;
        console.log(`${hasLocation} drivers have location data.`);

        res.rows.forEach(r => {
            console.log(`- ${r.name} (${r.id}): ${r.latitude ? `${r.latitude}, ${r.longitude}` : 'NO LOCATION'}`);
        });

        if (hasLocation === 0 && res.rowCount > 0) {
            console.log('\n⚠️ No locations found! injecting test location for first driver...');
            const driver = res.rows[0];

            // Assiut Center: 27.18096, 31.18368
            await pool.query(`
                UPDATE users 
                SET latitude = 27.181, longitude = 31.184, last_location_update = NOW()
                WHERE id = $1
            `, [driver.id]);

            console.log(`✅ Injected test location for ${driver.name} (ID: ${driver.id}). Restart server to load it.`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkAndSeedLocations();
