-- Debug: Check current state of everything

-- 1. What's in the roles table for PLATFORM_ADMIN?
SELECT id, name, code, level, can_access_all_tenants, is_system_role
FROM public.roles WHERE code = 'PLATFORM_ADMIN';

-- 2. What role_id does your user have, and does it match?
SELECT id, email, role_id, role, is_platform_user, access_scope
FROM public.users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- 3. Check RLS status on the roles table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'roles';

-- 4. List all RLS policies on the roles table
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'roles';

-- 5. Check if the user's role_id matches an entry in the roles table
SELECT u.email, u.role_id, r.id as roles_id, r.name, r.level, r.can_access_all_tenants
FROM public.users u
LEFT JOIN public.roles r ON u.role_id = r.id
WHERE u.id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- 6. Check auth.users metadata
SELECT id, email, raw_app_meta_data
FROM auth.users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';
