-- ============================================================================
-- lead-scoring.sql — RLS on the 6 lead-scoring tables.
--
-- Run order: apply-rls.sql (first time) → lead-scoring-tables.sql (if baseline
-- gaps) → this file.
-- Idempotent.
--
-- Defensive: skips tables that don't exist; emits a NOTICE instead.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'lead_scoring_rules',
    'lead_score_calculations',
    'lead_scoring_factors',
    'bant_qualification_criteria',
    'lead_engagement_tracking',
    'lead_qualification_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist — run lead-scoring-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
