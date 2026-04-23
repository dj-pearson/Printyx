-- ============================================================================
-- email-marketing.sql — RLS on the 7 email-marketing tables.
--
-- Run order: apply-rls.sql (first time) → email-marketing-tables.sql (if
-- baseline gaps) → this file.
-- Idempotent.
--
-- Defensive: skips tables that don't exist; emits a NOTICE instead.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'email_templates',
    'email_campaigns',
    'email_sends',
    'email_events',
    'email_lists',
    'email_list_members',
    'email_unsubscribes'
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
      RAISE NOTICE 'SKIP: relation public.% does not exist — run email-marketing-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
