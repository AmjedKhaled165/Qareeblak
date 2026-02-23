const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'qareeblak',
    password: 'qareeblak123',
    port: 5432,
});

async function inspect() {
    try {
        const bookingsCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings'");
        console.log('--- BOOKINGS TABLE ---');
        console.log(bookingsCols.rows.map(r => `${r.column_name} (${r.data_type})`));

        const ordersCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery_orders'");
        console.log('\n--- DELIVERY_ORDERS TABLE ---');
        console.log(ordersCols.rows.map(r => `${r.column_name} (${r.data_type})`));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

inspect();
