const client = require('prom-client');
const logger = require('./logger');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: 'qareeblak-api'
});

// Add the binary metrics
client.collectDefaultMetrics({ register });

// 1. HTTP Request Metrics
const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10] // 0.1s to 10s
});

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'code']
});

// 2. Database Metrics
const dbQueryDurationSeconds = new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// 3. Business Metrics (Elite Hardening)
const bookingCreationsTotal = new client.Counter({
    name: 'booking_creations_total',
    help: 'Total number of successful bookings',
    labelNames: ['provider_id']
});

const checkoutFailuresTotal = new client.Counter({
    name: 'checkout_failures_total',
    help: 'Total number of failed checkout attempts',
    labelNames: ['reason']
});

const activeCheckoutsGauge = new client.Gauge({
    name: 'active_checkouts_gauge',
    help: 'Number of active checkout operations currently in progress'
});

// Register all metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(dbQueryDurationSeconds);
register.registerMetric(bookingCreationsTotal);
register.registerMetric(checkoutFailuresTotal);
register.registerMetric(activeCheckoutsGauge);

module.exports = {
    register,
    httpRequestDurationMicroseconds,
    httpRequestsTotal,
    dbQueryDurationSeconds,
    bookingCreationsTotal,
    checkoutFailuresTotal,
    activeCheckoutsGauge
};
