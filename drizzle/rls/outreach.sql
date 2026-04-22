-- ============================================================================
-- outreach.sql — RLS policies for the 6 outreach tables.
--
-- Run order: apply-rls.sql (first time only) → this file.
-- Idempotent: re-running refreshes policies.
--
-- Prereq: tables created by migration 0006_certain_jean_grey.sql.
-- ============================================================================

BEGIN;

SELECT apply_tenant_rls('business_contexts');
SELECT apply_tenant_rls('rep_specializations');
SELECT apply_tenant_rls('outreach_sequences');
SELECT apply_tenant_rls('outreach_sequence_steps');
SELECT apply_tenant_rls('outreach_prospects');
SELECT apply_tenant_rls('outreach_drafts');

COMMIT;

-- Verification query — run after to confirm all 6 tables have rowsecurity = true:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN (
--       'business_contexts',
--       'rep_specializations',
--       'outreach_sequences',
--       'outreach_sequence_steps',
--       'outreach_prospects',
--       'outreach_drafts'
--     );
--
-- All rows should show rowsecurity = t.
