-- ============================================================================
-- ai-employee.sql — RLS on AI-employee tables.
--
-- All tenant_id columns in ai_employee* are uuid. The canonical
-- apply_tenant_rls() helper auto-detects the column type (see
-- drizzle/rls/apply-rls.sql), so we can hand it the table name and move on.
--
-- Depends on: drizzle/rls/apply-rls.sql + ai-employee-tables.sql.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ai_employees',
    'ai_employee_tasks',
    'ai_employee_workflows',
    'ai_workflow_executions',
    'ai_employee_skills',
    'ai_employee_interactions',
    'ai_employee_training',
    'ai_employee_analytics'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
