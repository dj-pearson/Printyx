-- ============================================================================
-- manufacturer-orders.sql — RLS on the 6 manufacturer-orders tables.
--
-- Run order: apply-rls.sql → manufacturer-orders-tables.sql (if baseline gaps)
-- → this file. Idempotent; defensive.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'manufacturer_connections',
    'manufacturer_orders',
    'manufacturer_order_line_items',
    'manufacturer_order_confirmations',
    'manufacturer_order_shipments',
    'manufacturer_order_exceptions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist — run manufacturer-orders-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
