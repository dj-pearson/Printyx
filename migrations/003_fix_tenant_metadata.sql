-- Fix User Tenant Metadata
-- Updates user's JWT metadata to use the correct UUID tenant ID
-- Run this before logging out and back in

BEGIN;

-- Update your user's metadata to use the new UUID tenant
-- Replace the user ID if different
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{tenant_id}',
      '"550e8400-e29b-41d4-a716-446655440000"'::jsonb
    ),
    '{tenantId}',
    '"550e8400-e29b-41d4-a716-446655440000"'::jsonb
  ),
  raw_user_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{tenant_id}',
      '"550e8400-e29b-41d4-a716-446655440000"'::jsonb
    ),
    '{tenantId}',
    '"550e8400-e29b-41d4-a716-446655440000"'::jsonb
  )
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

-- Verify the update
SELECT 
  id, 
  email, 
  raw_app_meta_data->>'tenant_id' as app_tenant_id,
  raw_app_meta_data->>'tenantId' as app_tenantId,
  raw_user_meta_data->>'tenant_id' as user_tenant_id,
  raw_user_meta_data->>'tenantId' as user_tenantId
FROM auth.users
WHERE id = 'e1d7f9b5-57f0-4e04-8376-d3cd71e65b46';

COMMIT;

-- Instructions:
-- 1. Run this SQL
-- 2. Rebuild frontend: cd client && npm run build
-- 3. Deploy frontend
-- 4. Go to Settings → Security tab
-- 5. Click "Sign Out" button
-- 6. Clear browser cache (Ctrl+Shift+R)
-- 7. Log back in
-- 8. Try creating a customer again
