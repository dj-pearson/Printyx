-- ============================================================================
-- lead-assignment.sql — RLS policies for the 5 lead-assignment tables.
--
-- Run order: apply-rls.sql (first time only) → this file.
-- Idempotent: re-running refreshes policies.
--
-- Defensive: skips tables that don't exist in the current DB and emits a
-- NOTICE. The 5 tables are declared in `shared/lead-assignment-schema.ts`
-- and in migration 0000_fuzzy_blizzard.sql, but some DB baselines were
-- initialized without actually running 0000's DDL. If you see skip notices
-- here, run:
--
--   \i drizzle/rls/lead-assignment-tables.sql
--
-- which creates any missing tables (created just below this file).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sales_territories',
    'lead_assignment_rules',
    'rep_capacity',
    'lead_assignment_history',
    'lead_assignment_queue'
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
      RAISE NOTICE 'SKIP: relation public.% does not exist — run lead-assignment-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Verification:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN (
--       'sales_territories',
--       'lead_assignment_rules',
--       'rep_capacity',
--       'lead_assignment_history',
--       'lead_assignment_queue'
--     );
--
-- All rows should show rowsecurity = t. Any table missing from the result
-- means it wasn't created by the baseline; see lead-assignment-tables.sql.
