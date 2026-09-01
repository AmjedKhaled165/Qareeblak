const logger = require('./logger');
const { activeCheckoutsGauge } = require('./metrics');

/**
 * 🛡️ [ELITE] Guardian Watchdog
 * Self-healing component that monitors system health and prevents catastrophic failure.
 * Auto-recovers to 'healthy' when metrics return to safe levels.
 */
class GuardianWatchdog {
    constructor() {
        this.status = 'healthy';
        this.lastHealAt = new Map();
        this.consecutiveHealthy = 0;
        this.thresholds = {
            memory: Number(process.env.GUARDIAN_MEMORY_THRESHOLD || 0.90),
            eventLoopLag: Number(process.env.GUARDIAN_EVENT_LOOP_LAG_MS || 200),
            maxActiveCheckouts: 500
        };
        this.healCooldownMs = Number(process.env.GUARDIAN_HEAL_COOLDOWN_MS || 300000); // 5 min
    }

    start() {
        logger.info('🛡️ Guardian Watchdog activated. Monitoring system health...');

        // Health Monitoring Loop — every 15s for faster reaction
        this._interval = setInterval(() => this.checkHealth(), 15000);
        this._interval.unref(); // Don't prevent process exit
    }

    checkHealth() {
        const mem = process.memoryUsage();
        const v8 = require('v8');
        const heapStats = v8.getHeapStatistics();
        
        // Use heap_size_limit instead of heapTotal to avoid false positives during normal heap expansion
        const heapUsedPercentage = mem.heapUsed / heapStats.heap_size_limit;
        let problemDetected = false;

        // A. Memory Guard
        if (heapUsedPercentage > this.thresholds.memory) {
            this.heal('CRITICAL_MEMORY_USAGE', `Heap usage at ${(heapUsedPercentage * 100).toFixed(1)}% of limit (RSS: ${(mem.rss / 1024 / 1024).toFixed(0)}MB)`);
            problemDetected = true;
        }

        // B. Throughput Guard (Concurrency Spike)
        try {
            const checkouts = activeCheckoutsGauge?.get()?.values?.[0]?.value || 0;
            if (checkouts > this.thresholds.maxActiveCheckouts) {
                this.heal('THROUGHPUT_SPIKE', `Active checkouts (${checkouts}) exceeded safety threshold.`);
                problemDetected = true;
            }
        } catch (_) { /* metric may not exist */ }

        // C. DB Pool Monitoring
        try {
            const db = require('../db');
            if (db.waitingCount > 10) {
                this.heal('DB_POOL_EXHAUSTION', `${db.waitingCount} queries waiting for DB connection. Pool: ${db.totalCount}/${db.options?.max || '?'}`);
                problemDetected = true;
            }
        } catch (_) { /* db may not be loaded yet */ }

        // D. Auto-recover to healthy after 3 consecutive clean checks
        if (!problemDetected) {
            this.consecutiveHealthy++;
            if (this.status === 'degraded' && this.consecutiveHealthy >= 3) {
                this.status = 'healthy';
                logger.info('✅ [Guardian] System recovered to HEALTHY status');
                this.consecutiveHealthy = 0;
            }
        } else {
            this.consecutiveHealthy = 0;
        }
    }

    heal(reason, detail) {
        const now = Date.now();
        const last = this.lastHealAt.get(reason) || 0;
        if (now - last < this.healCooldownMs) {
            return;
        }
        this.lastHealAt.set(reason, now);

        logger.error(`🚨 [Guardian] HEALING TRIGGERED: ${reason} - ${detail}`);
        this.status = 'degraded';

        // Self-Healing Strategies
        if (reason === 'CRITICAL_MEMORY_USAGE') {
            if (global.gc) {
                logger.warn('[Guardian] Forcing Garbage Collection.');
                global.gc();
            }
        }

        if (reason === 'DB_POOL_EXHAUSTION') {
            logger.warn('[Guardian] DB pool under pressure — consider increasing pool size or optimizing queries.');
        }
    }

    isHealthy() {
        return this.status === 'healthy';
    }
}

module.exports = new GuardianWatchdog();
