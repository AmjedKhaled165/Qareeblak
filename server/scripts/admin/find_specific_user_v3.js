const pool = require('./db');

async function findUserByPhone() {
    try {
        const result = await pool.query(`
            SELECT *
            FROM users 
            WHERE phone LIKE '015%' OR name ILIKE '%amjed%'
        `);

        console.log(JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error finding user:', error);
        process.exit(1);
    }
}

findUserByPhone();
