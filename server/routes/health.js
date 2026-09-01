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
            queue: 'unknown',
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
        const { isQuotaExceeded } = require('../utils/redis');
        
        if (redisClient.status === 'ready') {
            await redisClient.ping();
            healthcheck.checks.redis = `healthy (${Date.now() - redisStart}ms)${isQuotaExceeded() ? ' [DEGRADED: Quota Exceeded]' : ''}`;
        } else {
            healthcheck.checks.redis = `unhealthy (${redisClient.status})`;
        }

        // 4. Check Queues (BullMQ)
        try {
            const { notificationQueue, maintenanceQueue } = require('../utils/queues');
            const queues = [];
            
            if (notificationQueue) {
                const nCounts = await notificationQueue.getJobCounts();
                queues.push(`notifications(w:${nCounts.waiting}, a:${nCounts.active}, f:${nCounts.failed})`);
            }
            if (maintenanceQueue) {
                const mCounts = await maintenanceQueue.getJobCounts();
                queues.push(`maintenance(w:${mCounts.waiting}, a:${mCounts.active})`);
            }
            
            healthcheck.checks.queue = queues.length > 0 ? queues.join(' | ') : 'disabled';
        } catch (e) {
            healthcheck.checks.queue = `error: ${e.message}`;
        }

        res.status(200).json(healthcheck);
    } catch (error) {
        healthcheck.message = error.message;
        logger.error('Healthcheck failing:', error);
        res.status(503).json(healthcheck);
    }
});

module.exports = router;
