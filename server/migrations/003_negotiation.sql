-- Migration: Add negotiation support for appointment bookings
-- Adds last_updated_by column to track whose turn it is in the negotiation loop

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(20);
-- Values: 'provider' or 'customer'

-- Show success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 003 completed: last_updated_by column added';
END $$;
