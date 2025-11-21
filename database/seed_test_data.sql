-- Printyx Test Seed Data (Replit PostgreSQL)
-- Purpose: Populate realistic test data across core tables to exercise features and reveal lingering mock data
-- Usage (psql): \i database/seed_test_data.sql

-- Safe re-runs: Rows include a unique seed tag so you can identify/delete test data without affecting real data

CREATE EXTENSION IF NOT EXISTS pgcrypto;
BEGIN;

-- Global seed identifiers
-- Update the tag/date if you want to generate a new batch later
WITH seed AS (
  SELECT
    gen_random_uuid()            AS seed_batch_id,
    'SEED_TEST_2025_08_12'::text AS seed_tag,
    now()                        AS seeded_at
)

-- 1) Tenancy and org scaffolding
, new_tenant AS (
  INSERT INTO tenants (id, name, domain, settings, subscription_tier, status, last_activity, created_at, updated_at)
  SELECT gen_random_uuid(), seed.seed_tag || ' Tenant', lower(replace(seed.seed_tag,'_','')) || '.local', '{}'::jsonb, 'enterprise', 'active', seed.seeded_at, seed.seeded_at, seed.seeded_at
  FROM seed
  RETURNING id AS tenant_id
)
, new_region AS (
  INSERT INTO regions (id, name, description, tenant_id, is_active, created_at)
  SELECT gen_random_uuid(), seed.seed_tag || ' Region', 'Seed test region', t.tenant_id, true, seed.seeded_at
  FROM seed, new_tenant t
  RETURNING id AS region_id
)
, new_location AS (
  INSERT INTO locations (id, name, address, city, state, zip_code, phone, region_id, tenant_id, is_active, created_at)
  SELECT gen_random_uuid(), seed.seed_tag || ' HQ', '123 Test Way', 'Testville', 'TX', '73301', '555-0100', r.region_id, t.tenant_id, true, seed.seeded_at
  FROM seed, new_tenant t, new_region r
  RETURNING id AS location_id
)

-- 2) Users (minimal, for ownership)
, new_user_admin AS (
  INSERT INTO users (id, email, first_name, last_name, role, tenant_id, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), 'admin+' || lower(replace(seed.seed_tag,'_','')) || '@seed.local', 'Seed', 'Admin', 'admin', t.tenant_id, true, seed.seeded_at, seed.seeded_at
  FROM seed, new_tenant t
  RETURNING id AS admin_user_id
)
, new_user_sales AS (
  INSERT INTO users (id, email, first_name, last_name, role, tenant_id, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), 'sales+' || lower(replace(seed.seed_tag,'_','')) || '@seed.local', 'Seed', 'Rep', 'sales', t.tenant_id, true, seed.seeded_at, seed.seeded_at
  FROM seed, new_tenant t
  RETURNING id AS sales_user_id
)

-- 3) Vendors
, v1 AS (
  INSERT INTO vendors (id, tenant_id, vendor_name, email, phone, payment_terms, is_active, created_at)
  SELECT gen_random_uuid(), t.tenant_id, seed.seed_tag || ' Canon Supplies', 'canon@seed.local', '555-0200', 'Net 30', true, seed.seeded_at
  FROM seed, new_tenant t RETURNING id AS vendor_id
)
, v2 AS (
  INSERT INTO vendors (id, tenant_id, vendor_name, email, phone, payment_terms, is_active, created_at)
  SELECT gen_random_uuid(), t.tenant_id, seed.seed_tag || ' Xerox Parts', 'xerox@seed.local', '555-0201', 'Net 30', true, seed.seeded_at
  FROM seed, new_tenant t RETURNING id AS vendor_id
)

-- 4) Inventory (mix of normal and low stock)
, inv AS (
  INSERT INTO inventory_items (
    id, tenant_id, part_number, manufacturer_part_number, item_description, item_category, manufacturer,
    quantity_on_hand, quantity_committed, quantity_available, quantity_on_order,
    reorder_point, reorder_quantity, unit_cost, unit_price, warehouse_location, bin_location, primary_vendor, created_at
  )
  SELECT
    gen_random_uuid(), t.tenant_id, 'TONER-C-001', 'C-001', seed.seed_tag || ' Cyan Toner', 'Supplies', 'Canon',
    2, 0, 2, 0,
    5, 10, 45.00, 75.00, 'WH-A', 'A1', 'Canon Supplies', seed.seeded_at
  FROM seed, new_tenant t
  UNION ALL
  SELECT gen_random_uuid(), t.tenant_id, 'DRUM-X-010', 'X-010', seed.seed_tag || ' Drum Unit', 'Parts', 'Xerox',
    20, 2, 18, 5,
    10, 10, 120.00, 180.00, 'WH-B', 'B2', 'Xerox Parts', seed.seeded_at
  FROM seed, new_tenant t
  RETURNING id
)

