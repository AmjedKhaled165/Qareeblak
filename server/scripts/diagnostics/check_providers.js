
const pool = require('./db');

async function checkProviders() {
    try {
        console.log("Checking Providers Table...");
        const res = await pool.query('SELECT id, name, is_approved FROM providers');
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkProviders();
