-- ==========================================
-- DATABASE MIGRATION: Qareeblak Security & Features Merge
-- Date: 2026-02-13
-- Description: Adds moderation features and complaint system
-- Safe to run: Uses IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS
-- ==========================================

-- 1. Add is_banned column to users table (User moderation)
DO $$ BEGIN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'Column users.is_banned already exists, skipping.';
END $$;

-- Add index for banned users (performance optimization)
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- 2. Create complaints table (User feedback system)
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for complaint status (for admin dashboard queries)
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

-- 3. Additional performance indexes (if not already present)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, is_read);

-- Verification Query (Run this to check migration success)
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'is_banned';

-- SELECT table_name FROM information_schema.tables WHERE table_name = 'complaints';
