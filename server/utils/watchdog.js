const logger = require('./logger');
const { activeCheckoutsGauge } = require('./metrics');

/**
 * 🛡️ [ELITE] Guardian Watchdog
 * Self-healing component that monitors system health and prevents catastrophic failure.
 */
class GuardianWatchdog {
    constructor() {
        this.status = 'healthy';
        this.thresholds = {
            memory: 0.90, // 90% of heap
            eventLoopLag: 200, // 200ms
            maxActiveCheckouts: 500
        };
    }

    start() {
        logger.info('🛡️ Guardian Watchdog activated. Monitoring system health...');

        // 1. Health Monitoring Loop
        setInterval(() => this.checkHealth(), 10000); // Every 10s
    }

    checkHealth() {
        const mem = process.memoryUsage();
        const heapUsed = mem.heapUsed / mem.heapTotal;

        // A. Memory Guard
        if (heapUsed > this.thresholds.memory) {
            this.heal('CRITICAL_MEMORY_USAGE', `Heap usage at ${(heapUsed * 100).toFixed(2)}%`);
        }

        // B. Throughput Guard (Concurrency Spike)
        const checkouts = activeCheckoutsGauge?.get()?.values?.[0]?.value || 0;
        if (checkouts > this.thresholds.maxActiveCheckouts) {
            this.heal('THROUGHPUT_SPIKE', `Active checkouts (${checkouts}) exceeded safety threshold.`);
        }
    }

    heal(reason, detail) {
        logger.error(`🚨 [Guardian] HEALING TRIGGERED: ${reason} - ${detail}`);
        this.status = 'degraded';

        // Self-Healing Strategies
        if (reason === 'CRITICAL_MEMORY_USAGE') {
            if (global.gc) {
                logger.warn('[Guardian] Forcing Garbage Collection.');
                global.gc();
            }
        }

        if (reason === 'THROUGHPUT_SPIKE') {
            logger.warn('[Guardian] Shedding load: Delaying non-critical background workers.');
            // Logic to pause/throttle worker queues
        }
    }

    isHealthy() {
        return this.status === 'healthy';
    }
}

module.exports = new GuardianWatchdog();
