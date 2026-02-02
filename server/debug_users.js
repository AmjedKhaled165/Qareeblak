const pool = require('./db');

async function debugUsers() {
    try {
        console.log('--- Debugging Users and Assignments ---');

        // Get all supervisors
        const supervisorsRes = await pool.query(
            "SELECT id, name, user_type FROM users WHERE user_type = 'partner_supervisor'"
        );
        const supervisors = supervisorsRes.rows;
        console.log(`Found ${supervisors.length} supervisors.`);

        // Get all couriers
        const couriersRes = await pool.query(
            "SELECT id, name, user_type, supervisor_id FROM users WHERE user_type = 'partner_courier'"
        );
        const couriers = couriersRes.rows;
        console.log(`Found ${couriers.length} couriers.`);

        // Check assignments
        supervisors.forEach(s => {
            const assigned = couriers.filter(c => c.supervisor_id === s.id);
            console.log(`Supervisor ${s.name} (ID: ${s.id}) has ${assigned.length} drivers: ${assigned.map(c => c.name).join(', ')}`);
        });

        // Check for unassigned or invalid assignments
        const unassigned = couriers.filter(c => !c.supervisor_id);
        console.log(`Unassigned Couriers: ${unassigned.length}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

debugUsers();