-- 5) Business records (customer)
, cust AS (
  INSERT INTO business_records (id, record_type, lead_status, company_name, email, phone, address, city, state, zip_code, tenant_id, created_at, updated_at)
  SELECT gen_random_uuid(), 'customer', 'converted', seed.seed_tag || ' Industries', 'contact@seed.local', '555-0300', '456 Customer Rd', 'Clientown', 'CA', '94016', t.tenant_id, seed.seeded_at, seed.seeded_at
  FROM seed, new_tenant t
  RETURNING id AS customer_id
)
-- Company and contact (if separate tables exist)
, comp AS (
  INSERT INTO companies (id, name, tenant_id, created_at, updated_at)
  SELECT gen_random_uuid(), seed.seed_tag || ' Industries', t.tenant_id, seed.seeded_at, seed.seeded_at
  FROM seed, new_tenant t
  RETURNING id AS company_id
)
, contact AS (
  INSERT INTO company_contacts (id, first_name, last_name, email, phone, is_primary, company_id, tenant_id, created_at)
  SELECT gen_random_uuid(), 'Casey', 'Customer', 'casey@seed.local', '555-0301', true, c.company_id, t.tenant_id, seed.seeded_at
  FROM seed, new_tenant t, comp c
  RETURNING id AS contact_id
)

-- 6) Technicians
, tech AS (
  INSERT INTO technicians (id, tenant_id, user_id, first_name, last_name, email, phone, is_active, created_at)
  SELECT gen_random_uuid(), t.tenant_id, u.admin_user_id, 'Taylor', 'Tech', 'ttech@seed.local', '555-0400', true, seed.seeded_at
  FROM seed, new_tenant t, new_user_admin u
  RETURNING id AS technician_id
)

-- 7) Service Tickets (+ updates)
, st AS (
  INSERT INTO service_tickets (id, tenant_id, customer_id, ticket_number, title, description, priority, status, assigned_technician_id, scheduled_date, created_by, created_at, updated_at)
  SELECT gen_random_uuid(), t.tenant_id, br.customer_id, 'ST-' || to_char(now(),'YYYYMMDD') || '-001', seed.seed_tag || ' Printer Jams', 'Intermittent paper jams on main tray', 'high', 'assigned', tech.technician_id, now() - interval '2 days', u.admin_user_id, seed.seeded_at, seed.seeded_at
  FROM seed, new_tenant t, cust br, tech, new_user_admin u
  RETURNING id AS ticket_id
)
, st_upd AS (
  INSERT INTO service_ticket_updates (id, tenant_id, ticket_id, update_type, new_value, notes, updated_by, created_at)
  SELECT gen_random_uuid(), t.tenant_id, s.ticket_id, 'assignment', 'assigned_to_tech', 'Assigned to seed tech', u.admin_user_id, seed.seeded_at
  FROM seed, new_tenant t, st s, new_user_admin u
  RETURNING id
)

-- 8) Invoices (+ line)
, invc AS (
  INSERT INTO invoices (id, tenant_id, customer_id, contract_id, invoice_number, invoice_date, due_date, total_amount, invoice_status, issuance_delay_hours, created_by, created_at, updated_at)
  SELECT gen_random_uuid(), t.tenant_id, br.customer_id, NULL, 'INV-' || to_char(now(),'YYYYMM') || '-001', now() - interval '5 days', now() - interval '1 day', 1250.00, 'open', 48, u.admin_user_id, seed.seeded_at, seed.seeded_at
  FROM seed, new_tenant t, cust br, new_user_admin u
  RETURNING id AS invoice_id
)
, invl AS (
  INSERT INTO invoice_line_items (id, tenant_id, invoice_id, description, quantity, unit_price, amount, line_type, created_at)
  SELECT gen_random_uuid(), t.tenant_id, i.invoice_id, seed.seed_tag || ' Maintenance Plan', 1, 1250.00, 1250.00, 'service', seed.seeded_at
  FROM seed, new_tenant t, invc i
  RETURNING id
)

