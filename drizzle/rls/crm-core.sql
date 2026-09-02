-- ============================================================================
-- crm-core.sql — RLS on the CRM tables the browser can reach (WF-S-07).
--
-- WHY THESE FIVE. `companies` and `business_records` are the account and lead
-- tables, and neither appeared in ANY policy file: they were isolated by an
-- `.eq('tenant_id', tenantId)` written in application code and by nothing else.
-- Contacts.tsx read `companies`, `company_contacts` and `users` straight from the
-- browser with the anon-key client, so the only thing standing between one tenant
-- and another's account list was a filter the CALLER supplies. WF-S-07 moved that
-- page onto the server; these policies are the backstop for the next one, and for
-- anything holding a valid tenant JWT and a copy of curl.
--
-- `deals` is here for the same reason `business_records` is - it is the third leg
-- of the CRM core and carries pricing - and `users` because a tenant's staff
-- directory is not public to other tenants.
--
-- WHAT THIS DOES NOT PROTECT, stated so the coverage is not overread: every edge
-- function uses the service-role client, which holds BYPASSRLS (see
-- service-role.sql). RLS therefore constrains DIRECT client reads only. It is a
-- backstop against a missing tenant filter reached through PostgREST, not a
-- second check on the API - the API's isolation is still the tenant_id filter in
-- each handler, and CR-010 tracks the x-tenant-id header override separately.
--
-- Run order: apply-rls.sql (first time) -> this file. Idempotent.
--
-- Defensive: skips a table that does not exist and emits a NOTICE, matching the
-- other domain files.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'companies',
    'business_records',
    'company_contacts',
    'deals',
    'users'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'crm-core.sql: skipping % (table does not exist)', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
