-- =====================================================
-- RLS Policies for Users Table
-- Allow users to read their own user record
-- =====================================================

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Platform admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Policy 1: Users can read their own user record
-- This allows the frontend to fetch the user's profile
CREATE POLICY "Users can read their own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = id
);

-- Policy 2: Service role can read all users (for backend operations)
CREATE POLICY "Service role can read all users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 3: Platform admins can read all users
-- Check if user has admin role in their own record
CREATE POLICY "Platform admins can read all users"
ON users
FOR SELECT
TO authenticated
USING (
  -- Allow if user is marked as platform user
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()::text
    AND (
      u.is_platform_user = true
      OR u.role IN ('admin', 'root_admin', 'platform_admin', 'company_admin', 'system_admin')
    )
  )
);

-- Policy 4: Users can update their own basic profile data
-- Note: Security-critical fields (role, role_id, is_platform_user, tenant_id) 
-- should be protected by application logic or separate admin-only policies
CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

-- Grant SELECT permission to authenticated users
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON users TO service_role;
GRANT UPDATE ON users TO authenticated;

-- Create index for faster policy checks
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(id);
CREATE INDEX IF NOT EXISTS idx_users_platform_check ON users(is_platform_user, role) WHERE is_platform_user = true OR role IN ('admin', 'root_admin', 'platform_admin');

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
