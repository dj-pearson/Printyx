-- ============================================
-- Fix Database Schema and User Tenant
-- ============================================

-- 1. Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id varchar NOT NULL,
    title varchar NOT NULL,
    description text,
    status varchar DEFAULT 'todo' NOT NULL,
    priority varchar DEFAULT 'medium' NOT NULL,
    assigned_to varchar,
    project_id varchar,
    due_date timestamp,
    completion_percentage integer DEFAULT 0,
    tags text[],
    created_by varchar NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- 2. Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id varchar NOT NULL,
    name varchar NOT NULL,
    description text,
    status varchar DEFAULT 'active' NOT NULL,
    start_date timestamp,
    end_date timestamp,
    budget numeric(10, 2),
    created_by varchar NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- 3. Create users table
CREATE TABLE IF NOT EXISTS users (
    id varchar PRIMARY KEY,
    tenant_id varchar NOT NULL,
    email varchar UNIQUE NOT NULL,
    first_name varchar,
    last_name varchar,
    role_id varchar,
    team_id varchar,
    is_active boolean DEFAULT true,
    profile_image_url text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- 4. Create tenants table (needed for multi-tenancy)
CREATE TABLE IF NOT EXISTS tenants (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name varchar NOT NULL,
    slug varchar UNIQUE NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- 5. Create a default tenant
INSERT INTO tenants (id, name, slug)
VALUES ('default-tenant-001', 'Default Organization', 'default')
ON CONFLICT (slug) DO NOTHING;

-- 6. Create user record with tenant_id
INSERT INTO users (id, tenant_id, email, first_name, last_name, is_active)
VALUES (
    'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46',
    'default-tenant-001',
    'your-email@example.com',
    'Your',
    'Name',
    true
)
ON CONFLICT (id) DO UPDATE SET
    tenant_id = 'default-tenant-001',
    updated_at = now();

-- 7. Update auth.users app_metadata with tenant_id
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{tenant_id}',
    '"default-tenant-001"'
)
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- Verify everything (output will show in console)
SELECT 'Tenant created:' as verification;
SELECT id, name, slug FROM tenants;

SELECT 'User record created:' as verification;
SELECT id, tenant_id, email, first_name, last_name FROM users WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

SELECT 'Auth metadata updated:' as verification;
SELECT id, email, raw_app_meta_data->>'tenant_id' as tenant_id 
FROM auth.users 
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

SELECT '✅ Database fix complete!' as status;

