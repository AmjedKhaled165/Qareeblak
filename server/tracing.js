const logger = require('./utils/logger');

/**
 * 🛰️ [ELITE] OpenTelemetry Distributed Tracing
 * Records request flow across services/DBs. 
 * Requires OTLP collector (Jaeger/Tempo) to receive data.
 */

if (process.env.OTEL_ENABLED !== 'true') {
    logger.info('Tracing disabled (OTEL_ENABLED not set to true).');
} else {
    try {
        const { NodeSDK } = require('@opentelemetry/sdk-node');
        const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
        const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
        const { resourceFromAttributes } = require('@opentelemetry/resources');
        const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

        const sdk = new NodeSDK({
            resource: resourceFromAttributes({
                [SemanticResourceAttributes.SERVICE_NAME]: 'qareeblak-backend',
            }),
            traceExporter: new OTLPTraceExporter({
                url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
            }),
            instrumentations: [getNodeAutoInstrumentations()],
        });

        sdk.start();
        logger.info('🛰️ OpenTelemetry Distributed Tracing started.');

        process.on('SIGTERM', () => {
            sdk.shutdown()
                .then(() => logger.info('Tracing terminated'))
                .catch((error) => logger.error('Error terminating tracing', error))
                .finally(() => process.exit(0));
        });
    } catch (error) {
        logger.warn('Tracing initialization skipped:', error.message);
    }
}
