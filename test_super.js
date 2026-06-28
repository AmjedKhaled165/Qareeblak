require('dotenv').config({ path: './server/.env' });
const pool = require('./server/db');
pool.query("UPDATE delivery_orders SET supervisor_id = 34 WHERE supervisor_id IS NULL")
  .then(res => console.log(res.rowCount))
  .catch(console.error)
  .finally(() => process.exit(0));
