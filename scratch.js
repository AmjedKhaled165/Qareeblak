const pool = require('./server/db');

async function checkLocks() {
    try {
        const res = await pool.query(`SELECT pid, state, query FROM pg_stat_activity WHERE state = 'active' OR state = 'idle in transaction';`);
        console.log(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkLocks();
