require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL.replace(/@localhost/g, '@127.0.0.1') });
pool.query(`SELECT id, name, is_available FROM users WHERE name IN ('مروان', 'ادم')`).then(res => {
    console.log(res.rows);
    pool.query(`SELECT courier_id, supervisor_id FROM courier_supervisors WHERE courier_id IN (SELECT id FROM users WHERE name IN ('مروان', 'ادم'))`).then(r2 => {
        console.log("Supervisors mapped:", r2.rows);
        pool.end();
    });
}).catch(err => {
    console.error(err);
    pool.end();
});
