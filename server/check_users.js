const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const db = require('./db');

async function check() {
    try {
        const res = await db.query(`SELECT id FROM users LIMIT 1;`);
        console.log(res.rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
