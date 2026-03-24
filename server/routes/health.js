const express = require('express');
const router = express.Router();
const db = require('../db');
const { client: redisClient } = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * @route GET /health
 * @desc Check system health for monitoring/load balancing
 */
router.get('/', async (req, res) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        checks: {
            database: 'unknown',
            redis: 'unknown',
            halanUsers: 'unknown'
        }
    };

    try {
        // 1. Check Database
        const dbStart = Date.now();
        await db.query('SELECT 1');
        healthcheck.checks.database = `healthy (${Date.now() - dbStart}ms)`;

        // 2. Check Halan Partner Users
        try {
            const halanUsersResult = await db.query(`
                SELECT COUNT(*) as count FROM users 
                WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
            `);
            const halanUserCount = parseInt(halanUsersResult.rows[0]?.count || 0);
            healthcheck.checks.halanUsers = `${halanUserCount} users`;
        } catch (e) {
            healthcheck.checks.halanUsers = `error: ${e.message}`;
        }

        // 3. Check Redis
        const redisStart = Date.now();
        if (redisClient.status === 'ready') {
            await redisClient.ping();
            healthcheck.checks.redis = `healthy (${Date.now() - redisStart}ms)`;
        } else {
            healthcheck.checks.redis = 'unhealthy (disconnected)';
        }

        res.status(200).json(healthcheck);
    } catch (error) {
        healthcheck.message = error.message;
        logger.error('Healthcheck failing:', error);
        res.status(503).json(healthcheck);
    }
});

module.exports = router;
