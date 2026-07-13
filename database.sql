-- ============================================
-- iPhone Store 25 - Database Schema
-- Updated: July 2026
-- Safe to re-run (uses IF NOT EXISTS)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- Drop existing objects (safe reset)
-- ============================================
DROP TRIGGER IF EXISTS products_updated_at ON products;
DROP TRIGGER IF EXISTS orders_updated_at ON orders;
DROP TRIGGER IF EXISTS settings_updated_at ON settings;
DROP TRIGGER IF EXISTS set_order_number ON orders;
DROP FUNCTION IF EXISTS update_timestamp();
DROP FUNCTION IF EXISTS generate_order_number();
DROP SEQUENCE IF EXISTS order_seq;
DROP VIEW IF EXISTS order_details;
DROP VIEW IF EXISTS dashboard_stats;
DROP FUNCTION IF EXISTS get_order_count();
DROP FUNCTION IF EXISTS get_product_count();

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ============================================
-- 1. Categories
-- ============================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(10) DEFAULT '📱',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Products
-- ============================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    old_price DECIMAL(10,2) CHECK (old_price >= 0),
    emoji VARCHAR(10) DEFAULT '📱',
    image_url TEXT,
    badge VARCHAR(10) CHECK (badge IN ('new', 'hot', 'sale')),
    description TEXT DEFAULT '',
    stock VARCHAR(50) DEFAULT 'En stock',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Orders
-- ============================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Order Items
-- ============================================
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    product_emoji VARCHAR(10),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Settings
-- ============================================
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- Auto-update timestamp function
-- ============================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Auto-generate order number
-- ============================================
CREATE SEQUENCE order_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('order_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================
-- Default Categories
-- ============================================
INSERT INTO categories (name, slug, icon, sort_order) VALUES
('Téléphones', 'telephone', '📱', 1),
('Écrans', 'ecran', '🖥️', 2),
('Batteries', 'batterie', '🔋', 3),
('Caméras', 'camera', '📷', 4),
('Boîtiers', 'boitier', '🛡️', 5),
('Accessoires', 'accessoire', '✨', 6),
('Outils', 'outils', '🔧', 7);

-- ============================================
-- Default Settings
-- ============================================
INSERT INTO settings (key, value) VALUES
('store_name', 'iPhone Store 25'),
('store_email', 'contact@iphonestore25.dz'),
('store_phone', '+213 770 579 244'),
('store_phone2', '+213 770 579 211'),
('currency', 'DA'),
('shipping_cost', '500'),
('free_shipping_min', '5000'),
('admin_password', 'admin123');
