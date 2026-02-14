
const pool = require('./db');

async function resetTime() {
    try {
        const id = 5;
        console.log(`Resetting created_at for Booking ID: ${id}...`);

        await pool.query('UPDATE bookings SET created_at = NOW() WHERE id = $1', [id]);

        console.log("✅ Time reset to NOW(). You have 5 minutes to test cancel/remove.");

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

resetTime();
