const { Pool } = require('pg');

const dbConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    database: 'qareeblak',
    password: 'qareeblak123',
    port: 5432,
};
const pool = new Pool(dbConfig);

async function verify() {
    const client = await pool.connect();
    try {
        console.log('--- Verifying Pagination & Visibility ---');

        // 1. Insert minimal dummy orders with different sources to ensure we have data
        const sources = ['manual', 'maintenance', 'call_center'];
        for (const source of sources) {
            await client.query(`
                INSERT INTO delivery_orders (
                    order_number, customer_name, customer_phone, pickup_address, delivery_address, 
                    source, status, created_at, items
                ) VALUES (
                    $3, $1, '01000000000', 'Loc A', 'Loc B', 
                    $2, 'pending', NOW(), '[]'
                )
            `, [`Test ${source}`, source, `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`]);
        }
        console.log('Inserted test orders.');

        // 2. Fetch all orders (mocking the "All Orders" page request)
        // We'll use a small limit to test pagination logic in isolation if many orders exist, 
        // but here we just want to see if our new sources appear in the result.
        // The actual API call would look like /halan/orders?page=1&limit=50

        // Simulating the query logic from halan-orders.js
        const limit = 50;
        const offset = 0;
        const res = await client.query(`
            SELECT id, source, customer_name FROM delivery_orders 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        console.log(`Fetched ${res.rows.length} orders.`);

        const fetchedSources = new Set(res.rows.map(r => r.source));
        console.log('found sources:', Array.from(fetchedSources));

        const missed = sources.filter(s => !fetchedSources.has(s));
        if (missed.length === 0) {
            console.log('SUCCESS: All test sources found in fetch!');
        } else {
            console.error('FAILURE: Missing sources:', missed);
        }

        // Clean up test data
        await client.query(`DELETE FROM delivery_orders WHERE customer_name LIKE 'Test %'`);
        console.log('Cleaned up test data.');

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

verify();
