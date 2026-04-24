-- ============================================================================
-- admin.sql — RLS on the Phase 6 US-024 admin-slice tables.
--
-- audit_logs + user_settings use canonical apply_tenant_rls.
-- feature_flags has no tenant_id; service-role (edge functions) can access it,
-- authenticated role denied — same deny-by-default pattern as api_keys from
-- Phase 5 US-021.
--
-- Depends on: drizzle/rls/apply-rls.sql + admin-tables.sql.
-- ============================================================================

BEGIN;

-- ─── tenant-isolated tables ───────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['audit_logs', 'user_settings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist', t;
    END IF;
  END LOOP;
END $$;

-- ─── feature_flags — service-role-only (cross-tenant table) ───────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'feature_flags'
  ) THEN
    EXECUTE 'ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY';
    -- Allow authenticated to READ flags (needed by frontend to check gates
    -- without round-tripping through the edge function on every render).
    -- Writes stay service-role only.
    EXECUTE 'GRANT SELECT ON feature_flags TO authenticated';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON feature_flags FROM authenticated';
    EXECUTE 'REVOKE ALL ON feature_flags FROM anon';
    EXECUTE 'DROP POLICY IF EXISTS feature_flags_read_all ON feature_flags';
    EXECUTE $sql$
      CREATE POLICY feature_flags_read_all
        ON feature_flags FOR SELECT TO authenticated
        USING (true)
    $sql$;
    RAISE NOTICE 'feature_flags: read-all for authenticated, writes service-role-only';
  ELSE
    RAISE NOTICE 'SKIP: relation public.feature_flags does not exist';
  END IF;
END $$;

COMMIT;
