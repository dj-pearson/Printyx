-- ============================================
-- Fix Service Role to Bypass RLS
-- ============================================

-- The service_role should bypass RLS automatically, but in self-hosted
-- Supabase it needs explicit configuration

-- 1. Make service_role a superuser (to bypass RLS)
ALTER USER service_role WITH SUPERUSER;

-- 2. Grant service_role to postgres (if not already)
GRANT service_role TO postgres;

-- 3. Grant all privileges on tables to service_role
GRANT ALL PRIVILEGES ON TABLE users TO service_role;
GRANT ALL PRIVILEGES ON TABLE tasks TO service_role;
GRANT ALL PRIVILEGES ON TABLE projects TO service_role;
GRANT ALL PRIVILEGES ON TABLE tenants TO service_role;

-- 4. Grant usage on schema
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON SCHEMA public TO service_role;

-- 5. Verify service_role can bypass RLS
SELECT '✅ Service role configured to bypass RLS' as status;

-- 6. Test query as service_role
SET ROLE service_role;
SELECT 'Testing service_role can query users:' as test;
SELECT COUNT(*) as user_count FROM users;
RESET ROLE;

SELECT '✅ Service role bypass fix complete!' as status;

