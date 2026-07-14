-- ============================================================================
-- booking-tables.sql — schema + RLS safety net for CRMX-016 public booking.
--
-- Idempotent create for booking_pages + booking_page_bookings, matching
-- shared/booking-schema.ts. The public-booking + booking-pages edge functions
-- use the service-role client (bypasses RLS); tenant RLS below protects any
-- direct authenticated PostgREST reads. The public booking page never queries
-- these tables directly with the anon key — it goes through the edge function.
--
-- Run once:  \i drizzle/rls/booking-tables.sql
-- (apply_tenant_rls comes from drizzle/rls/apply-rls.sql)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS booking_pages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id varchar NOT NULL,
  owner_user_id varchar NOT NULL,
  slug varchar NOT NULL,
  title varchar NOT NULL,
  description text,
  timezone varchar NOT NULL DEFAULT 'America/New_York',
  duration_minutes integer NOT NULL DEFAULT 30,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 0,
  min_notice_minutes integer NOT NULL DEFAULT 240,
  date_range_days integer NOT NULL DEFAULT 30,
  slot_interval_minutes integer NOT NULL DEFAULT 30,
  availability_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  booking_type varchar NOT NULL DEFAULT 'individual',
  team_member_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  calendar_connection_id varchar,
  branding jsonb,
  location varchar,
  confirmation_message text,
  is_active boolean NOT NULL DEFAULT true,
  created_by varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_pages_slug ON booking_pages(slug);
CREATE INDEX IF NOT EXISTS idx_booking_pages_tenant_owner
  ON booking_pages(tenant_id, owner_user_id);

CREATE TABLE IF NOT EXISTS booking_page_bookings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id varchar NOT NULL,
  booking_page_id varchar NOT NULL,
  assigned_user_id varchar NOT NULL,
  invitee_name varchar NOT NULL,
  invitee_email varchar NOT NULL,
  invitee_phone varchar,
  invitee_company varchar,
  invitee_notes text,
  invitee_timezone varchar NOT NULL DEFAULT 'America/New_York',
  start_time timestamp NOT NULL,
  end_time timestamp NOT NULL,
  status varchar NOT NULL DEFAULT 'confirmed',
  calendar_event_id varchar,
  external_event_id varchar,
  business_record_id varchar,
  contact_id varchar,
  activity_id varchar,
  manage_token varchar NOT NULL,
  confirmation_email_sent boolean NOT NULL DEFAULT false,
  cancelled_at timestamp,
  cancel_reason text,
  rescheduled_from_id varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_bookings_manage_token
  ON booking_page_bookings(manage_token);
CREATE INDEX IF NOT EXISTS idx_booking_bookings_page_time
  ON booking_page_bookings(booking_page_id, start_time);
CREATE INDEX IF NOT EXISTS idx_booking_bookings_tenant
  ON booking_page_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_bookings_assigned_time
  ON booking_page_bookings(assigned_user_id, start_time);

-- ─── tenant RLS (service-role bypasses; edge fns use service-role) ──────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['booking_pages', 'booking_page_bookings'];
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
