-- ============================================================================
-- FIX PLATFORM ADMIN SETUP
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_platform_user boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS access_scope varchar(20) DEFAULT 'location';

-- Step 2: Add missing columns to enhanced_roles table
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS organizational_unit_id varchar;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS parent_role_id varchar;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS lft integer DEFAULT 0;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS rght integer DEFAULT 0;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS depth integer DEFAULT 0;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS functional_area varchar(50);
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS is_system_role boolean DEFAULT false;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS is_customizable boolean DEFAULT true;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS max_direct_reports integer;
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS territory_scope varchar(50);
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS created_by varchar DEFAULT 'system';
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
ALTER TABLE public.enhanced_roles ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Step 3: Ensure user_role_assignments table exists
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL,
  role_id varchar NOT NULL,
  tenant_id varchar NOT NULL,
  organizational_unit_id varchar,
  assigned_by varchar NOT NULL,
  assignment_reason text,
  effective_from timestamp DEFAULT now(),
  effective_until timestamp,
  territory_restrictions jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Step 4: Insert Platform Admin role if it doesn't already exist
INSERT INTO public.enhanced_roles (id, tenant_id, name, code, description, hierarchy_level, organizational_tier, department, is_system_role, created_by)
SELECT gen_random_uuid()::text, 'system', 'Platform Administrator', 'PLATFORM_ADMIN', 'Printyx platform administrator with cross-tenant access', 'level_8', 'platform', 'platform', true, 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM public.enhanced_roles WHERE code = 'PLATFORM_ADMIN'
);

-- Update nested-set and template fields on the role
UPDATE public.enhanced_roles
SET lft = 1, rght = 2, depth = 0, is_template = true, is_system_role = true
WHERE code = 'PLATFORM_ADMIN';

-- Step 5: Update your user record with platform admin privileges
UPDATE public.users
SET is_platform_user = true,
    role = 'platform_admin',
    access_scope = 'platform',
    role_id = (SELECT id FROM public.enhanced_roles WHERE code = 'PLATFORM_ADMIN' LIMIT 1)
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- Step 6: Insert role assignment (skip if already exists)
INSERT INTO public.user_role_assignments (id, user_id, role_id, tenant_id, assigned_by, assignment_reason, is_active)
SELECT
  gen_random_uuid()::text,
  'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46',
  (SELECT id FROM public.enhanced_roles WHERE code = 'PLATFORM_ADMIN' LIMIT 1),
  '550e8400-e29b-41d4-a716-446655440000',
  'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46',
  'Initial platform admin setup',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_role_assignments
  WHERE user_id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46'
    AND role_id = (SELECT id FROM public.enhanced_roles WHERE code = 'PLATFORM_ADMIN' LIMIT 1)
);

-- Step 7: Update Supabase auth.users metadata for JWT claims
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"isPlatformUser": true}'::jsonb
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- Step 8: Verify the setup
SELECT '--- USER RECORD ---' as section;
SELECT id, email, first_name, last_name, role, role_id, is_platform_user, access_scope, is_active
FROM public.users
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

SELECT '--- ROLE ASSIGNMENT ---' as section;
SELECT ura.id, ura.user_id, ura.role_id, er.name as role_name, er.code as role_code, er.hierarchy_level, ura.is_active
FROM public.user_role_assignments ura
JOIN public.enhanced_roles er ON er.id = ura.role_id
WHERE ura.user_id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

SELECT '--- PLATFORM ADMIN ROLE ---' as section;
SELECT id, name, code, hierarchy_level, organizational_tier
FROM public.enhanced_roles
WHERE code = 'PLATFORM_ADMIN';
