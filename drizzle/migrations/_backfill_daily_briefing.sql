-- US-SUPER-015: Daily role-based morning briefings — per-user prefs + send log.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_daily_briefing.sql

CREATE TABLE IF NOT EXISTS "daily_briefing_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"frequency" varchar(12) NOT NULL DEFAULT 'daily',
	"role" varchar(24),
	"email_enabled" boolean NOT NULL DEFAULT true,
	"in_app_enabled" boolean NOT NULL DEFAULT true,
	"ab_variant" varchar(12) NOT NULL DEFAULT 'numbers',
	"last_sent_at" timestamp,
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "daily_briefing_preferences_tenant_user_uq"
	ON "daily_briefing_preferences" USING btree ("tenant_id","user_id");

CREATE TABLE IF NOT EXISTS "daily_briefing_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(24) NOT NULL,
	"briefing_date" varchar(10) NOT NULL,
	"variant" varchar(12) NOT NULL DEFAULT 'numbers',
	"subject" varchar(300),
	"email_sent" boolean NOT NULL DEFAULT false,
	"in_app_sent" boolean NOT NULL DEFAULT false,
	"content" jsonb,
	"sent_at" timestamp NOT NULL DEFAULT now(),
	"opened_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "daily_briefing_log_tenant_idx"
	ON "daily_briefing_log" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "daily_briefing_log_tenant_user_date_idx"
	ON "daily_briefing_log" USING btree ("tenant_id","user_id","briefing_date");
CREATE INDEX IF NOT EXISTS "daily_briefing_log_tenant_variant_idx"
	ON "daily_briefing_log" USING btree ("tenant_id","variant");
