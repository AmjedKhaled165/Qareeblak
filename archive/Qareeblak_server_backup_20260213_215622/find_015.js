const pool = require('./db');

async function find015() {
    try {
        const result = await pool.query(`
            SELECT *
            FROM users 
            WHERE phone LIKE '015%'
        `);

        console.log(JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

find015();
