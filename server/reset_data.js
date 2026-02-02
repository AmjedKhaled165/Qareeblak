const pool = require('./db');

async function resetData() {
    try {
        console.log('--- Resetting System Data ---');

        // Delete all orders
        // Delete order history first (foreign key constraint)
        await pool.query("DELETE FROM order_history");
        console.log('Deleted order history.');

        // Delete orders
        const res = await pool.query("DELETE FROM delivery_orders");
        console.log(`Deleted ${res.rowCount} orders.`);

        console.log('✅ System data reset successfully.');
    } catch (err) {
        console.error('Error resetting data:', err);
    } finally {
        process.exit();
    }
}

resetData();
