const pool = require('./db');

async function findUser() {
    try {
        const result = await pool.query(`
            SELECT *
            FROM users 
            WHERE name ILIKE '%amjed%' OR username ILIKE '%amjed%'
        `);

        console.log('--- Found Users ---');
        console.table(result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error finding user:', error);
        process.exit(1);
    }
}

findUser();
