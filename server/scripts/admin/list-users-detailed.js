/* eslint-disable */
const db = require('./db');
const { pool } = db;

console.log('🚀 Starting user listing script...');

async function listAllAccounts() {
    try {
        console.log('🔄 Fetching accounts from database...');

        // Query to get users with provider info and supervisor info
        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.password,
                u.phone, 
                u.email,
                u.role, 
                u.user_type, 
                u.is_available,
                to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as created_at,
                p.name as brand_name,
                p.category as provider_category,
                s.name as supervisor_name
            FROM users u
            LEFT JOIN providers p ON u.id = p.user_id
            LEFT JOIN courier_supervisors cs ON u.id = cs.courier_id
            LEFT JOIN users s ON cs.supervisor_id = s.id
            ORDER BY u.id ASC
        `;

        const res = await db.query(query);

        // Header
        const header =
            'ID'.padEnd(5) +
            'Name'.padEnd(20) +
            'Username'.padEnd(15) +
            'Phone'.padEnd(15) +
            'Email'.padEnd(25) +
            'Role'.padEnd(15) +
            'Type'.padEnd(15) +
            'Password Hash'.padEnd(20) +
            'Status'.padEnd(12) +
            'Details'.padEnd(20) +
            'Supervisor';

        console.log('\n' + '='.repeat(header.length));
        console.log(header);
        console.log('='.repeat(header.length));

        res.rows.forEach(user => {
            let details = '-';
            if (user.brand_name) {
                details = `${user.brand_name}`;
            }

            const status = user.is_available ? 'Available' : 'Unavailable';
            const supervisor = user.supervisor_name ? user.supervisor_name : '-';
            const email = user.email || '-';
            const password = user.password ? user.password.substring(0, 15) + '...' : '-';

            console.log(
                String(user.id).padEnd(5) +
                String(user.name || '-').substring(0, 19).padEnd(20) +
                String(user.username || '-').padEnd(15) +
                String(user.phone || '-').padEnd(15) +
                String(email).substring(0, 24).padEnd(25) +
                String(user.role || '-').padEnd(15) +
                String(user.user_type || '-').padEnd(15) +
                String(password).padEnd(20) +
                status.padEnd(12) +
                details.substring(0, 19).padEnd(20) +
                supervisor
            );
        });
        console.log('='.repeat(header.length));
        console.log(`\n✅ Total Accounts: ${res.rows.length}\n`);

    } catch (err) {
        console.error('❌ Error fetching accounts:', err);
    } finally {
        if (pool) {
            console.log('👋 Closing connection...');
            await pool.end();
        }
    }
}

// Give the db connection a moment to initialize
setTimeout(listAllAccounts, 1000);
