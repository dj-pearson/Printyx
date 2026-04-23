-- ============================================================================
-- platform-integrations.sql — RLS policies for integrations + webhooks tables.
--
-- Run order: apply-rls.sql (first time only) → this file.
-- Idempotent: re-running refreshes policies.
--
-- Prereq: tables created by migration 0007_loose_charles_xavier.sql.
--
-- All 5 tables have tenant_id NOT NULL so the canonical 4-policy template
-- applies cleanly. webhook_logs.tenant_id is denormalized from webhooks.tenant_id
-- on insert (the webhook edge function does this).
-- ============================================================================

BEGIN;

SELECT apply_tenant_rls('platform_integrations');
SELECT apply_tenant_rls('integration_webhooks');
SELECT apply_tenant_rls('integration_sync_logs');
SELECT apply_tenant_rls('webhooks');
SELECT apply_tenant_rls('webhook_logs');

COMMIT;

-- Verification query:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN (
--       'platform_integrations',
--       'integration_webhooks',
--       'integration_sync_logs',
--       'webhooks',
--       'webhook_logs'
--     );
--
-- All rows should show rowsecurity = t.
