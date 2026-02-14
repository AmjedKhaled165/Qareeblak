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

async function debugManagerDrivers() {
    try {
        console.log('=== 🔍 DEBUGGING MANAGER-DRIVER ASSIGNMENTS ===\n');

        // 1. Get all managers (supervisors)
        const managers = await pool.query(`
            SELECT id, name, username 
            FROM users 
            WHERE user_type = 'partner_supervisor'
        `);
        console.log(`📋 Found ${managers.rowCount} managers:\n`);

        for (const manager of managers.rows) {
            console.log(`--- Manager: ${manager.name} (ID: ${manager.id}) ---`);

            // Get drivers assigned to this manager using supervisor_id
            const drivers = await pool.query(`
                SELECT id, name, latitude, longitude, last_location_update, is_available, supervisor_id
                FROM users
                WHERE user_type = 'partner_courier'
                AND supervisor_id = $1
            `, [manager.id]);

            console.log(`   Assigned Drivers (via supervisor_id): ${drivers.rowCount}`);
            drivers.rows.forEach(d => {
                const hasLocation = d.latitude !== null;
                console.log(`   - ${d.name} (ID: ${d.id}) | Available: ${d.is_available} | Location: ${hasLocation ? `YES (${d.latitude}, ${d.longitude})` : 'NO'}`);
            });

            console.log('');
        }

        // 2. Check all couriers with locations
        console.log('=== 📍 ALL COURIERS WITH LOCATIONS ===\n');
        const couriersWithLocation = await pool.query(`
            SELECT id, name, latitude, longitude, is_available, supervisor_id
            FROM users
            WHERE user_type = 'partner_courier'
            AND latitude IS NOT NULL
        `);

        console.log(`Found ${couriersWithLocation.rowCount} couriers with location data:`);
        couriersWithLocation.rows.forEach(c => {
            console.log(`- ${c.name} (ID: ${c.id}) | Location: (${c.latitude}, ${c.longitude}) | SupervisorId: ${c.supervisor_id}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

debugManagerDrivers();