-- 9) Master Catalog + Tenant enablement
, mp AS (
  INSERT INTO master_product_models (id, manufacturer, model_code, display_name, category, product_type, msrp, specs_json, status, created_at, updated_at)
  SELECT gen_random_uuid(), 'Canon', 'V1000', seed.seed_tag || ' imagePRESS V1000', 'MFP', 'A3 Color', 25000.00, '{"ppm":100}'::jsonb, 'active', now(), now()
  RETURNING id AS master_product_id
)
, tcs AS (
  INSERT INTO tenant_catalog_settings (id, tenant_id, auto_enable_new_products, default_markup_percentage, require_approval_for_enablement, created_at, updated_at)
  SELECT gen_random_uuid(), t.tenant_id, true, 25.00, false, now(), now()
  FROM new_tenant t
  RETURNING id
)
, ep AS (
  INSERT INTO enabled_products (enabled_product_id, tenant_id, master_product_id, enabled, company_price, dealer_cost, enabled_at, updated_at)
  SELECT gen_random_uuid(), t.tenant_id, mp.master_product_id, true, 29999.00, 22000.00, now(), now()
  FROM new_tenant t, mp
  RETURNING enabled_product_id
)

-- 10) Quotes (+ lines)
, q AS (
  INSERT INTO quotes (id, tenant_id, quote_number, title, status, total_amount, valid_until, created_by, created_at, updated_at)
  SELECT gen_random_uuid(), t.tenant_id, 'Q-' || to_char(now(),'YYYYMMDD') || '-001', seed.seed_tag || ' Production Printer', 'sent', 32500.00, now() + interval '14 days', u.sales_user_id, now(), now()
  FROM new_tenant t, new_user_sales u
  RETURNING id AS quote_id
)
, ql AS (
  INSERT INTO quote_line_items (id, tenant_id, quote_id, line_number, product_name, product_description, quantity, unit_price, line_total, created_at)
  SELECT gen_random_uuid(), t.tenant_id, q.quote_id, 1, 'imagePRESS V1000', 'High-volume production printer', 1, 32500.00, 32500.00, now()
  FROM new_tenant t, q
  RETURNING id
)

-- 11) Proposals (+ lines, approvals)
, p AS (
  INSERT INTO proposals (id, tenant_id, proposal_number, version, title, status, total_amount, created_by, created_at, updated_at)
  SELECT gen_random_uuid(), t.tenant_id, 'P-' || to_char(now(),'YYYYMMDD') || '-001', '1.0', seed.seed_tag || ' Production Proposal', 'sent', 34500.00, u.sales_user_id, now(), now()
  FROM new_tenant t, new_user_sales u
  RETURNING id AS proposal_id
)
, pl AS (
  INSERT INTO proposal_line_items (id, tenant_id, proposal_id, line_number, item_type, product_name, description, quantity, unit_price, total_price, created_at)
  SELECT gen_random_uuid(), t.tenant_id, p.proposal_id, 1, 'equipment', 'imagePRESS V1000', 'Main unit', 1, 32500.00, 32500.00, now()
  FROM new_tenant t, p
  UNION ALL
  SELECT gen_random_uuid(), t.tenant_id, p.proposal_id, 2, 'service', 'Install & Training', 'Professional services', 1, 2000.00, 2000.00, now()
  FROM new_tenant t, p
  RETURNING id
)
, pa AS (
  INSERT INTO proposal_approvals (id, tenant_id, proposal_id, approval_level, approver_id, approval_status, requested_date)
  SELECT gen_random_uuid(), t.tenant_id, p.proposal_id, 1, u.admin_user_id, 'pending', now()
  FROM new_tenant t, p, new_user_admin u
  RETURNING id
)

-- 12) Purchase Orders (+ items)
, po AS (
  INSERT INTO purchase_orders (id, tenant_id, po_number, vendor_id, requested_by, order_date, expected_date, description, subtotal, tax_amount, shipping_amount, total_amount, status, created_by, created_at, updated_at)
  SELECT gen_random_uuid(), t.tenant_id, 'PO-' || to_char(now(),'YYYYMMDD') || '-001', v.vendor_id, u.admin_user_id, now(), now() + interval '7 days', seed.seed_tag || ' Restock', 1650.00, 0, 0, 1650.00, 'approved', u.admin_user_id, now(), now()
  FROM new_tenant t, v1 v, new_user_admin u
  RETURNING id AS po_id
)
, poi AS (
  INSERT INTO purchase_order_items (id, tenant_id, purchase_order_id, line_number, item_description, item_code, quantity, unit_price, total_price, created_at)
  SELECT gen_random_uuid(), t.tenant_id, po.po_id, 1, 'Cyan Toner', 'TONER-C-001', 10, 45.00, 450.00, now()
  FROM new_tenant t, po
  UNION ALL
  SELECT gen_random_uuid(), t.tenant_id, po.po_id, 2, 'Drum Unit', 'DRUM-X-010', 10, 120.00, 1200.00, now()
  FROM new_tenant t, po
  RETURNING id
)

