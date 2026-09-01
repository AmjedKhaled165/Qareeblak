-- Migration: Add missing columns to bookings table
-- This fixes the "column appointment_date does not exist" error

-- Add columns for maintenance/appointment bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50); -- maintenance, pharmacy

-- Add columns for Halan integration
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS items TEXT; -- JSON string of order items
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS halan_order_id INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parent_order_id INTEGER; -- For linking related orders

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_halan_order ON bookings(halan_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date ON bookings(appointment_date);

-- Show success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '   - appointment_date column added';
    RAISE NOTICE '   - appointment_type column added';
    RAISE NOTICE '   - items column added';
    RAISE NOTICE '   - halan_order_id column added';
    RAISE NOTICE '   - parent_order_id column added';
    RAISE NOTICE '   - Indexes created';
END $$;
