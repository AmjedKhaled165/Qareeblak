require('dotenv').config();
const pool = require('./db');
pool.query('SELECT * FROM delivery_orders ORDER BY id DESC LIMIT 1').then(res => {
    console.log(res.rows[0]);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
