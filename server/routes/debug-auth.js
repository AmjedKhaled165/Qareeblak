const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @route POST /debug/verify-halan-user
 * @desc Verify if a Halan user exists and has valid credentials
 * @access Public (for debugging only)
 */
router.post('/verify-halan-user', async (req, res) => {
    try {
        const { identifier } = req.body;

        if (!identifier) {
            return res.status(400).json({
                success: false,
                error: 'identifier is required'
            });
        }

        // Check if user exists
        const result = await db.query(
            `SELECT id, username, name, email, user_type, phone FROM users 
             WHERE (username = $1 OR email = $1) 
             AND user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')`,
            [identifier.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                identifier
            });
        }

        const user = result.rows[0];
        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                user_type: user.user_type,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('[Debug] Error verifying user:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /debug/halan-users-count
 * @desc Get count of Halan users by type
 * @access Public (for debugging only)
 */
router.get('/halan-users-count', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                user_type,
                COUNT(*) as count
            FROM users 
            WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
            GROUP BY user_type
            ORDER BY user_type
        `);

        const totalResult = await db.query(`
            SELECT COUNT(*) as total FROM users 
            WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        `);

        const counts = {
            partner_owner: 0,
            partner_supervisor: 0,
            partner_courier: 0,
            total: parseInt(totalResult.rows[0]?.total || 0)
        };

        result.rows.forEach(row => {
            counts[row.user_type] = parseInt(row.count);
        });

        res.status(200).json({
            success: true,  data: counts
        });
    } catch (error) {
        console.error('[Debug] Error getting user counts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
