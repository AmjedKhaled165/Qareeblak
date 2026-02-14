
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'qareeblak',
    user: 'postgres',
    password: 'qareeblak123'
});

async function ensureMockUser() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        console.log('Tables:', tables.rows.map(r => r.table_name));

        // const check = await client.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'users'");

        console.log('Checking for mock user 999...');
        // Try public.users explicitly
        const res = await client.query('SELECT id FROM public.users WHERE id = 999');
        if (res.rows.length === 0) {
            console.log('Mock user 999 not found. Inserting...');
            await client.query(`
                INSERT INTO public.users (id, name, email, password, type)
                VALUES (999, 'مستخدم جوجل', 'google@example.com', 'mock_password', 'customer')
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('Mock user inserted.');
        } else {
            console.log('Mock user 999 already exists.');
        }

        client.release();
    } catch (err) {
        console.error('Error Details:', JSON.stringify(err, null, 2));
        console.error('Error Message:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
ensureMockUser();
