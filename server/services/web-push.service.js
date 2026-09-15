const webPush = require('web-push');
const db = require('../db');
const logger = require('../utils/logger');

/**
 * Web Push Notification Service
 * Uses VAPID protocol for browser-native push notifications (like WhatsApp/Facebook)
 * Works on Android Chrome, Firefox, Edge, Samsung Internet, and Safari 16.4+
 */

// ── VAPID Configuration ─────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@qareeblak.com';

let _initialized = false;

function initializeVapid() {
    if (_initialized) return true;

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        logger.warn('[WebPush] ⚠️ VAPID keys not configured. Web Push disabled.');
        logger.warn('[WebPush] Run: npx web-push generate-vapid-keys');
        logger.warn('[WebPush] Then set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
        return false;
    }

    try {
        webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        _initialized = true;
        logger.info('[WebPush] ✅ VAPID configured successfully');
        return true;
    } catch (err) {
        logger.error(`[WebPush] ❌ VAPID initialization failed: ${err.message}`);
        return false;
    }
}

// Initialize on module load
initializeVapid();

// ── Save Subscription ───────────────────────────────────────────────
async function saveSubscription(userId, subscription, userAgent = null) {
    try {
        const { endpoint, keys } = subscription;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            throw new Error('Invalid subscription object');
        }

        // Upsert: if endpoint already exists, update user_id (device re-login)
        const result = await db.query(`
            INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (endpoint) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                keys_p256dh = EXCLUDED.keys_p256dh,
                keys_auth = EXCLUDED.keys_auth,
                user_agent = EXCLUDED.user_agent,
                created_at = CURRENT_TIMESTAMP
            RETURNING id
        `, [userId, endpoint, keys.p256dh, keys.auth, userAgent]);

        logger.info(`[WebPush] Subscription saved for user #${userId} (id: ${result.rows[0]?.id})`);
        return true;
    } catch (err) {
        logger.error(`[WebPush] Failed to save subscription: ${err.message}`);
        return false;
    }
}

// ── Remove Subscription ─────────────────────────────────────────────
async function removeSubscription(endpoint) {
    try {
        await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
        logger.info('[WebPush] Subscription removed');
        return true;
    } catch (err) {
        logger.error(`[WebPush] Failed to remove subscription: ${err.message}`);
        return false;
    }
}

// ── Remove All User Subscriptions ───────────────────────────────────
async function removeUserSubscriptions(userId) {
    try {
        const result = await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
        logger.info(`[WebPush] Removed ${result.rowCount} subscriptions for user #${userId}`);
        return true;
    } catch (err) {
        logger.error(`[WebPush] Failed to remove user subscriptions: ${err.message}`);
        return false;
    }
}

// ── Send Push to Single User (All Their Devices) ────────────────────
async function sendPushToUser(userId, payload) {
    if (!initializeVapid()) return { success: false, reason: 'VAPID not configured' };

    try {
        const result = await db.query(
            'SELECT id, endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            logger.debug(`[WebPush] No subscriptions found for user #${userId}`);
            return { success: true, sent: 0 };
        }

        const pushPayload = JSON.stringify(payload);
        let sent = 0;
        const staleIds = [];

        for (const sub of result.rows) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.keys_p256dh,
                    auth: sub.keys_auth
                }
            };

            try {
                await webPush.sendNotification(pushSubscription, pushPayload, {
                    TTL: 60 * 60, // 1 hour
                    urgency: 'high',
                });
                sent++;
            } catch (pushErr) {
                // 410 Gone or 404 = subscription expired, remove it
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                    staleIds.push(sub.id);
                    logger.debug(`[WebPush] Subscription #${sub.id} expired (${pushErr.statusCode}), marking for removal`);
                } else {
                    logger.warn(`[WebPush] Failed to push to sub #${sub.id}: ${pushErr.message} (status: ${pushErr.statusCode})`);
                }
            }
        }

        // Cleanup stale subscriptions
        if (staleIds.length > 0) {
            await db.query('DELETE FROM push_subscriptions WHERE id = ANY($1)', [staleIds]);
            logger.info(`[WebPush] Cleaned up ${staleIds.length} expired subscriptions`);
        }

        logger.info(`[WebPush] Sent ${sent}/${result.rows.length} push notifications to user #${userId}`);
        return { success: true, sent };
    } catch (err) {
        logger.error(`[WebPush] sendPushToUser error: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// ── Convenience: Send notification with title, body, icon ───────────
async function sendNotification(userId, title, body, data = {}) {
    return sendPushToUser(userId, {
        title: title || 'قريبلك',
        body: body || 'إشعار جديد',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        dir: 'rtl',
        lang: 'ar',
        tag: data.tag || `qareeblak-${Date.now()}`,
        data: {
            url: data.url || '/',
            type: data.type || 'general',
            referenceId: data.referenceId || null,
            ...data,
        },
    });
}

// ── Ensure push_subscriptions table exists ──────────────────────────
async function ensureTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                endpoint TEXT NOT NULL UNIQUE,
                keys_p256dh TEXT NOT NULL,
                keys_auth TEXT NOT NULL,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id)');
    } catch (err) {
        // Table might already exist, that's fine
        if (!err.message.includes('already exists')) {
            logger.error(`[WebPush] Table creation error: ${err.message}`);
        }
    }
}

// Auto-create table on module load
ensureTable();

module.exports = {
    getVapidPublicKey: () => VAPID_PUBLIC_KEY,
    saveSubscription,
    removeSubscription,
    removeUserSubscriptions,
    sendPushToUser,
    sendNotification,
    isConfigured: () => _initialized,
};
