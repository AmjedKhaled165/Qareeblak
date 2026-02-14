console.log('🏁 Script starting...');
const { pool } = require('./db');
console.log('📦 DB module loaded.');

async function checkOrder() {
    console.log('⏳ Starting database connection test...');
    try {
        const res = await pool.query('SELECT NOW() as now');
        console.log('✅ Connection successful! Server time:', res.rows[0].now);

        const res1 = await pool.query('SELECT id, supervisor_id FROM delivery_orders LIMIT 1');
        console.log('📦 Delivery Order sample:', res1.rows[0]);

        const res2 = await pool.query('SELECT id, provider_id, halan_order_id FROM bookings LIMIT 1');
        console.log('📅 Bookings sample:', res2.rows[0]);
    } catch (err) {
        console.error('❌ Database query failed:', err.message);
    } finally {
        await pool.end();
        console.log('🔚 Test finished.');
    }
}

checkOrder();
