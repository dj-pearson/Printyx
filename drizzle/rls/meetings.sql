-- ============================================================================
-- meetings.sql — RLS on calendar + scheduling tables.
--
-- Depends on: drizzle/rls/apply-rls.sql + meetings-tables.sql.
--
-- calendar_sync_logs and calendar_event_reminders don't have tenant_id columns
-- — they're tenant-scoped transitively via their FK to calendar_connections /
-- calendar_events. The handlers use service-role via getDb(), which bypasses
-- RLS, so we disable RLS on those and deny direct access to authenticated
-- callers. Same deny-by-default pattern used by api_keys in Phase 5 US-021.
-- ============================================================================

BEGIN;

-- ─── tenant-isolated tables ────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'calendar_connections',
    'calendar_events',
    'calendar_availability'
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

-- ─── deny-by-default for no-tenant-id tables ───────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_sync_logs'
  ) THEN
    EXECUTE 'ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON calendar_sync_logs FROM authenticated';
    EXECUTE 'REVOKE ALL ON calendar_sync_logs FROM anon';
    RAISE NOTICE 'calendar_sync_logs: service-role-only access configured';
  ELSE
    RAISE NOTICE 'SKIP: relation public.calendar_sync_logs does not exist';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_event_reminders'
  ) THEN
    EXECUTE 'ALTER TABLE calendar_event_reminders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON calendar_event_reminders FROM authenticated';
    EXECUTE 'REVOKE ALL ON calendar_event_reminders FROM anon';
    RAISE NOTICE 'calendar_event_reminders: service-role-only access configured';
  ELSE
    RAISE NOTICE 'SKIP: relation public.calendar_event_reminders does not exist';
  END IF;
END $$;

COMMIT;
