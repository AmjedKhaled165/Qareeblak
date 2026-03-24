const logger = require('./logger');

/**
 * Enterprise Exponential Backoff Retry Wrapper
 * Essential for third-party integrations (FCM, SMS Gateway, Payment Gateway)
 * to handle transient network errors without failing the main request.
 *
 * @param {Function} asyncFunction - The function to execute
 * @param {Object} options - Configuration for retries
 * @returns {Promise<any>}
 */
const withRetry = async (
    asyncFunction,
    {
        retries = 3,
        delayMs = 1000,
        factor = 2,
        onRetry = null,
        name = 'Operation'
    } = {}
) => {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await asyncFunction();
        } catch (error) {
            attempt++;
            logger.warn(`[Retry] ${name} failed attempt ${attempt}/${retries}: ${error.message}`);

            if (attempt >= retries) {
                logger.error(`[Retry] ${name} permanently failed after ${retries} attempts.`);
                throw error;
            }

            if (onRetry) {
                onRetry(error, attempt);
            }

            // Exponential backoff
            const waitTime = delayMs * Math.pow(factor, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
    }
};

module.exports = withRetry;
