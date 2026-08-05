require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL.replace(/@localhost/g, '@127.0.0.1')
});

async function checkHatemOrders() {
    try {
        const client = await pool.connect();
        
        // Find Hatem
        const hatemRes = await client.query(`SELECT id, name, user_type FROM users WHERE name LIKE '%حاتم%'`);
        console.log("Hatem users found:", hatemRes.rows);
        
        if (hatemRes.rows.length === 0) {
            console.log("Hatem not found.");
            process.exit(0);
        }
        
        const hatemId = hatemRes.rows[0].id;
        
        // Find orders assigned to Hatem
        const ordersRes = await client.query(`SELECT id, source, supervisor_id, courier_id, status FROM delivery_orders WHERE supervisor_id = $1`, [hatemId]);
        console.log(`Orders directly assigned to Hatem (${hatemId}):`, ordersRes.rows);

        // Find orders without supervisor but Hatem is their courier supervisor?
        const unassignedOrdersRes = await client.query(`
            SELECT o.id, o.supervisor_id, o.courier_id, o.status 
            FROM delivery_orders o
            WHERE o.supervisor_id IS NULL
            AND EXISTS (
                SELECT 1 FROM courier_supervisors cs
                WHERE cs.supervisor_id = $1 AND cs.courier_id = o.courier_id
            )
        `, [hatemId]);
        console.log(`Orders indirectly assigned to Hatem through couriers:`, unassignedOrdersRes.rows);

        // Let's see the most recent orders just in case it didn't save
        const recentRes = await client.query(`SELECT id, source, supervisor_id, courier_id, status FROM delivery_orders ORDER BY created_at DESC LIMIT 5`);
        console.log(`Recent 5 orders:`, recentRes.rows);

        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

checkHatemOrders();
