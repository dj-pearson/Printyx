-- ============================================================
-- RLS Policies Migration for Printyx Multi-Tenant Architecture
-- ============================================================
-- This migration enables Row Level Security (RLS) on tenant-aware
-- tables and creates policies for automatic tenant isolation.
--
-- Handles both UUID and VARCHAR tenant_id column types.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to extract tenant_id from JWT app_metadata as TEXT
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'tenantId',
    ''
  )
$$;

-- Function to extract tenant_id as UUID (for tables with uuid columns)
CREATE OR REPLACE FUNCTION auth.tenant_id_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN auth.jwt() -> 'app_metadata' ->> 'tenantId' IS NULL THEN NULL
    WHEN auth.jwt() -> 'app_metadata' ->> 'tenantId' = '' THEN NULL
    ELSE (auth.jwt() -> 'app_metadata' ->> 'tenantId')::uuid
  END
$$;

-- Function to extract user_id from JWT
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.uid(),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
$$;

-- Function to extract access_scope from JWT app_metadata
CREATE OR REPLACE FUNCTION auth.access_scope()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'accessScope',
    'own'
  )
$$;

-- Function to check if user is a platform admin
CREATE OR REPLACE FUNCTION auth.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'isPlatformUser')::boolean,
    false
  )
$$;

-- Function to extract role_id from JWT app_metadata
CREATE OR REPLACE FUNCTION auth.role_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'roleId',
    ''
  )
$$;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.tenant_id_uuid() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.access_scope() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.role_id() TO authenticated;

GRANT USAGE ON SCHEMA auth TO anon;

-- ============================================================
-- DYNAMIC RLS POLICY CREATION
-- ============================================================
-- Detects column type and uses appropriate comparison

DO $$
DECLARE
  tbl RECORD;
  policy_name TEXT;
  col_type TEXT;
  policy_expr TEXT;
BEGIN
  -- Loop through all tables with tenant_id column
  FOR tbl IN
    SELECT DISTINCT
      c.relname as table_name,
      format_type(a.atttypid, a.atttypmod) as data_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'tenant_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.table_name);

    policy_name := 'tenant_isolation_' || tbl.table_name;

    -- Drop existing policy
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, tbl.table_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Determine the correct comparison based on column type
    IF tbl.data_type LIKE '%uuid%' THEN
      -- UUID column - use uuid function
      policy_expr := format(
        'CREATE POLICY %I ON %I FOR ALL USING (tenant_id = auth.tenant_id_uuid() OR auth.is_platform_admin())',
        policy_name, tbl.table_name
      );
    ELSE
      -- VARCHAR/TEXT column - use text function
      policy_expr := format(
        'CREATE POLICY %I ON %I FOR ALL USING (tenant_id = auth.tenant_id() OR auth.is_platform_admin())',
        policy_name, tbl.table_name
      );
    END IF;

    EXECUTE policy_expr;
    RAISE NOTICE 'Created RLS policy for % (type: %)', tbl.table_name, tbl.data_type;
  END LOOP;
END $$;

-- ============================================================
-- SPECIAL CASE: tenants TABLE (uses id, not tenant_id)
-- ============================================================

DO $$
DECLARE
  col_type TEXT;
BEGIN
  -- Check if tenants table exists and get id column type
  SELECT format_type(a.atttypid, a.atttypmod) INTO col_type
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'tenants'
    AND a.attname = 'id'
    AND a.attnum > 0;

  IF col_type IS NOT NULL THEN
    ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;

    IF col_type LIKE '%uuid%' THEN
      CREATE POLICY tenant_isolation_tenants ON tenants
        FOR ALL USING (id = auth.tenant_id_uuid() OR auth.is_platform_admin());
    ELSE
      CREATE POLICY tenant_isolation_tenants ON tenants
        FOR ALL USING (id = auth.tenant_id() OR auth.is_platform_admin());
    END IF;

    RAISE NOTICE 'Created RLS policy for tenants (id type: %)', col_type;
  END IF;
END $$;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION auth.tenant_id() IS 'Extracts tenantId from JWT as TEXT (for varchar columns)';
COMMENT ON FUNCTION auth.tenant_id_uuid() IS 'Extracts tenantId from JWT as UUID (for uuid columns)';
COMMENT ON FUNCTION auth.user_id() IS 'Returns the authenticated user ID from JWT';
COMMENT ON FUNCTION auth.access_scope() IS 'Returns the user access scope';
COMMENT ON FUNCTION auth.is_platform_admin() IS 'Returns true if user is a platform administrator';
COMMENT ON FUNCTION auth.role_id() IS 'Returns the user role ID from JWT as TEXT';
