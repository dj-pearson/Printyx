-- ============================================================================
-- auth-security.sql — RLS on auth tables.
--
-- Mixed tenant_id column types:
--   - Most tables (mfa_*, api_key_usage_logs, sso_sessions): tenant_id is varchar
--     → canonical apply_tenant_rls() works
--   - sso_provider_configs: tenant_id is uuid (per shared/sso-schema.ts)
--     → requires uuid-casted policies written inline below
--
-- SPECIAL CASE: api_keys rows contain key_hash values that must NOT be
-- readable by the `authenticated` role (only service-role, used by edge
-- functions via the shared service client, gets direct SELECT). We skip
-- apply_tenant_rls for that table and instead REVOKE + ENABLE RLS without
-- policies (deny-by-default).
-- ============================================================================

BEGIN;

-- ─── varchar tenant_id tables — canonical policy ────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'api_key_usage_logs',
    'mfa_enrollments',
    'mfa_otp_tokens',
    'mfa_backup_codes',
    'mfa_audit_logs',
    'sso_sessions'
  ];
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

-- ─── uuid tenant_id table — sso_provider_configs ─────────────────────────────
-- Canonical policy template but with ::uuid cast on the JWT value.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sso_provider_configs'
  ) THEN
    EXECUTE 'ALTER TABLE sso_provider_configs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON sso_provider_configs TO authenticated';

    -- Drop existing policies so this is idempotent.
    EXECUTE 'DROP POLICY IF EXISTS sso_provider_configs_tenant_select ON sso_provider_configs';
    EXECUTE 'DROP POLICY IF EXISTS sso_provider_configs_tenant_insert ON sso_provider_configs';
    EXECUTE 'DROP POLICY IF EXISTS sso_provider_configs_tenant_update ON sso_provider_configs';
    EXECUTE 'DROP POLICY IF EXISTS sso_provider_configs_tenant_delete ON sso_provider_configs';

    EXECUTE $sql$
      CREATE POLICY sso_provider_configs_tenant_select
        ON sso_provider_configs FOR SELECT TO authenticated
        USING (tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenantId')::uuid))
    $sql$;
    EXECUTE $sql$
      CREATE POLICY sso_provider_configs_tenant_insert
        ON sso_provider_configs FOR INSERT TO authenticated
        WITH CHECK (tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenantId')::uuid))
    $sql$;
    EXECUTE $sql$
      CREATE POLICY sso_provider_configs_tenant_update
        ON sso_provider_configs FOR UPDATE TO authenticated
        USING (tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenantId')::uuid))
        WITH CHECK (tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenantId')::uuid))
    $sql$;
    EXECUTE $sql$
      CREATE POLICY sso_provider_configs_tenant_delete
        ON sso_provider_configs FOR DELETE TO authenticated
        USING (tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenantId')::uuid))
    $sql$;

    RAISE NOTICE 'RLS applied to sso_provider_configs (uuid tenant_id)';
  ELSE
    RAISE NOTICE 'SKIP: relation public.sso_provider_configs does not exist';
  END IF;
END $$;

-- ─── Special handling for api_keys ───────────────────────────────────────────
-- RLS on; no grant to authenticated. Only service-role can SELECT/INSERT/UPDATE.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'api_keys'
  ) THEN
    EXECUTE 'ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY';
    -- Drop any pre-existing permissive policies from a prior run of the standard template.
    EXECUTE 'DROP POLICY IF EXISTS api_keys_tenant_select ON api_keys';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_tenant_insert ON api_keys';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_tenant_update ON api_keys';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_tenant_delete ON api_keys';
    -- Deny-by-default for authenticated: no policies = no access under RLS.
    -- Revoke explicit table grants so the only way in is service-role.
    EXECUTE 'REVOKE ALL ON api_keys FROM authenticated';
    EXECUTE 'REVOKE ALL ON api_keys FROM anon';
    RAISE NOTICE 'api_keys: service-role-only access configured';
  ELSE
    RAISE NOTICE 'SKIP: relation public.api_keys does not exist';
  END IF;
END $$;

COMMIT;
