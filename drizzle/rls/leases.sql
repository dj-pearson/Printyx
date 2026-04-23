-- ============================================================================
-- leases.sql — RLS on the 4 lease tables.
--
-- Run order: apply-rls.sql → leases-tables.sql (if baseline gaps) → this file.
-- Idempotent; defensive (skips missing tables, emits NOTICE).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'leases',
    'lease_payments',
    'lease_renewals',
    'lease_dispositions'
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
      RAISE NOTICE 'SKIP: relation public.% does not exist — run leases-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
