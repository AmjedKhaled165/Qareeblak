const pool = require('./db');
const bcrypt = require('bcryptjs');

async function updatePassword() {
    try {
        const newPassword = '123456';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const result = await pool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, 5]
        );

        if (result.rowCount > 0) {
            console.log('✅ Password updated successfully to: 123456');
        } else {
            console.log('❌ User not found.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error updating password:', error);
        process.exit(1);
    }
}

updatePassword();
