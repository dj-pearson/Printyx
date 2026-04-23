-- ============================================================================
-- customer-success.sql — RLS on the 5 customer-success tables.
--
-- Run order: apply-rls.sql (first time) → customer-success-tables.sql (if
-- baseline gaps) → this file.
-- Idempotent; defensive (skips missing tables, emits NOTICE).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customer_health_scores',
    'churn_predictions',
    'success_interventions',
    'customer_journeys',
    'renewal_opportunities'
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
      RAISE NOTICE 'SKIP: relation public.% does not exist — run customer-success-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
