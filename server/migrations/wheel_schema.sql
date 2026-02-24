-- Wheel of Luck Database Schema

-- 1. Table for available prizes in the wheel
CREATE TABLE IF NOT EXISTS wheel_prizes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- e.g., 'خصم 10% عند السلطان'
    prize_type VARCHAR(50) NOT NULL, -- 'discount_percent', 'discount_flat', 'free_delivery'
    prize_value DECIMAL(10, 2), -- 10.00 for 10%
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE, -- Optional: null means global
    probability INTEGER NOT NULL DEFAULT 10, -- Weight for the wheel (e.g., higher = more common)
    color VARCHAR(20) DEFAULT '#f44336', -- Slice color on the wheel
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table for prizes won by users
CREATE TABLE IF NOT EXISTS user_prizes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    prize_id INTEGER REFERENCES wheel_prizes(id) ON DELETE CASCADE,
    is_used BOOLEAN DEFAULT FALSE,
    won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL, -- Track which order it was applied to
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wheel_prizes_active ON wheel_prizes(is_active);
CREATE INDEX IF NOT EXISTS idx_user_prizes_user ON user_prizes(user_id, is_used);

-- 4. Sample Data (Optional, but helpful for testing)
-- Note: Replace provider_id with actual IDs once known
-- INSERT INTO wheel_prizes (name, prize_type, prize_value, provider_id, probability, color) VALUES
-- ('توصيل مجاني', 'free_delivery', 0, NULL, 50, '#4CAF50'),
-- ('خصم 10% السلطان', 'discount_percent', 10, 1, 30, '#2196F3'),
-- ('خصم 20% البركة', 'discount_percent', 20, 2, 10, '#FFC107'),
-- ('خصم 50 جنيه', 'discount_flat', 50, NULL, 10, '#E91E63');
