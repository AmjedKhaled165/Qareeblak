const pool = require('./db');

async function resetData() {
    try {
        console.log('--- Resetting System Data (Orders & Bookings) ---');

        // 1. Delete review associations
        await pool.query("DELETE FROM reviews");
        console.log('✅ Deleted all reviews.');

        // 2. Delete Halan order history first (references delivery_orders)
        await pool.query("DELETE FROM order_history");
        console.log('✅ Deleted Halan order history.');

        // 3. Delete Qareeblak bookings (references delivery_orders and parent_orders)
        const bookingsRes = await pool.query("DELETE FROM bookings");
        console.log(`✅ Deleted ${bookingsRes.rowCount} Qareeblak bookings.`);

        // 4. Delete Halan delivery orders
        const ordersRes = await pool.query("DELETE FROM delivery_orders");
        console.log(`✅ Deleted ${ordersRes.rowCount} Halan delivery orders.`);

        // 5. Delete Parent Orders
        const parentRes = await pool.query("DELETE FROM parent_orders");
        console.log(`✅ Deleted ${parentRes.rowCount} Parent orders.`);

        // 6. Reset primary key sequences
        const sequences = [
            'bookings_id_seq',
            'delivery_orders_id_seq',
            'order_history_id_seq',
            'reviews_id_seq',
            'parent_orders_id_seq'
        ];

        for (const seq of sequences) {
            try {
                await pool.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
                console.log(`✅ Reset sequence: ${seq}`);
            } catch (seqErr) {
                // Skip if sequence doesn't exist
            }
        }

        console.log('=============================================');
        console.log('🚀 SYSTEM ORDERS RESET COMPLETED SUCCESSFULLY');
        console.log('=============================================');
    } catch (err) {
        console.error('Error resetting data:', err);
    } finally {
        process.exit();
    }
}

resetData();
