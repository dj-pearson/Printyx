-- ============================================
-- Multi-Tenant RLS Policies
-- ============================================

-- First, ensure the service role can bypass RLS (it should by default)
-- The 'service_role' should be a member of 'supabase_admin' which bypasses RLS

-- Grant necessary permissions to the authenticator role (used by PostgREST)
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT ALL ON TABLE users TO authenticator;
GRANT ALL ON TABLE tasks TO authenticator;
GRANT ALL ON TABLE projects TO authenticator;
GRANT ALL ON TABLE tenants TO authenticator;

-- Grant to authenticated role (regular users)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE projects TO authenticated;
GRANT SELECT ON TABLE tenants TO authenticated;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own tenant users" ON users;
DROP POLICY IF EXISTS "Users can insert own tenant users" ON users;
DROP POLICY IF EXISTS "Users can update own tenant users" ON users;
DROP POLICY IF EXISTS "Service role bypass" ON users;

DROP POLICY IF EXISTS "Users can view own tenant tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tenant tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tenant tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tenant tasks" ON tasks;

DROP POLICY IF EXISTS "Users can view own tenant projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own tenant projects" ON projects;
DROP POLICY IF EXISTS "Users can update own tenant projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own tenant projects" ON projects;

DROP POLICY IF EXISTS "Users can view tenants" ON tenants;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Allow users to view users in their tenant
CREATE POLICY "Users can view own tenant users"
ON users FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to insert users in their tenant
CREATE POLICY "Users can insert own tenant users"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to update users in their tenant
CREATE POLICY "Users can update own tenant users"
ON users FOR UPDATE
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

-- Allow users to view tasks in their tenant
CREATE POLICY "Users can view own tenant tasks"
ON tasks FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to insert tasks in their tenant
CREATE POLICY "Users can insert own tenant tasks"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to update tasks in their tenant
CREATE POLICY "Users can update own tenant tasks"
ON tasks FOR UPDATE
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to delete tasks in their tenant
CREATE POLICY "Users can delete own tenant tasks"
ON tasks FOR DELETE
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Allow users to view projects in their tenant
CREATE POLICY "Users can view own tenant projects"
ON projects FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to insert projects in their tenant
CREATE POLICY "Users can insert own tenant projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to update projects in their tenant
CREATE POLICY "Users can update own tenant projects"
ON projects FOR UPDATE
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- Allow users to delete projects in their tenant
CREATE POLICY "Users can delete own tenant projects"
ON projects FOR DELETE
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- ============================================
-- TENANTS TABLE POLICIES
-- ============================================

-- Allow users to view their own tenant
CREATE POLICY "Users can view tenants"
ON tenants FOR SELECT
TO authenticated
USING (
  id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check RLS is enabled
SELECT 
  schemaname,
  tablename, 
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'tasks', 'projects', 'tenants')
ORDER BY tablename;

-- Check policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'tasks', 'projects', 'tenants')
ORDER BY tablename, policyname;

SELECT '✅ RLS policies applied successfully!' as status;

