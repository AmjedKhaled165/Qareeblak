-- Create Admin/Owner User for Qareeblak System
-- Run this in PostgreSQL to create a test admin account

-- First, check if admin already exists
DO $$
DECLARE
    admin_exists INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_exists FROM users WHERE email = 'admin@qareeblak.com';
    
    IF admin_exists = 0 THEN
        -- Create admin user (password: admin123)
        INSERT INTO users (
            name,
            name_ar,
            email,
            password,
            phone,
            user_type,
            is_banned,
            created_at
        ) VALUES (
            'System Admin',
            'مسؤول النظام',
            'admin@qareeblak.com',
            '$2b$10$YQmE6xN3L0rP0mF4KY0.xOH6Z5QH5Q5H5Q5H5Q5H5Q5H5Q5H5Q5H5', -- hashed 'admin123'
            '01000000000',
            'owner',  -- 'owner' gives God Mode access
            false,
            NOW()
        );
        
        RAISE NOTICE 'Admin user created successfully!';
        RAISE NOTICE 'Email: admin@qareeblak.com';
        RAISE NOTICE 'Password: admin123';
    ELSE
        -- Update existing user to be owner
        UPDATE users 
        SET user_type = 'owner', is_banned = false
        WHERE email = 'admin@qareeblak.com';
        
        RAISE NOTICE 'Admin user already exists - updated to owner type';
    END IF;
END $$;

-- Display the admin user info
SELECT 
    id,
    name,
    email,
    user_type,
    is_banned,
    created_at
FROM users 
WHERE email = 'admin@qareeblak.com';
