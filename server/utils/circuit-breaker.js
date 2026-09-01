const CircuitBreaker = require('opossum');
const logger = require('./logger');

/**
 * Circuit Breaker Manager
 * Protects the system from cascade failures when external services (S3, WhatsApp, SMS) are down.
 */
class BreakerManager {
    constructor() {
        this.breakers = new Map();
    }

    /**
     * @param {string} name - Name of the external service
     * @param {Function} action - Async function to wrap
     * @param {Object} options - Opossum options
     */
    getBreaker(name, action, options = {}) {
        if (this.breakers.has(name)) {
            return this.breakers.get(name);
        }

        const defaultOptions = {
            timeout: 5000, // If the action takes longer than 5s, fail it.
            errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit.
            resetTimeout: 30000 // Wait 30s before trying again.
        };

        const breaker = new CircuitBreaker(action, { ...defaultOptions, ...options });

        breaker.on('open', () => logger.error(`\u26a0\ufe0f [CircuitBreaker] ${name} is OPEN. Failing fast.`));
        breaker.on('halfOpen', () => logger.info(`\ud83d\udd04 [CircuitBreaker] ${name} is HALF_OPEN. Testing...`));
        breaker.on('close', () => logger.info(`\u2705 [CircuitBreaker] ${name} is CLOSED. Service restored.`));

        // Monitoring hooks for Prometheus/Grafana could go here
        breaker.on('fallback', (data) => logger.warn(`\ud83d\udee0\ufe0f [CircuitBreaker] ${name} FALLBACK triggered.`));

        this.breakers.set(name, breaker);
        return breaker;
    }
}

module.exports = new BreakerManager();
