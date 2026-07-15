-- ============================================
-- iPhone Store 25 - Migration: 3 images + customer info
-- Run this in Supabase SQL Editor
-- ============================================

-- Add image columns for 3 images per product
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url2 TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url3 TEXT;

-- Create customer_orders table for storing buyer info
CREATE TABLE IF NOT EXISTS customer_orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'cod',
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable real-time for customer_orders
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS customer_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS products;