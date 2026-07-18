require('dotenv').config({ path: require('path').join(__dirname, '../.env.production') });
const pool = require('../db');

async function run() {
    console.log('--- Starting Deduplication Process ---');
    try {
        // Step 1: Remove duplicate emails
        console.log('Cleaning up duplicate emails...');
        const emailDups = await pool.query(`
            SELECT email, array_agg(id ORDER BY created_at DESC) as ids 
            FROM users 
            WHERE email IS NOT NULL 
            GROUP BY email 
            HAVING count(*) > 1
        `);
        for (const row of emailDups.rows) {
            const keepId = row.ids[0]; // Keep the most recent
            const deleteIds = row.ids.slice(1);
            console.log(`Deleting duplicate emails for ${row.email}: keeping ID ${keepId}, deleting ${deleteIds.join(', ')}`);
            await pool.query('DELETE FROM users WHERE id = ANY($1)', [deleteIds]);
        }

        // Step 2: Remove duplicate phones
        console.log('Cleaning up duplicate phones...');
        const phoneDups = await pool.query(`
            SELECT phone, array_agg(id ORDER BY created_at DESC) as ids 
            FROM users 
            WHERE phone IS NOT NULL AND phone != '' 
            GROUP BY phone 
            HAVING count(*) > 1
        `);
        for (const row of phoneDups.rows) {
            const keepId = row.ids[0];
            const deleteIds = row.ids.slice(1);
            console.log(`Deleting duplicate phones for ${row.phone}: keeping ID ${keepId}, deleting ${deleteIds.join(', ')}`);
            await pool.query('DELETE FROM users WHERE id = ANY($1)', [deleteIds]);
        }

        // Step 3: Remove duplicate usernames
        console.log('Cleaning up duplicate usernames...');
        // username might not exist, but let's check
        try {
            const userDups = await pool.query(`
                SELECT username, array_agg(id ORDER BY created_at DESC) as ids 
                FROM users 
                WHERE username IS NOT NULL AND username != '' 
                GROUP BY username 
                HAVING count(*) > 1
            `);
            for (const row of userDups.rows) {
                const keepId = row.ids[0];
                const deleteIds = row.ids.slice(1);
                console.log(`Deleting duplicate usernames for ${row.username}: keeping ID ${keepId}, deleting ${deleteIds.join(', ')}`);
                await pool.query('DELETE FROM users WHERE id = ANY($1)', [deleteIds]);
            }
        } catch(e) {
            console.log('No username column or error checking usernames:', e.message);
        }

        // Step 4: Ensure UNIQUE constraints exist
        console.log('Applying UNIQUE constraints...');
        
        const constraints = [
            { col: 'email', name: 'users_email_key' },
            { col: 'phone', name: 'users_phone_key' },
            { col: 'username', name: 'users_username_key' }
        ];

        for (const c of constraints) {
            // Drop existing constraint if it exists
            try {
                await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS ${c.name}`);
            } catch(e) { /* ignore */ }
            
            try {
                await pool.query(`ALTER TABLE users ADD CONSTRAINT ${c.name} UNIQUE (${c.col})`);
                console.log(`Added UNIQUE constraint for ${c.col}`);
            } catch(e) {
                console.error(`Failed to add UNIQUE constraint for ${c.col}:`, e.message);
            }
        }

        console.log('--- Deduplication Process Completed Successfully ---');
    } catch (error) {
        console.error('Error during deduplication:', error);
    } finally {
        pool.end();
    }
}

run();