-- 13) Tasks & Projects
, proj AS (
  INSERT INTO projects (id, tenant_id, name, description, status, budget, completion_percentage, created_by, created_at)
  SELECT gen_random_uuid(), t.tenant_id, seed.seed_tag || ' Implementation', 'Customer onboarding project', 'active', 5000.00, 25, u.admin_user_id, now()
  FROM new_tenant t, new_user_admin u
  RETURNING id AS project_id
)
, task1 AS (
  INSERT INTO tasks (id, tenant_id, title, description, status, priority, due_date, assigned_to, created_by, project_id, created_at)
  SELECT gen_random_uuid(), t.tenant_id, seed.seed_tag || ' Site Survey', 'Perform physical site survey', 'in_progress', 'high', now() + interval '3 days', u.sales_user_id, u.admin_user_id, p.project_id, now()
  FROM new_tenant t, new_user_admin u, proj p
  RETURNING id
)

-- 14) Forecasting (minimal)
, sf AS (
  INSERT INTO sales_forecasts (id, tenant_id, forecast_name, description, period_start, period_end, forecast_type, status, target_amount, created_by, created_at)
  SELECT gen_random_uuid(), t.tenant_id, seed.seed_tag || ' Q3 Forecast', 'Seed forecast', date_trunc('quarter', now()), date_trunc('quarter', now()) + interval '3 months' - interval '1 day', 'quarterly', 'active', 250000.00, u.sales_user_id, now()
  FROM new_tenant t, new_user_sales u
  RETURNING id AS forecast_id
)
, spi AS (
  INSERT INTO forecast_pipeline_items (id, forecast_id, opportunity_name, stage, amount, weighted_amount, close_probability, expected_close_date, tenant_id, created_at)
  SELECT gen_random_uuid(), sf.forecast_id, seed.seed_tag || ' Production Deal', 'proposal', 60000.00, 42000.00, 70, now() + interval '21 days', t.tenant_id, now()
  FROM sf, new_tenant t
  RETURNING id
)
, sm AS (
  INSERT INTO forecast_metrics (id, forecast_id, metric_type, metric_name, metric_value, target_value, variance_from_target, tenant_id, created_at)
  SELECT gen_random_uuid(), sf.forecast_id, 'coverage', 'Pipeline Coverage', 3.2, 3.0, 0.2, t.tenant_id, now()
  FROM sf, new_tenant t
  RETURNING id
)

-- 15) Onboarding (minimal)
, ob AS (
  INSERT INTO onboarding_checklists (id, tenant_id, customer_id, checklist_title, description, installation_type, status, scheduled_install_date, progress_percentage, total_sections, completed_sections, created_by, created_at)
  SELECT gen_random_uuid(), t.tenant_id, br.customer_id, seed.seed_tag || ' Install Checklist', 'Seed onboarding', 'new_site', 'in_progress', now() + interval '10 days', 10, 5, 1, u.admin_user_id, now()
  FROM new_tenant t, cust br, new_user_admin u
  RETURNING id AS checklist_id
)
, obe AS (
  INSERT INTO onboarding_equipment (id, checklist_id, equipment_type, manufacturer, model, serial_number, installation_location, testing_completed, tenant_id, created_at)
  SELECT gen_random_uuid(), ob.checklist_id, 'printer', 'Canon', 'V1000', 'SN-SEED-001', 'Main Office', false, t.tenant_id, now()
  FROM ob, new_tenant t
  RETURNING id
)

-- 16) Performance & Alerts (baseline for KPI/alerts)
, perf AS (
  INSERT INTO performance_metrics (id, tenant_id, metric_type, value, unit, timestamp)
  SELECT gen_random_uuid(), t.tenant_id, 'response_time', 220, 'ms', now() FROM new_tenant t
  UNION ALL SELECT gen_random_uuid(), t.tenant_id, 'throughput', 1800, 'requests/min', now() FROM new_tenant t
  UNION ALL SELECT gen_random_uuid(), t.tenant_id, 'cpu_usage', 42, '%', now() FROM new_tenant t
  UNION ALL SELECT gen_random_uuid(), t.tenant_id, 'memory_usage', 65, '%', now() FROM new_tenant t
  RETURNING id
)
, alrt AS (
  INSERT INTO system_alerts (id, tenant_id, type, category, message, severity, source, resolved, created_at)
  SELECT gen_random_uuid(), t.tenant_id, 'warning', 'business', seed.seed_tag || ' Low stock detected for supplies', 'medium', 'seed', false, now()
  FROM new_tenant t
  UNION ALL
  SELECT gen_random_uuid(), t.tenant_id, 'error', 'performance', seed.seed_tag || ' Dispatch delay on ticket ST-...-001', 'high', 'seed', false, now()
  FROM new_tenant t
  RETURNING id
)
SELECT 1;

