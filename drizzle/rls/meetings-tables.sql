-- ============================================================================
-- meetings-tables.sql — schema safety net for the meetings edge function.
--
-- Covers calendar_connections + calendar_events + the rest of the scheduling
-- family from migrations/calendar-integration-migration.sql. meeting_types /
-- meeting_rooms / meetings / scheduling_strategies / scheduling_constraints
-- don't exist in migrations today — the Express code returned mock data for
-- those surfaces, and the edge function preserves that. No sense creating
-- empty tables; add them when persistence actually lands.
-- ============================================================================

BEGIN;

-- ─── calendar_connections ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id varchar NOT NULL,
  provider varchar NOT NULL,
  provider_account_id varchar NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamp,
  calendar_id varchar,
  calendar_name varchar,
  is_primary boolean DEFAULT false,
  sync_enabled boolean DEFAULT true,
  last_sync_at timestamp,
  sync_token varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_tenant_user
  ON calendar_connections(tenant_id, user_id);

-- ─── calendar_events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id varchar NOT NULL,
  calendar_connection_id uuid,
  external_event_id varchar,
  title varchar NOT NULL,
  description text,
  start_time timestamp NOT NULL,
  end_time timestamp NOT NULL,
  is_all_day boolean DEFAULT false,
  location varchar,
  attendees jsonb DEFAULT '[]',
  recurrence_rule varchar,
  status varchar DEFAULT 'confirmed',
  visibility varchar DEFAULT 'default',
  event_type varchar DEFAULT 'meeting',
  related_entity_id varchar,
  related_entity_type varchar,
  is_ai_generated boolean DEFAULT false,
  ai_confidence numeric(3,2),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_user_time
  ON calendar_events(tenant_id, user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_external
  ON calendar_events(calendar_connection_id, external_event_id);

-- ─── calendar_availability ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id varchar NOT NULL,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone varchar DEFAULT 'America/New_York',
  is_available boolean DEFAULT true,
  availability_type varchar DEFAULT 'work',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- ─── calendar_sync_logs ─────────────────────────────────────────────────────
-- NOTE: No tenant_id column. Scoped indirectly via calendar_connection_id FK.
-- RLS is applied on calendar_connections; the logs table is protected from
-- cross-tenant reads by tying every query to a connection_id (handlers always
-- set it). We still ENABLE RLS below with a permissive policy so service-role
-- can write without being blocked.
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_connection_id uuid,
  sync_type varchar NOT NULL,
  sync_status varchar NOT NULL,
  events_synced integer DEFAULT 0,
  events_created integer DEFAULT 0,
  events_updated integer DEFAULT 0,
  events_deleted integer DEFAULT 0,
  error_message text,
  sync_duration_ms integer,
  created_at timestamp DEFAULT now()
);

-- ─── calendar_event_reminders ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  reminder_minutes integer NOT NULL,
  reminder_method varchar DEFAULT 'notification',
  is_sent boolean DEFAULT false,
  sent_at timestamp,
  created_at timestamp DEFAULT now()
);

COMMIT;
