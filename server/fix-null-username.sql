-- Fix NULL username for owner account
-- This script updates the broken owner account to have a valid username

UPDATE users 
SET username = 'amjed-owner'
WHERE user_type = 'partner_owner' 
  AND username IS NULL 
  AND name = 'amjed';

-- Verify the fix
SELECT id, username, name, user_type 
FROM users 
WHERE user_type = 'partner_owner'
ORDER BY name;
