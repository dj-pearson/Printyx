-- =====================================================
-- Fix: "infinite recursion detected in policy for relation users"
-- =====================================================
-- 002_users_rls_policies.sql created this policy ON public.users:
--
--   CREATE POLICY "Platform admins can read all users" ON users FOR SELECT
--   USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()::text AND ...));
--
-- Evaluating that subquery re-enters RLS on `users`, which evaluates the same
-- policy again -> Postgres aborts with 42P17 "infinite recursion detected in
-- policy for relation \"users\"". Every PostgREST read of /rest/v1/users 500s,
-- including the profile fetch the dashboard does on boot.
--
-- Fix: move the admin lookup into STABLE SECURITY DEFINER helpers. They run as
-- the function owner (the table owner, i.e. postgres), and a table owner is not
-- subject to that table's row-level policies unless FORCE ROW LEVEL SECURITY is
-- set -- it is not set anywhere in this repo. So the helper reads `users`
-- directly, no policy is re-entered, and the recursion is gone.
--
-- If FORCE ROW LEVEL SECURITY is ever enabled on public.users, these helpers
-- start recursing again; grant the owning role BYPASSRLS at that point.
--
-- Run as the users-table owner (postgres), NOT as service_role.
-- =====================================================

-- -----------------------------------------------------
-- Helpers (SECURITY DEFINER: read `users` with RLS off)
-- -----------------------------------------------------
-- search_path is pinned on every SECURITY DEFINER function so a caller cannot
-- shadow `public.users` with a temp table and change what the policy sees.

-- True when the caller is Printyx platform staff (sees every tenant).
CREATE OR REPLACE FUNCTION auth.current_user_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT u.is_platform_user = true
          OR u.role IN ('root_admin', 'platform_admin', 'system_admin')
      FROM public.users u
      WHERE u.id = auth.uid()::text
    ),
    -- Fall back to the JWT claim when there is no matching row (e.g. a platform
    -- user provisioned in GoTrue before the `users` row exists).
    (auth.jwt() -> 'app_metadata' ->> 'isPlatformUser')::boolean,
    false
  )
$$;

-- True when the caller administers their own tenant (sees that tenant only).
CREATE OR REPLACE FUNCTION auth.current_user_is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT u.role IN ('admin', 'company_admin')
      FROM public.users u
      WHERE u.id = auth.uid()::text
    ),
    (auth.jwt() -> 'app_metadata' ->> 'isTenantAdmin')::boolean,
    false
  )
$$;

-- The caller's tenant, read from the row rather than the (possibly stale) JWT.
CREATE OR REPLACE FUNCTION auth.current_user_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid()::text),
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenantId', '')
  )
$$;

-- Policy evaluation runs as the CALLING role, so authenticated needs EXECUTE.
GRANT EXECUTE ON FUNCTION auth.current_user_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.current_user_is_tenant_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.current_user_tenant_id() TO authenticated;

-- -----------------------------------------------------
-- Replace the recursive policy
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Platform admins can read all users" ON users;
DROP POLICY IF EXISTS "Tenant admins can read users in their tenant" ON users;

-- Platform staff: every user, every tenant.
CREATE POLICY "Platform admins can read all users"
ON users
FOR SELECT
TO authenticated
USING (auth.current_user_is_platform_admin());

-- SECURITY CHANGE (deliberate, see the note in the PR/commit): the old policy
-- granted 'admin' and 'company_admin' an UNSCOPED read of every user row in
-- EVERY tenant -- a cross-tenant leak. Tenant admins are now scoped to their
-- own tenant, which is what the 4-tier isolation model in CLAUDE.md requires.
CREATE POLICY "Tenant admins can read users in their tenant"
ON users
FOR SELECT
TO authenticated
USING (
  auth.current_user_is_tenant_admin()
  AND tenant_id IS NOT NULL
  AND tenant_id = auth.current_user_tenant_id()
);

-- Policies 1 (self read), 2 (service_role) and 4 (self update) from
-- 002_users_rls_policies.sql are non-recursive and are left untouched.

-- -----------------------------------------------------
-- Verify
-- -----------------------------------------------------
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;
