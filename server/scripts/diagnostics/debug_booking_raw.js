
const pool = require('./db');

async function debugBooking() {
    try {
        const id = 5;
        console.log("--- Debugging Booking ID 5 ---");

        const res = await pool.query(`
            SELECT 
                id,
                user_name,
                details,
                status,
                price,
                items,
                service_name,
                created_at,
                provider_id,
                provider_name
            FROM bookings 
            WHERE id = $1
        `, [id]);

        if (res.rows.length === 0) {
            console.log("❌ Booking not found in DB");
            return;
        }

        const b = res.rows[0];
        console.log("Raw Booking Data:");
        console.log(JSON.stringify(b, null, 2));

        console.log("\nItems Type:", typeof b.items);
        if (b.items) console.log("Items Value:", b.items);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}

debugBooking();
