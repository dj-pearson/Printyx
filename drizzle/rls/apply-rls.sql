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
  tenant_col_type text;
  jwt_expr text;
BEGIN
  -- Introspect tenant_id column type — some tables use varchar/text, others use uuid.
  -- The JWT value comes out as text, so uuid-typed columns need an explicit cast
  -- to avoid "operator does not exist: uuid = text" errors at runtime.
  SELECT data_type INTO tenant_col_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = target_table
     AND column_name = 'tenant_id';

  IF tenant_col_type IS NULL THEN
    RAISE EXCEPTION 'apply_tenant_rls(%): tenant_id column not found', target_table;
  END IF;

  IF tenant_col_type = 'uuid' THEN
    jwt_expr := '((auth.jwt() -> ''app_metadata'' ->> ''tenantId'')::uuid)';
  ELSE
    jwt_expr := '(auth.jwt() -> ''app_metadata'' ->> ''tenantId'')';
  END IF;

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

  -- SELECT
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (tenant_id = %s)',
    select_policy, target_table, jwt_expr
  );

  -- INSERT
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (tenant_id = %s)',
    insert_policy, target_table, jwt_expr
  );

  -- UPDATE — USING + WITH CHECK prevents re-parenting to another tenant
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (tenant_id = %s) WITH CHECK (tenant_id = %s)',
    update_policy, target_table, jwt_expr, jwt_expr
  );

  -- DELETE
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (tenant_id = %s)',
    delete_policy, target_table, jwt_expr
  );

  RAISE NOTICE 'RLS applied to % (tenant_id: %)', target_table, tenant_col_type;
END;
$$;

COMMENT ON FUNCTION apply_tenant_rls(text) IS
  'Apply the canonical 4-policy tenant isolation RLS template to a table. '
  'Idempotent. Assumes the table has a NOT NULL tenant_id text column and '
  'that auth.jwt() returns a Supabase JWT with app_metadata.tenantId set.';
