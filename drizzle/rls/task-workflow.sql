-- ============================================================================
-- task-workflow.sql — RLS on the Task Workflow module tables (TWF-###).
--
-- Run order:
--   1. apply-rls.sql (first time, installs apply_tenant_rls function)
--   2. drizzle/migrations/00XX_*.sql for task_workflow tables
--   3. this file
--
-- Idempotent; defensive (skips missing tables, emits NOTICE).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'task_workflows',
    'task_workflow_steps',
    'task_workflow_events'
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
      RAISE NOTICE 'SKIP: relation public.% does not exist — run the task workflow migration first', t;
    END IF;
  END LOOP;
END $$;

-- Append-only enforcement for task_workflow_events (the activity/audit log).
-- apply_tenant_rls() applies SELECT/INSERT/UPDATE/DELETE policies; for the event
-- log we keep INSERT + SELECT only so history cannot be rewritten by tenant users.
-- The service role bypasses RLS, so the engine can still write events.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_workflow_events'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "task_workflow_events_tenant_update" ON task_workflow_events';
    EXECUTE 'DROP POLICY IF EXISTS "task_workflow_events_tenant_delete" ON task_workflow_events';
    EXECUTE 'REVOKE UPDATE, DELETE ON task_workflow_events FROM authenticated';
    RAISE NOTICE 'task_workflow_events is now append-only for the authenticated role';
  END IF;
END $$;

COMMIT;
