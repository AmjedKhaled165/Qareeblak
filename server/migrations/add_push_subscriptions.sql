-- ==========================================
-- Web Push Subscriptions Table
-- Stores browser push subscription endpoints for native notifications
-- ==========================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by user_id (when sending push to a user)
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
