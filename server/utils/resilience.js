const CircuitBreaker = require('opossum');
const logger = require('./logger');
const Monitoring = require('./monitoring');

/**
 * Enterprise Circuit Breaker Service
 * Prevents cascading failures by stopping requests to failing services.
 * Similar to patterns used by Uber, Netflix, and Amazon.
 */
class ResilienceManager {
    constructor() {
        this.options = {
            timeout: 5000, // If a task takes longer than 5s, it's a failure
            errorThresholdPercentage: 50, // Trip if >50% requests fail
            resetTimeout: 30000 // Wait 30s before trying again
        };
        this.breakers = new Map();
    }

    /**
     * Wrap a function with a circuit breaker
     * @param {string} name - Unique name for the circuit
     * @param {Function} action - Async function to protect
     * @param {Function} fallback - Optional fallback function
     */
    getBreaker(name, action, fallback = null) {
        if (this.breakers.has(name)) {
            return this.breakers.get(name);
        }

        const breaker = new CircuitBreaker(action, this.options);

        if (fallback) {
            breaker.fallback(fallback);
        }

        breaker.on('open', () => {
            logger.warn(`🚨 [Resilience] Circuit OPEN for: ${name}`);
            Monitoring.logEvent(`Circuit OPEN: ${name}`, 'warning');
        });

        breaker.on('halfOpen', () => {
            logger.info(`⚖️ [Resilience] Circuit HALF-OPEN for: ${name} (Testing recovery...)`);
        });

        breaker.on('close', () => {
            logger.info(`✅ [Resilience] Circuit CLOSED for: ${name} (Service recovered)`);
        });

        breaker.on('failure', (err) => {
            logger.error(`❌ [Resilience] Failure in ${name}:`, err.message);
        });

        this.breakers.set(name, breaker);
        return breaker;
    }

    /**
     * Execute a guarded action
     */
    async fire(name, action, ...args) {
        const breaker = this.getBreaker(name, action);
        return breaker.fire(...args);
    }
}

module.exports = new ResilienceManager();
