-- ============================================================================
-- tasks-collab.sql — RLS on task + team tables.
--
-- Run order: apply-rls.sql → tasks-collab-tables.sql (if baseline gaps) →
-- this file. Idempotent; defensive.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tasks',
    'task_comments',
    'time_entries',
    'teams',
    'projects'
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
      RAISE NOTICE 'SKIP: relation public.% does not exist — run tasks-collab-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
