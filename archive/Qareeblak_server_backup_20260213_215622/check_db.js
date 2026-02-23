
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/asst_services'
});

async function checkOrder() {
    try {
        const res = await pool.query('SELECT id, supervisor_id FROM delivery_orders WHERE id = 4');
        console.log('Delivery Order 4:', res.rows[0]);

        const res2 = await pool.query('SELECT id, provider_id, halan_order_id FROM bookings WHERE halan_order_id = 4 OR id::text = \'4\'');
        console.log('Bookings related to 4:', res2.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkOrder();
