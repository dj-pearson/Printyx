-- US-SUPER-008: Deal desk copilot — per-tenant GP floor setting.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_deal_desk_copilot.sql

CREATE TABLE IF NOT EXISTS "deal_desk_copilot_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"gp_floor_pct" double precision NOT NULL DEFAULT 30,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);
