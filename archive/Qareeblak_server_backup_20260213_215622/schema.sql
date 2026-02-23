-- Qareeblak Database Schema
-- PostgreSQL Database for Service Marketplace

-- Drop existing tables if they exist
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS providers CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ================== USERS TABLE ==================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE, -- For Halan partner login
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar TEXT, -- Base64 or URL
    user_type VARCHAR(50) DEFAULT 'customer', -- customer, provider, partner_owner, partner_supervisor, partner_courier
    is_banned BOOLEAN DEFAULT FALSE, -- PRODUCTION: Moderation status
    -- Location tracking for couriers
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    last_location_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== PROVIDERS TABLE ==================
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    phone VARCHAR(50),
    rating DECIMAL(2,1) DEFAULT 0.0,
    reviews_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT TRUE,
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== SERVICES TABLE ==================
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image TEXT,
    -- Offer fields
    has_offer BOOLEAN DEFAULT FALSE,
    offer_type VARCHAR(50), -- 'discount' or 'bundle'
    discount_percent INTEGER,
    bundle_count INTEGER,
    bundle_free_count INTEGER,
    offer_end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== BOOKINGS TABLE ==================
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled, rejected
    details TEXT,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== REVIEWS TABLE ==================
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    review_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== REQUESTS TABLE ==================
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    category VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== INDEXES ==================
CREATE INDEX idx_providers_category ON providers(category);
CREATE INDEX idx_providers_user_id ON providers(user_id);
CREATE INDEX idx_services_provider_id ON services(provider_id);
CREATE INDEX idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_reviews_provider_id ON reviews(provider_id);

-- ================== SAMPLE DATA ==================
-- Insert default users for initial providers
INSERT INTO users (name, email, password, user_type) VALUES
('مطعم البركة', 'baraka@example.com', 'password123', 'provider'),
('م. أحمد', 'ahmed@example.com', 'password123', 'provider');

-- Insert default providers
INSERT INTO providers (user_id, name, email, category, location, phone, rating, reviews_count, is_approved) VALUES
(1, 'مطعم البركة', 'baraka@example.com', 'مطاعم', 'الحي الأول، المجاورة الثانية', '010xxxx', 4.8, 2, TRUE),
(2, 'سباكة حديثة - م. أحمد', 'ahmed@example.com', 'صيانة', 'ابني بيتك، المنطقة الخامسة', '011xxxx', 4.9, 45, TRUE);

-- Insert default services
INSERT INTO services (provider_id, name, description, price) VALUES
(1, 'كشري وسط', 'طبق كشري مع دقة', 25),
(1, 'طاجن مكرونة', 'طاجن باللحمة المفرومة', 40),
(2, 'صيانة حنفية', 'تغيير قلب حنفية وصيانة', 150);

-- Insert sample reviews
INSERT INTO reviews (provider_id, user_name, rating, comment, review_date) VALUES
(1, 'Unknown', 5, 'أكل ممتاز وسخن!', '2024-05-01'),
(1, 'Unknown', 4, 'تأخير بسيط بس الطعم روعة', '2024-05-02');

-- ================== NOTIFICATIONS TABLE ==================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, success, warning, error
    reference_id VARCHAR(100), -- ID of the related object (order, booking, etc)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== COMPLAINTS TABLE ==================
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================== ADDITIONAL INDEXES ==================
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, is_read);
