-- Printyx Database Manual Export
-- Generated on: 2025-08-10T13:21:00.000Z
-- Critical data for production transfer

-- TENANTS DATA
INSERT INTO "tenants" ("id", "name", "domain", "created_at", "updated_at", "slug", "subdomain_prefix", "path_prefix", "is_active", "plan") VALUES 
('1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Demo Copier Dealer', 'demo', '2025-07-31 22:57:56.640151', '2025-07-31 22:57:56.640151', NULL, NULL, NULL, true, 'basic'),
('550e8400-e29b-41d4-a716-446655440000', 'Demo Copier Dealership', NULL, '2025-08-01 01:58:32.724019', '2025-08-01 01:58:32.724019', 'printyx-demo', 'printyx-demo', 'printyx-demo', true, 'enterprise');

-- Note: Your database contains:
-- - 20 users across 2 tenants
-- - 384 master product models
-- - Complete product catalog with Canon, HP, Xerox products
-- - Role-based access control system
-- - Multi-tenant architecture with proper isolation

-- To get complete data exports, use these SQL commands in your production environment:

-- Export all users:
-- SELECT * FROM users;

-- Export all master products:
-- SELECT * FROM master_product_models;

-- Export all enabled products:
-- SELECT * FROM enabled_products;

-- Export roles and permissions:
-- SELECT * FROM roles;
-- SELECT * FROM role_permissions;

-- For CSV exports, use:
-- \COPY tenants TO 'tenants.csv' WITH CSV HEADER;
-- \COPY users TO 'users.csv' WITH CSV HEADER;
-- \COPY master_product_models TO 'products.csv' WITH CSV HEADER;