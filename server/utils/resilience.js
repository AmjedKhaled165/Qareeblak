const logger = require('./logger');

/**
 * [ELITE] Chaos Engineering Utility
 * Allows manual injection of faults to test system recovery/degraded mode.
 * ⚠️ NEVER USE IN PRODUCTION WITHOUT EXPLICIT PERMISSION
 */
class ChaosTesting {
    constructor() {
        this.enabled = process.env.CHAOS_ENABLED === 'true' && process.env.NODE_ENV !== 'production';
        this.failingDB = false;
        this.failingRedis = false;
        this.latencyMs = 0;
    }

    setDBFailure(status) {
        if (!this.enabled) {
            logger.warn('⚠️ [Chaos] Ignored DB failure toggle because CHAOS is disabled.');
            return;
        }
        this.failingDB = status;
        logger.warn(`🔥 [Chaos] DB Failure Simulation: ${status ? 'ON' : 'OFF'}`);
    }

    setLatency(ms) {
        if (!this.enabled) {
            logger.warn('⚠️ [Chaos] Ignored latency injection because CHAOS is disabled.');
            return;
        }

        const safeLatency = Math.max(0, Math.min(Number(ms) || 0, 5000));
        this.latencyMs = safeLatency;
        logger.warn(`🐢 [Chaos] Latency Injection: ${safeLatency}ms`);
    }

    async inject() {
        if (!this.enabled) return;

        if (this.latencyMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.latencyMs));
        }
        if (this.failingDB) {
            throw new Error('[Chaos] Simulated Database Connection Loss');
        }
    }
}

module.exports = new ChaosTesting();
