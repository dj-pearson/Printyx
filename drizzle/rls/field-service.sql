-- ============================================================================
-- field-service.sql — RLS on field-service tables.
--
-- 12 tables. Defensive — skips missing.
--
-- NOTE: if/when Realtime subscription for technician_locations lands (Phase 6
-- US-027), add this separately:
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_locations;
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'installations',
    'installation_checklists',
    'service_signatures',
    'technician_locations',
    'location_history',
    'geofences',
    'geofence_events',
    'geofence_alert_rules',
    'geofence_alerts',
    'geofence_alert_subscriptions',
    'route_assignments',
    'route_deviations',
    'technician_mileage',
    'mileage_reports',
    'vehicle_assignments'
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
