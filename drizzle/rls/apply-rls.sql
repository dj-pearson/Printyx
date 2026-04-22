-- ============================================================================
-- apply-rls.sql — defines the apply_tenant_rls(table_name) function.
--
-- Idempotent: drops existing policies with matching names before creating,
-- so you can re-run this on any table to refresh policies after schema changes.
--
-- Usage (from any per-domain file):
--   SELECT apply_tenant_rls('business_contexts');
--   SELECT apply_tenant_rls('outreach_sequences');
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_tenant_rls(target_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  select_policy text := target_table || '_tenant_select';
  insert_policy text := target_table || '_tenant_insert';
  update_policy text := target_table || '_tenant_update';
  delete_policy text := target_table || '_tenant_delete';
BEGIN
  -- Ensure RLS is on
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);

  -- Ensure authenticated role has table-level permissions.
  -- RLS policies ALONE produce 403s — you need GRANT too.
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated',
    target_table
  );

  -- Drop existing policies so this is idempotent
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', select_policy, target_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', insert_policy, target_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', update_policy, target_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', delete_policy, target_table);

  -- SELECT: can read rows whose tenant_id matches the JWT
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR SELECT TO authenticated ' ||
    'USING (tenant_id = (auth.jwt() -> ''app_metadata'' ->> ''tenantId''))',
    select_policy,
    target_table
  );

  -- INSERT: can insert rows whose tenant_id matches the JWT
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR INSERT TO authenticated ' ||
    'WITH CHECK (tenant_id = (auth.jwt() -> ''app_metadata'' ->> ''tenantId''))',
    insert_policy,
    target_table
  );

  -- UPDATE: both USING and WITH CHECK — prevents re-parenting a row to another tenant
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR UPDATE TO authenticated ' ||
    'USING (tenant_id = (auth.jwt() -> ''app_metadata'' ->> ''tenantId'')) ' ||
    'WITH CHECK (tenant_id = (auth.jwt() -> ''app_metadata'' ->> ''tenantId''))',
    update_policy,
    target_table
  );

  -- DELETE: can delete rows whose tenant_id matches the JWT
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR DELETE TO authenticated ' ||
    'USING (tenant_id = (auth.jwt() -> ''app_metadata'' ->> ''tenantId''))',
    delete_policy,
    target_table
  );

  RAISE NOTICE 'RLS applied to %', target_table;
END;
$$;

COMMENT ON FUNCTION apply_tenant_rls(text) IS
  'Apply the canonical 4-policy tenant isolation RLS template to a table. '
  'Idempotent. Assumes the table has a NOT NULL tenant_id text column and '
  'that auth.jwt() returns a Supabase JWT with app_metadata.tenantId set.';
