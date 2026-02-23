-- ==========================================
-- QAREEBLAK + HALAN CONSOLIDATED DATABASE SCHEMA
-- PostgreSQL Database for Multi-Service Marketplace
-- Date: 2026-02-14
-- Encoding: UTF-8 (utf8mb4 equivalent in PostgreSQL)
-- ==========================================
-- IMPORTANT: Tables are ordered by Foreign Key dependencies
-- Run this script on a fresh database or existing one (idempotent with IF NOT EXISTS)
-- ==========================================

-- Set client encoding to UTF8 for Arabic text support
SET client_encoding = 'UTF8';

-- Enable UUID extension for Halan backend
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- ENUMS FOR HALAN BACKEND SYSTEM
-- ==========================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'supervisor', 'courier');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- LEVEL 1: INDEPENDENT TABLES (No Foreign Keys)
-- ==========================================

-- Provider Join Requests
CREATE TABLE IF NOT EXISTS requests (
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

-- Halan Product Catalog (for order autocomplete)
CREATE TABLE IF NOT EXISTS halan_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- LEVEL 2: USERS TABLE (Self-referencing)
-- ==========================================

-- Main Users Table (Qareeblak + Halan Integrated)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE, -- For Halan partner login
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar TEXT, -- Base64 or URL
    user_type VARCHAR(50) DEFAULT 'customer', -- customer, provider, partner_owner, partner_supervisor, partner_courier
    is_banned BOOLEAN DEFAULT FALSE, -- User moderation
    -- Location tracking for couriers
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    last_location_update TIMESTAMP,
    -- Halan partner features
    is_available BOOLEAN DEFAULT FALSE, -- Courier availability
    supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Self-referencing (nullable, so safe)
    is_online BOOLEAN DEFAULT FALSE, -- Real-time online status
    max_active_orders INTEGER DEFAULT 10, -- Courier workload limit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Halan Backend Users (Separate System with UUID)
CREATE TABLE IF NOT EXISTS halan_users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL,
    supervisor_id INTEGER REFERENCES halan_users(id) ON DELETE SET NULL, -- Self-referencing
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE, -- For couriers: availability status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- LEVEL 3: USER-DEPENDENT TABLES
-- ==========================================

-- Service Providers
CREATE TABLE IF NOT EXISTS providers (
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

-- Parent Orders (Groups multiple bookings into one order)
CREATE TABLE IF NOT EXISTS parent_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    details TEXT,
    address_info JSONB, -- Flexible address storage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Halan Delivery Orders
CREATE TABLE IF NOT EXISTS delivery_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    pickup_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),
    courier_id INTEGER REFERENCES users(id),
    supervisor_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, picked_up, in_transit, delivered, cancelled
    notes TEXT,
    delivery_fee DECIMAL(10,2),
    items TEXT, -- JSON string of order items
    source VARCHAR(50), -- Order source tracking
    order_type VARCHAR(20) DEFAULT 'manual', -- manual, automated
    is_deleted BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    estimated_delivery TIMESTAMP,
    actual_delivery TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, success, warning, error
    reference_id VARCHAR(100), -- ID of the related object (order, booking, etc)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Complaints
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pharmacy Consultations (Chat Sessions)
CREATE TABLE IF NOT EXISTS consultations (
    id VARCHAR(100) PRIMARY KEY,
    customer_id INTEGER,
    provider_id INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    order_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courier-Supervisor Many-to-Many Relationship
CREATE TABLE IF NOT EXISTS courier_supervisors (
    courier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (courier_id, supervisor_id)
);

-- Halan Backend Orders
CREATE TABLE IF NOT EXISTS halan_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    -- Customer information
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),
    -- Pricing
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) DEFAULT 0,
    -- Status & workflow
    status order_status DEFAULT 'pending',
    notes TEXT,
    -- Relationships
    supervisor_id INTEGER REFERENCES halan_users(id) ON DELETE SET NULL,
    courier_id INTEGER REFERENCES halan_users(id) ON DELETE SET NULL,
    -- Invoice & tracking
    invoice_url VARCHAR(255),
    tracking_token VARCHAR(100) UNIQUE,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- LEVEL 4: PROVIDER/ORDER-DEPENDENT TABLES
-- ==========================================

-- Provider Services
CREATE TABLE IF NOT EXISTS services (
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

-- Provider Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    review_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages (Pharmacy Consultations)
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    consultation_id VARCHAR(100) NOT NULL,
    sender_id INTEGER,
    sender_type VARCHAR(20) NOT NULL, -- customer, provider
    message TEXT,
    image_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, order_quote
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery Order History (Status Tracking)
CREATE TABLE IF NOT EXISTS order_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES delivery_orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    notes TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Halan Backend Order Items
CREATE TABLE IF NOT EXISTS halan_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES halan_orders(id) ON DELETE CASCADE,
    name_ar VARCHAR(200) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2) DEFAULT 0,
    total_price DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Halan Backend Courier Locations (Real-time GPS Tracking)
