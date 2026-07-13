-- ============================================
-- iPhone Store 25 - Sample Data
-- Updated: July 2026
-- Safe to re-run
-- ============================================

-- Sample Orders (for testing)
INSERT INTO orders (order_number, customer_name, customer_phone, status, payment_method, payment_status, subtotal, shipping_cost, total) VALUES
('ORD-202607-0001', 'Ahmed Benali', '+213770579211', 'delivered', 'cod', 'paid', 85000, 500, 85500),
('ORD-202607-0002', 'Sara Meziane', '+213550123456', 'shipped', 'ccp', 'paid', 18500, 500, 19000),
('ORD-202607-0003', 'Youcef Hamidi', '+213660789012', 'confirmed', 'baridimob', 'paid', 4500, 500, 5000),
('ORD-202607-0004', 'Mohamed Amine', '+213555123789', 'pending', 'cod', 'pending', 12000, 500, 12500),
('ORD-202607-0005', 'Fatima Zahra', '+213661987654', 'delivered', 'ccp', 'paid', 32000, 0, 32000);
