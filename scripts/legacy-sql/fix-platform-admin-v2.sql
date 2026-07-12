-- ============================================================================
-- FIX PLATFORM ADMIN - Part 2: Fix roles table + RLS
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Insert Platform Admin into the `roles` table (the one the frontend queries)
INSERT INTO public.roles (id, name, code, role_type, department, level, description, permissions, can_access_all_tenants, can_view_system_metrics, can_access_all_locations, can_manage_company_users, can_create_locations, can_view_company_financials, can_manage_regional_users, can_view_regional_reports, can_approve_regional_deals, can_manage_location_users, can_view_location_reports, can_approve_location_deals, can_manage_compliance, can_manage_training, can_manage_hr, can_manage_it, can_view_analytics, can_manage_quality, can_access_audit_logs, can_manage_integrations, can_manage_users, is_system_role)
SELECT
  gen_random_uuid()::text,
  'Platform Administrator',
  'PLATFORM_ADMIN',
  'platform_admin',
  'platform',
  8,
  'Printyx platform administrator with full access',
  '{"sales":true,"service":true,"products":true,"inventory":true,"billing":true,"admin":true,"platform":true,"reports":true,"finance":true,"operations":true,"compliance":true,"hr":true,"it":true,"training":true,"quality":true}'::jsonb,
  true,   -- can_access_all_tenants
  true,   -- can_view_system_metrics
  true,   -- can_access_all_locations
  true,   -- can_manage_company_users
  true,   -- can_create_locations
  true,   -- can_view_company_financials
  true,   -- can_manage_regional_users
  true,   -- can_view_regional_reports
  true,   -- can_approve_regional_deals
  true,   -- can_manage_location_users
  true,   -- can_view_location_reports
  true,   -- can_approve_location_deals
  true,   -- can_manage_compliance
  true,   -- can_manage_training
  true,   -- can_manage_hr
  true,   -- can_manage_it
  true,   -- can_view_analytics
  true,   -- can_manage_quality
  true,   -- can_access_audit_logs
  true,   -- can_manage_integrations
  true,   -- can_manage_users
  true    -- is_system_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE code = 'PLATFORM_ADMIN'
);

-- Step 2: Update your user's role_id to point to the `roles` table entry
UPDATE public.users
SET role_id = (SELECT id FROM public.roles WHERE code = 'PLATFORM_ADMIN' LIMIT 1)
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- Step 3: Enable RLS on roles table and add a policy allowing authenticated users to read
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (safe to ignore errors)
DROP POLICY IF EXISTS "Allow authenticated users to read roles" ON public.roles;

-- Create read policy for all authenticated users
CREATE POLICY "Allow authenticated users to read roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Step 4: Verify
SELECT '--- ROLES TABLE ENTRY ---' as section;
SELECT id, name, code, level, can_access_all_tenants, is_system_role
FROM public.roles
WHERE code = 'PLATFORM_ADMIN';

SELECT '--- USER role_id ---' as section;
SELECT id, email, role_id, role, is_platform_user
FROM public.users
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';
