const db = require('../db');
const { maintenanceQueue } = require('./queues');
const logger = require('./logger');
const reconciliation = require('./reconciliation');

/**
 * [TOP 0.1%] Backpressure-Aware Outbox Poller
 * Adjusts throughput based on Database Load.
 */
async function processOutbox() {
    // [ELITE: BACKPRESSURE] Check system load before processing
    const activeConns = await reconciliation.getSystemPressure();
    if (activeConns > 40) { // Threshold: 40 active DB connections
        logger.warn(`[Poller Backpressure] DB Load high (${activeConns} conns). Throttling...`);
        return; 
    }

    const client = await db.connect();
    try {
        const result = await client.query(`
            SELECT id, event_type, payload, attempts 
            FROM outbox_events 
            WHERE status = 'pending' 
              AND attempts < 10 
              AND (next_run_at <= NOW() OR next_run_at IS NULL)
            ORDER BY created_at ASC 
            LIMIT 50
            FOR UPDATE SKIP LOCKED
        `);

        for (const event of result.rows) {
            try {
                await maintenanceQueue.add(event.event_type, event.payload, {
                    jobId: `outbox_${event.id}`,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 2000 }
                });

                await client.query(
                    'UPDATE outbox_events SET status = $1, processed_at = NOW() WHERE id = $2',
                    ['processed', event.id]
                );
            } catch (dispatchErr) {
                const baseDelay = Math.min(Math.pow(2, event.attempts + 1) * 60, 7200); 
                const jitter = Math.floor(Math.random() * 30);
                const totalDelay = baseDelay + jitter;
                
                await client.query(`
                    UPDATE outbox_events 
                    SET attempts = attempts + 1, 
                        status = $1,
                        last_error = $2, 
                        next_run_at = NOW() + interval '${totalDelay} seconds'
                    WHERE id = $3
                `, [event.attempts + 1 >= 10 ? 'failed' : 'pending', dispatchErr.message, event.id]);
            }
        }
    } catch (err) {
        logger.error('[Outbox Poller] Error:', err);
    } finally {
        client.release();
    }
}

async function archiveOutbox() {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const moveResult = await client.query(`
            INSERT INTO outbox_archive 
            SELECT * FROM outbox_events 
            WHERE status IN ('processed', 'failed') 
              AND (processed_at < NOW() - interval '7 days' OR (status = 'failed' AND created_at < NOW() - interval '30 days'))
        `);
        if (moveResult.rowCount > 0) {
            await client.query(`DELETE FROM outbox_events WHERE id IN (SELECT id FROM outbox_archive)`);
            logger.info(`[Outbox Archive] Moved ${moveResult.rowCount} events.`);
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
    } finally {
        client.release();
    }
}

function startOutboxPoller(intervalMs = 5000) {
    logger.info(`🚀 Elite Poller with Backpressure active.`);
    setInterval(processOutbox, intervalMs);
    setInterval(archiveOutbox, 24 * 60 * 60 * 1000);
}

module.exports = { startOutboxPoller };
