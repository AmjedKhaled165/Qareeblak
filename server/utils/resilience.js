const logger = require('./logger');

/**
 * [ELITE] Chaos Engineering Utility
 * Allows manual injection of faults to test system recovery/degraded mode.
 * ⚠️ NEVER USE IN PRODUCTION WITHOUT EXPLICIT PERMISSION
 */
class ChaosTesting {
    constructor() {
        this.failingDB = false;
        this.failingRedis = false;
        this.latencyMs = 0;
    }

    setDBFailure(status) {
        this.failingDB = status;
        logger.warn(`🔥 [Chaos] DB Failure Simulation: ${status ? 'ON' : 'OFF'}`);
    }

    setLatency(ms) {
        this.latencyMs = ms;
        logger.warn(`🐢 [Chaos] Latency Injection: ${ms}ms`);
    }

    async inject() {
        if (this.latencyMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.latencyMs));
        }
        if (this.failingDB) {
            throw new Error('[Chaos] Simulated Database Connection Loss');
        }
    }
}

module.exports = new ChaosTesting();
