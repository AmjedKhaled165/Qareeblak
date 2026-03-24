/**
 * Wheel of Luck — Business Logic
 * Extracted from route handler to enforce separation of concerns.
 */
const db = require('../db');
const AppError = require('../utils/appError');
const crypto = require('crypto');

class WheelService {
    /**
     * Spin the wheel for the given user.
     * Uses PostgreSQL row-level locking + transaction to prevent race conditions.
     * @param {number} userId
     * @returns {{ id, name, type, value, color }}
     */
    async spinWheel(userId) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Row-level lock: one spin in-flight per user at a time
            await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

            // Enforce 24-hour limit
            const existing = await client.query(
                `SELECT id FROM user_prizes WHERE user_id = $1 AND won_at > NOW() - INTERVAL '24 hours'`,
                [userId]
            );
            if (existing.rows.length > 0) {
                await client.query('ROLLBACK');
                throw new AppError('لقد استنفدت محاولتك اليوم. عد غداً لتجربة حظك مرة أخرى!', 400);
            }

            // Fetch active prizes with their weights
            // Only select required columns — not SELECT *
            const prizeRes = await client.query(
                'SELECT id, name, prize_type, prize_value, color, probability FROM wheel_prizes WHERE is_active = TRUE'
            );
            const prizes = prizeRes.rows;

            if (prizes.length === 0) {
                await client.query('ROLLBACK');
                throw new AppError('لا توجد جوائز متاحة حالياً', 404);
            }

            // Weighted Random Selection using crypto-secure random
            const totalWeight = prizes.reduce((sum, p) => sum + p.probability, 0);
            // crypto.randomInt for cryptographic fairness (Math.random is not secure)
            let random = crypto.randomInt(0, totalWeight);

            let winningPrize = prizes[prizes.length - 1]; // safe fallback
            for (const prize of prizes) {
                if (random < prize.probability) {
                    winningPrize = prize;
                    break;
                }
                random -= prize.probability;
            }

            // Persist the win
            await client.query(
                'INSERT INTO user_prizes (user_id, prize_id) VALUES ($1, $2)',
                [userId, winningPrize.id]
            );

            await client.query('COMMIT');

            return {
                id: winningPrize.id,
                name: winningPrize.name,
                type: winningPrize.prize_type,
                value: winningPrize.prize_value,
                color: winningPrize.color
            };
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) { }
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get all active prizes (public display)
     */
    async getActivePrizes() {
        const result = await db.query(
            'SELECT id, name, prize_type, prize_value, color, provider_id FROM wheel_prizes WHERE is_active = TRUE'
        );
        return result.rows;
    }

    /**
     * Get unused prizes for a specific user
     */
    async getUserPrizes(userId) {
        const result = await db.query(`
            SELECT up.id as user_prize_id, wp.id, wp.name, wp.prize_type, wp.prize_value, wp.color
            FROM user_prizes up
            JOIN wheel_prizes wp ON up.prize_id = wp.id
            WHERE up.user_id = $1 AND up.is_used = FALSE
            ORDER BY up.won_at DESC
        `, [userId]);
        return result.rows;
    }

    // ─── ADMIN ──────────────────────────────────────────────────────────────────

    async getAllPrizes() {
        const result = await db.query('SELECT * FROM wheel_prizes ORDER BY created_at DESC');
        return result.rows;
    }

    async createPrize({ name, prize_type, prize_value, provider_id, probability, color }) {
        const result = await db.query(`
            INSERT INTO wheel_prizes (name, prize_type, prize_value, provider_id, probability, color)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, prize_type, prize_value, provider_id || null, probability, color]);
        return result.rows[0];
    }

    async updatePrize(id, { name, prize_type, prize_value, provider_id, probability, color, is_active }) {
        const result = await db.query(`
            UPDATE wheel_prizes
            SET name = $1, prize_type = $2, prize_value = $3, provider_id = $4,
                probability = $5, color = $6, is_active = $7
            WHERE id = $8
            RETURNING *
        `, [name, prize_type, prize_value, provider_id || null, probability, color, is_active, id]);

        if (result.rows.length === 0) throw new AppError('الجائزة غير موجودة', 404);
        return result.rows[0];
    }

    async deletePrize(id) {
        const result = await db.query('DELETE FROM wheel_prizes WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) throw new AppError('الجائزة غير موجودة', 404);
        return true;
    }
}

module.exports = new WheelService();
