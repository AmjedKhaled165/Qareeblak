const pool = require('./db');

async function checkAvatar() {
    try {
        const result = await pool.query(`
            SELECT id, name, username, email, (avatar IS NOT NULL AND avatar != '') as has_avatar, length(avatar) as avatar_len, left(avatar, 20) as avatar_prefix
            FROM users 
            WHERE id = 30
        `);

        console.log('--- User 30 Avatar Status ---');
        console.table(result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error checking avatar:', error);
        process.exit(1);
    }
}

checkAvatar();
