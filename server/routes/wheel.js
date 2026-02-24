const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route GET /api/wheel/prizes
 * @desc Get active wheel prizes for the UI
 */
router.get('/prizes', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, prize_type, prize_value, color, provider_id FROM wheel_prizes WHERE is_active = TRUE'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/wheel/spin
 * @desc User spins the wheel to win a prize
 */
router.post('/spin', verifyToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const userId = req.user.id;

        // 0. Use Row-Level Locking on the User record to prevent Race Conditions
        // This ensures only one process can handle this user's spin at a time.
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

        // 1. Enforce 24-hour limit
        const checkRes = await client.query(`
            SELECT id FROM user_prizes 
            WHERE user_id = $1 AND won_at > NOW() - INTERVAL '24 hours'
        `, [userId]);

        if (checkRes.rows.length > 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({ error: 'لقد استنفدت محاولتك اليوم. عد غداً لتجربة حظك مرة أخرى!' });
        }

        // 2. Fetch all active prizes with their weights
        const result = await client.query(
            'SELECT * FROM wheel_prizes WHERE is_active = TRUE'
        );
        const prizes = result.rows;

        if (prizes.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ error: 'لا توجد جوائز متاحة حالياً' });
        }

        // 3. Weighted Random Selection
        const totalWeight = prizes.reduce((sum, p) => sum + p.probability, 0);
        let random = Math.floor(Math.random() * totalWeight);

        let winningPrize = null;
        for (const prize of prizes) {
            if (random < prize.probability) {
                winningPrize = prize;
                break;
            }
            random -= prize.probability;
        }

        if (!winningPrize) winningPrize = prizes[0]; // Fallback

        // 4. Save the win for the user
        await client.query(
            'INSERT INTO user_prizes (user_id, prize_id) VALUES ($1, $2)',
            [userId, winningPrize.id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            prize: {
                id: winningPrize.id,
                name: winningPrize.name,
                type: winningPrize.prize_type,
                value: winningPrize.prize_value,
                color: winningPrize.color
            }
        });
    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (e) { }
            client.release();
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/wheel/my-prizes
 * @desc Get available rewards for the current user
 */
router.get('/my-prizes', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(`
            SELECT up.id as user_prize_id, wp.* 
            FROM user_prizes up
            JOIN wheel_prizes wp ON up.prize_id = wp.id
            WHERE up.user_id = $1 AND up.is_used = FALSE
            ORDER BY up.won_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== ADMIN ROUTES ==================

/**
 * @route GET /api/wheel/admin/prizes
 * @desc Admin: Get all prizes (including inactive)
 */
router.get('/admin/prizes', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM wheel_prizes ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/wheel/admin/prizes
 * @desc Admin: Add a new prize
 */
router.post('/admin/prizes', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, prize_type, prize_value, provider_id, probability, color } = req.body;
        const result = await db.query(`
            INSERT INTO wheel_prizes (name, prize_type, prize_value, provider_id, probability, color)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, prize_type, prize_value, provider_id || null, probability || 10, color || '#f44336']);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route PUT /api/wheel/admin/prizes/:id
 */
router.put('/admin/prizes/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, prize_type, prize_value, provider_id, probability, color, is_active } = req.body;
        const result = await db.query(`
            UPDATE wheel_prizes 
            SET name = $1, prize_type = $2, prize_value = $3, provider_id = $4, 
                probability = $5, color = $6, is_active = $7
            WHERE id = $8
            RETURNING *
        `, [name, prize_type, prize_value, provider_id || null, probability, color, is_active, req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'العملية غير موجودة' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route DELETE /api/wheel/admin/prizes/:id
 */
router.delete('/admin/prizes/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM wheel_prizes WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
