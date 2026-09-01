const pool = require('./server/db');

async function checkUser() {
    try {
        const res = await pool.query("SELECT email, is_banned FROM users WHERE email = 'halan@halan.com'");
        console.log(res.rows);
    } catch (error) {
        console.error(error);
    } finally {
        pool.end();
    }
}

checkUser();
