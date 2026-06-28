const pool = require('./server/db');
pool.query('SELECT DISTINCT user_type FROM users')
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => process.exit(0));
