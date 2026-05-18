const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://qareeblak_owner:npg_u24mYOGCwNjR@ep-purple-tooth-agcvtnrx.c-2.eu-central-1.aws.neon.tech/qareeblak?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        const res = await pool.query('SELECT * FROM consultations');
        console.log('Consultations:', res.rows);
    } catch (err) {
        console.error('Error fetching consultations:', err);
    }
    
    try {
        const customerId = 1; // Assuming user 1 exists
        const providerId = 1; // Assuming provider 1 exists
        console.log('Inserting consultation...');
        const insertRes = await pool.query(`
            INSERT INTO consultations (customer_id, provider_id, status)
            VALUES ($1, $2, 'active')
            RETURNING id
        `, [customerId, providerId]);
        console.log('Inserted ID:', insertRes.rows[0].id);
    } catch (err) {
        console.error('Error inserting consultation:', err);
    }

    pool.end();
}

test();
