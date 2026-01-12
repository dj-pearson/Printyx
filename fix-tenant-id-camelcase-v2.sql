-- ============================================
-- Fix tenant_id to use camelCase (tenantId) - Version 2
-- ============================================

-- Update auth.users to add camelCase tenantId (JavaScript convention)
-- This properly copies the value as JSON
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{tenantId}',
    to_jsonb((raw_app_meta_data->>'tenant_id')::text),
    true
)
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- Verify the fix
SELECT 
  'Verification:' as label,
  id, 
  email, 
  raw_app_meta_data->>'tenant_id' as snake_case,
  raw_app_meta_data->>'tenantId' as camel_case
FROM auth.users 
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

SELECT '✅ tenantId (camelCase) fixed!' as status;

