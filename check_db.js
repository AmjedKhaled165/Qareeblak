const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env.production') });
const pool = require('./server/db');

async function checkHungQueries() {
  try {
    const res = await pool.query(`
      SELECT pid, state, wait_event_type, wait_event, query, now() - state_change as duration
      FROM pg_stat_activity
      WHERE state != 'idle' AND pid != pg_backend_pid();
    `);
    console.table(res.rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkHungQueries();
