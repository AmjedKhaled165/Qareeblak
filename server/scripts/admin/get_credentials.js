const pool = require('./db');

async function getProviderCredentials() {
    try {
        console.log('🔍 Fetching credentials for requested providers...');

        const query = `
            SELECT u.id, u.name, u.email, u.phone, u.user_type, p.name as provider_name
            FROM users u
            JOIN providers p ON u.id = p.user_id
            WHERE p.name IN ('سباكة حديثة - م. أحمد', 'amjed')
        `;

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            console.log('❌ No matching user accounts found for these providers.');
            // Try searching by name directly in users table if link is missing
            const fallbackQuery = `SELECT id, name, email, phone, user_type FROM users WHERE name IN ('سباكة حديثة - م. أحمد', 'amjed')`;
            const fallbackResult = await pool.query(fallbackQuery);
            console.log('Fallback results:', fallbackResult.rows);
        } else {
            console.table(result.rows);
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        // No pool.end() because db.js might be exporting the pool directly
    }
}

getProviderCredentials();
