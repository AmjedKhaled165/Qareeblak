const Opossum = require('opossum');
const logger = require('./logger');

/**
 * Enterprise-grade Circuit Breaker pattern
 * Prevents a failing service from taking down the entire system.
 */
const createCircuitBreaker = (asyncFunc, options = {}) => {
    const defaultOptions = {
        timeout: 3000, // If service takes longer than 3s, trigger timeout
        errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
        resetTimeout: 30000 // After 30s, try again
    };

    const breaker = new Opossum(asyncFunc, { ...defaultOptions, ...options });

    breaker.on('open', () => logger.warn(`🔥 Circuit Breaker OPEN for service: ${asyncFunc.name}`));
    breaker.on('halfOpen', () => logger.info(`🌓 Circuit Breaker HALF-OPEN for service: ${asyncFunc.name}`));
    breaker.on('close', () => logger.info(`✅ Circuit Breaker CLOSED for service: ${asyncFunc.name}`));
    breaker.on('fallback', (result) => logger.warn(`🩹 Circuit Breaker FALLBACK used for service: ${asyncFunc.name}`));

    return breaker;
};

module.exports = { createCircuitBreaker };
