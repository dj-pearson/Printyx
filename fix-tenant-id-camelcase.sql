-- ============================================
-- Fix tenant_id to use camelCase (tenantId)
-- ============================================

-- Update auth.users to use camelCase tenantId (JavaScript convention)
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{tenantId}',
    to_jsonb(raw_app_meta_data->>'tenant_id')
)
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46'
  AND raw_app_meta_data->>'tenant_id' IS NOT NULL;

-- Verify the fix
SELECT 
  id, 
  email, 
  raw_app_meta_data->>'tenant_id' as tenant_id_snake,
  raw_app_meta_data->>'tenantId' as tenant_id_camel
FROM auth.users 
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

SELECT '✅ tenant_id fixed to camelCase!' as status;