COMMIT;

-- Optional: Cleanup helper (manual) — identify or delete seed rows quickly
-- To list seed rows across common tables:
-- SELECT 'tenants' AS tbl, id, name FROM tenants WHERE name LIKE 'SEED_TEST_%'
-- UNION ALL SELECT 'vendors', id, vendor_name FROM vendors WHERE vendor_name LIKE 'SEED_TEST_%'
-- UNION ALL SELECT 'business_records', id, company_name FROM business_records WHERE company_name LIKE 'SEED_TEST_%'
-- UNION ALL SELECT 'quotes', id, title FROM quotes WHERE title LIKE 'SEED_TEST_%'
-- UNION ALL SELECT 'proposals', id, title FROM proposals WHERE title LIKE 'SEED_TEST_%'
-- UNION ALL SELECT 'projects', id, name FROM projects WHERE name LIKE 'SEED_TEST_%'
-- ORDER BY 1;

-- To delete seed batch (be careful in shared environments):
-- BEGIN;
-- DELETE FROM system_alerts WHERE message LIKE 'SEED_TEST_%';
-- DELETE FROM performance_metrics WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE 'SEED_TEST_%');
-- DELETE FROM onboarding_equipment WHERE id IN (
--   SELECT oe.id FROM onboarding_equipment oe JOIN onboarding_checklists oc ON oc.id = oe.checklist_id WHERE oc.checklist_title LIKE 'SEED_TEST_%'
-- );
-- DELETE FROM onboarding_checklists WHERE checklist_title LIKE 'SEED_TEST_%';
-- DELETE FROM forecast_metrics WHERE forecast_id IN (SELECT id FROM sales_forecasts WHERE forecast_name LIKE 'SEED_TEST_%');
-- DELETE FROM forecast_pipeline_items WHERE forecast_id IN (SELECT id FROM sales_forecasts WHERE forecast_name LIKE 'SEED_TEST_%');
-- DELETE FROM sales_forecasts WHERE forecast_name LIKE 'SEED_TEST_%';
-- DELETE FROM tasks WHERE title LIKE 'SEED_TEST_%';
-- DELETE FROM projects WHERE name LIKE 'SEED_TEST_%';
-- DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE description LIKE 'SEED_TEST_%');
-- DELETE FROM purchase_orders WHERE description LIKE 'SEED_TEST_%';
-- DELETE FROM proposal_approvals WHERE proposal_id IN (SELECT id FROM proposals WHERE title LIKE 'SEED_TEST_%');
-- DELETE FROM proposal_line_items WHERE proposal_id IN (SELECT id FROM proposals WHERE title LIKE 'SEED_TEST_%');
-- DELETE FROM proposals WHERE title LIKE 'SEED_TEST_%';
-- DELETE FROM quote_line_items WHERE quote_id IN (SELECT id FROM quotes WHERE title LIKE 'SEED_TEST_%');
-- DELETE FROM quotes WHERE title LIKE 'SEED_TEST_%';
-- DELETE FROM enabled_products WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE 'SEED_TEST_%');
-- DELETE FROM tenant_catalog_settings WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE 'SEED_TEST_%');
-- DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE 'INV-%');
-- DELETE FROM invoices WHERE created_by IN (SELECT id FROM users WHERE email LIKE 'admin%seed.local');
-- DELETE FROM service_ticket_updates WHERE notes LIKE 'Assigned to seed tech%';
-- DELETE FROM service_tickets WHERE title LIKE 'SEED_TEST_%';
-- DELETE FROM technicians WHERE email LIKE '%@seed.local';
-- DELETE FROM inventory_items WHERE item_description LIKE 'SEED_TEST_%';
-- DELETE FROM vendors WHERE vendor_name LIKE 'SEED_TEST_%';
-- DELETE FROM company_contacts WHERE email LIKE '%@seed.local';
-- DELETE FROM companies WHERE name LIKE 'SEED_TEST_%';
-- DELETE FROM business_records WHERE company_name LIKE 'SEED_TEST_%';
-- DELETE FROM users WHERE email LIKE '%@seed.local';
-- DELETE FROM locations WHERE name LIKE 'SEED_TEST_%';
-- DELETE FROM regions WHERE name LIKE 'SEED_TEST_%';
-- DELETE FROM tenants WHERE name LIKE 'SEED_TEST_%';
-- COMMIT;


