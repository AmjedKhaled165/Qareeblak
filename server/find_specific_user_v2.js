const pool = require('./db');

async function findUserDetail() {
    try {
        const result = await pool.query(`
            SELECT *
            FROM users 
            WHERE name ILIKE '%amjed%' OR username ILIKE '%amjed%' OR id = 1
        `);

        console.log(JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error finding user:', error);
        process.exit(1);
    }
}

findUserDetail();