CREATE TABLE IF NOT EXISTS halan_courier_locations (
    id SERIAL PRIMARY KEY,
    courier_id INTEGER REFERENCES halan_users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES halan_orders(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    speed DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Halan Backend Order History (Audit Log)
CREATE TABLE IF NOT EXISTS halan_order_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES halan_orders(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_status order_status,
    new_status order_status,
    changed_by INTEGER REFERENCES halan_users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- LEVEL 5: FINAL DEPENDENCIES
-- ==========================================

-- Service Bookings (Depends on users, providers, services, parent_orders)
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    parent_order_id INTEGER REFERENCES parent_orders(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled, rejected
    details TEXT,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Appointment features
    appointment_date TIMESTAMP,
    appointment_type VARCHAR(50), -- in_person, video_call, phone_call
    items TEXT, -- JSON string of booked items
    halan_order_id INTEGER, -- Link to delivery_orders
    last_updated_by VARCHAR(20), -- Tracks who last modified (customer/provider)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PERFORMANCE INDEXES
-- ==========================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);

-- Halan Users indexes
CREATE INDEX IF NOT EXISTS idx_halan_users_role ON halan_users(role);
CREATE INDEX IF NOT EXISTS idx_halan_users_supervisor ON halan_users(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_halan_users_username ON halan_users(username);

-- Providers indexes
CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);

-- Services indexes
CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_halan_order ON bookings(halan_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date ON bookings(appointment_date);
CREATE INDEX IF NOT EXISTS idx_bookings_parent_order ON bookings(parent_order_id);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON reviews(provider_id);

-- Delivery Orders indexes
CREATE INDEX IF NOT EXISTS idx_delivery_orders_courier ON delivery_orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_supervisor ON delivery_orders(supervisor_id);

-- Order History indexes
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, is_read);

-- Complaints indexes
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

-- Consultations indexes
CREATE INDEX IF NOT EXISTS idx_consultations_provider ON consultations(provider_id);
CREATE INDEX IF NOT EXISTS idx_consultations_customer ON consultations(customer_id);

-- Chat Messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation ON chat_messages(consultation_id);

-- Courier Supervisors indexes
CREATE INDEX IF NOT EXISTS idx_courier_supervisors_courier ON courier_supervisors(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_supervisors_supervisor ON courier_supervisors(supervisor_id);

-- Halan Orders indexes
CREATE INDEX IF NOT EXISTS idx_halan_orders_status ON halan_orders(status);
CREATE INDEX IF NOT EXISTS idx_halan_orders_supervisor ON halan_orders(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_halan_orders_courier ON halan_orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_halan_orders_tracking_token ON halan_orders(tracking_token);
CREATE INDEX IF NOT EXISTS idx_halan_orders_created_at ON halan_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_halan_orders_order_number ON halan_orders(order_number);

-- Halan Order Items indexes
CREATE INDEX IF NOT EXISTS idx_halan_order_items_order ON halan_order_items(order_id);

-- Halan Courier Locations indexes
CREATE INDEX IF NOT EXISTS idx_halan_courier_locations_courier ON halan_courier_locations(courier_id);
CREATE INDEX IF NOT EXISTS idx_halan_courier_locations_order ON halan_courier_locations(order_id);
CREATE INDEX IF NOT EXISTS idx_halan_courier_locations_recorded ON halan_courier_locations(recorded_at);

-- Halan Order History indexes
CREATE INDEX IF NOT EXISTS idx_halan_order_history_order ON halan_order_history(order_id);

-- ==========================================
-- TRIGGERS AND FUNCTIONS
-- ==========================================

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_halan_users_updated_at ON halan_users;
CREATE TRIGGER update_halan_users_updated_at
    BEFORE UPDATE ON halan_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_halan_orders_updated_at ON halan_orders;
CREATE TRIGGER update_halan_orders_updated_at
    BEFORE UPDATE ON halan_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parent_orders_updated_at ON parent_orders;
CREATE TRIGGER update_parent_orders_updated_at
    BEFORE UPDATE ON parent_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_orders_updated_at ON delivery_orders;
CREATE TRIGGER update_delivery_orders_updated_at
    BEFORE UPDATE ON delivery_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SCHEMA CONSOLIDATION COMPLETE
-- ==========================================
-- Total Tables: 20
--   - Main Project: 15 tables (users, providers, services, bookings, reviews, requests, notifications, complaints, consultations, chat_messages, parent_orders, delivery_orders, order_history, courier_supervisors, halan_products)
--   - Halan Backend: 5 tables (halan_users, halan_orders, halan_order_items, halan_courier_locations, halan_order_history)
-- 
-- Foreign Key Dependency Order: Verified ✓
-- Idempotency: All tables use IF NOT EXISTS ✓
-- UTF-8 Encoding: Set at beginning ✓
-- Safety: No logic changes, only consolidation ✓
-- ==========================================
