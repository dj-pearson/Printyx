-- US-062: Saved views for CRM index pages (deals, leads, contacts, companies)
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS saved_views (
  id varchar PRIMARY KEY DEFAULT (gen_random_uuid())::varchar,
  tenant_id varchar NOT NULL,
  user_id varchar,
  object_type varchar(30) NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  filter_definition jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_config jsonb,
  column_config jsonb,
  board_config jsonb,
  visibility varchar(20) NOT NULL DEFAULT 'private',
  is_default boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_views_tenant_object_idx ON saved_views (tenant_id, object_type);
CREATE INDEX IF NOT EXISTS saved_views_tenant_user_idx ON saved_views (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS saved_view_pins (
  id varchar PRIMARY KEY DEFAULT (gen_random_uuid())::varchar,
  user_id varchar NOT NULL,
  view_id varchar NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_view_pins_user_idx ON saved_view_pins (user_id);
CREATE INDEX IF NOT EXISTS saved_view_pins_user_view_idx ON saved_view_pins (user_id, view_id);
