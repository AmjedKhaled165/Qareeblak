-- Migration: Add is_online column to providers table
-- This allows providers to toggle their visibility in the app

ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
