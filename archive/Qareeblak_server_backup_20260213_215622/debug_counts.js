const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

async function debugManagerCounts() {
    try {
        console.log('--- Checking Manager Assignment Counts ---');

        const query = `
            SELECT 
                s.id as supervisor_id,
                s.name as supervisor_name,
                c.id as courier_id,
                c.name as courier_name,
                c.user_type as courier_type
            FROM users s
            JOIN courier_supervisors cs ON s.id = cs.supervisor_id
            JOIN users c ON cs.courier_id = c.id
            WHERE s.id IN (19, 20)
            ORDER BY s.id, c.id
        `;

        const res = await pool.query(query);
        console.table(res.rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

debugManagerCounts();
