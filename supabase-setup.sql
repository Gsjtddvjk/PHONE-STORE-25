-- ============================================
-- iPhone Store 25 - Supabase Setup
-- Updated: July 2026
-- Safe to re-run
-- Run AFTER database.sql
-- ============================================

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop old policies if exist
-- ============================================
DO $$ BEGIN
    DROP POLICY IF EXISTS "Categories: Public read" ON categories;
    DROP POLICY IF EXISTS "Categories: Admin all" ON categories;
    DROP POLICY IF EXISTS "Products: Public read" ON products;
    DROP POLICY IF EXISTS "Products: Admin all" ON products;
    DROP POLICY IF EXISTS "Orders: Admin all" ON orders;
    DROP POLICY IF EXISTS "Order Items: Admin all" ON order_items;
    DROP POLICY IF EXISTS "Settings: Public read" ON settings;
    DROP POLICY IF EXISTS "Settings: Admin all" ON settings;
    DROP POLICY IF EXISTS "Product images: Public read" ON storage.objects;
    DROP POLICY IF EXISTS "Product images: Admin upload" ON storage.objects;
    DROP POLICY IF EXISTS "Product images: Admin delete" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- PUBLIC READ Policies
-- ============================================
CREATE POLICY "Categories: Public read" ON categories
    FOR SELECT USING (true);

CREATE POLICY "Products: Public read" ON products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Settings: Public read" ON settings
    FOR SELECT USING (true);

-- ============================================
-- ADMIN FULL ACCESS (service_role)
-- ============================================
CREATE POLICY "Products: Admin all" ON products
    FOR ALL USING (true);

CREATE POLICY "Categories: Admin all" ON categories
    FOR ALL USING (true);

CREATE POLICY "Orders: Admin all" ON orders
    FOR ALL USING (true);

CREATE POLICY "Order Items: Admin all" ON order_items
    FOR ALL USING (true);

CREATE POLICY "Settings: Admin all" ON settings
    FOR ALL USING (true);

-- ============================================
-- STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Product images: Public read" ON storage.objects
    FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Product images: Admin upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'products');

CREATE POLICY "Product images: Admin delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'products');

-- ============================================
-- Views
-- ============================================
CREATE OR REPLACE VIEW order_details AS
SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.customer_phone,
    o.customer_email,
    o.shipping_address,
    o.shipping_city,
    o.status,
    o.payment_method,
    o.payment_status,
    o.subtotal,
    o.shipping_cost,
    o.total,
    o.notes,
    o.created_at,
    json_agg(
        json_build_object(
            'product_name', oi.product_name,
            'product_emoji', oi.product_emoji,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
        )
    ) as items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id
ORDER BY o.created_at DESC;

CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
    (SELECT COUNT(*) FROM orders) as total_orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
    (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'paid') as total_revenue,
    (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '7 days') as orders_this_week;

-- ============================================
-- Enable REALTIME on tables
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
