-- ============================================================================
-- field-service-tables.sql — create any missing field-service tables.
--
-- 12 tables exist in migration 0000 for this domain. Several PRD-listed tables
-- don't exist (technician_etas, geofence_dwell_sessions, mileage_rates,
-- irs_mileage_log). Endpoints that need those get stub handlers.
--
-- Table-name aliases:
--   "technician_routes" (PRD) → "route_assignments" (actual)
--   "mileage_records"  (PRD) → "technician_mileage" (actual)
--   "mileage_vehicles" (PRD) → "vehicle_assignments" (actual)
-- ============================================================================

BEGIN;

-- All these tables are already in migration 0000; we just issue idempotent
-- CREATEs + a few ALTER COLUMN IF NOT EXISTS for schema drift.

-- (CREATE TABLE bodies intentionally omitted — migration 0000 is authoritative.
-- If a fresh DB needs full DDL, apply 0000 first. This file only patches drift.)

-- Ensure technician_locations has the columns the handler writes.
ALTER TABLE IF EXISTS "technician_locations" ADD COLUMN IF NOT EXISTS "city" varchar;
ALTER TABLE IF EXISTS "technician_locations" ADD COLUMN IF NOT EXISTS "state" varchar;
ALTER TABLE IF EXISTS "technician_locations" ADD COLUMN IF NOT EXISTS "zip_code" varchar;

COMMIT;
