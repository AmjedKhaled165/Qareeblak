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

async function fullDebug() {
    try {
        console.log('=== 🔍 FULL SYSTEM DEBUG ===\n');

        // 1. All couriers with their data
        console.log('=== 📋 ALL COURIERS ===');
        const couriers = await pool.query(`
            SELECT id, name, username, latitude, longitude, last_location_update, is_available
            FROM users 
            WHERE user_type = 'partner_courier'
            ORDER BY id
        `);
        console.log(`Found ${couriers.rowCount} couriers:`);
        couriers.rows.forEach(c => {
            const hasLoc = c.latitude !== null;
            console.log(`  ID: ${c.id} | Name: ${c.name} | Location: ${hasLoc ? `YES (${c.latitude}, ${c.longitude})` : 'NO'} | Available: ${c.is_available}`);
        });

        // 2. All managers
        console.log('\n=== 👔 ALL MANAGERS ===');
        const managers = await pool.query(`
            SELECT id, name, username
            FROM users 
            WHERE user_type = 'partner_supervisor'
            ORDER BY id
        `);
        console.log(`Found ${managers.rowCount} managers:`);
        managers.rows.forEach(m => {
            console.log(`  ID: ${m.id} | Name: ${m.name} | Username: ${m.username}`);
        });

        // 3. courier_supervisors junction table
        console.log('\n=== 🔗 COURIER-SUPERVISOR ASSIGNMENTS ===');
        const assignments = await pool.query(`
            SELECT cs.courier_id, cs.supervisor_id, c.name as courier_name, s.name as supervisor_name
            FROM courier_supervisors cs
            JOIN users c ON cs.courier_id = c.id
            JOIN users s ON cs.supervisor_id = s.id
            ORDER BY cs.supervisor_id, cs.courier_id
        `);
        console.log(`Found ${assignments.rowCount} assignments:`);
        assignments.rows.forEach(a => {
            console.log(`  Courier "${a.courier_name}" (ID: ${a.courier_id}) -> Manager "${a.supervisor_name}" (ID: ${a.supervisor_id})`);
        });

        // 4. Check which manager has آدم
        console.log('\n=== 🔎 LOOKING FOR آدم ===');
        const adam = await pool.query(`
            SELECT id, name, latitude, longitude FROM users WHERE name LIKE '%آدم%'
        `);
        if (adam.rowCount > 0) {
            const a = adam.rows[0];
            console.log(`Found آدم: ID=${a.id}, Location: ${a.latitude ? `(${a.latitude}, ${a.longitude})` : 'NO LOCATION'}`);

            const adamAssignments = await pool.query(`
                SELECT cs.supervisor_id, s.name as supervisor_name
                FROM courier_supervisors cs
                JOIN users s ON cs.supervisor_id = s.id
                WHERE cs.courier_id = $1
            `, [a.id]);
            console.log(`آدم's managers: ${adamAssignments.rowCount}`);
            adamAssignments.rows.forEach(am => {
                console.log(`  -> Manager: ${am.supervisor_name} (ID: ${am.supervisor_id})`);
            });
        } else {
            console.log('آدم NOT FOUND in database');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

fullDebug();
