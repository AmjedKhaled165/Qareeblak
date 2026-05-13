const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkAndFixAssignments() {
    try {
        console.log('=== 🔍 CHECKING COURIER-SUPERVISOR TABLE ===\n');

        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'courier_supervisors'
            )
        `);

        const tableExists = tableCheck.rows[0].exists;
        console.log(`Table 'courier_supervisors' exists: ${tableExists}`);

        if (!tableExists) {
            console.log('\n⚠️ Table does not exist! Creating...');
            await pool.query(`
                CREATE TABLE courier_supervisors (
                    id SERIAL PRIMARY KEY,
                    courier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    supervisor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(courier_id, supervisor_id)
                )
            `);
            console.log('✅ Table created!');
        }

        // Check current assignments
        const assignments = await pool.query('SELECT * FROM courier_supervisors');
        console.log(`\nCurrent assignments: ${assignments.rowCount}`);
        assignments.rows.forEach(a => {
            console.log(`- Courier ${a.courier_id} -> Supervisor ${a.supervisor_id}`);
        });

        // Get first manager and driver for test assignment
        const manager = await pool.query("SELECT id, name FROM users WHERE user_type = 'partner_supervisor' LIMIT 1");
        const courier = await pool.query("SELECT id, name FROM users WHERE user_type = 'partner_courier' LIMIT 1");

        if (manager.rowCount > 0 && courier.rowCount > 0) {
            const mgrId = manager.rows[0].id;
            const curId = courier.rows[0].id;

            console.log(`\n🔗 Creating test assignment: ${courier.rows[0].name} -> ${manager.rows[0].name}`);

            await pool.query(`
                INSERT INTO courier_supervisors (courier_id, supervisor_id) 
                VALUES ($1, $2)
                ON CONFLICT (courier_id, supervisor_id) DO NOTHING
            `, [curId, mgrId]);

            console.log('✅ Assignment created!');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkAndFixAssignments();
