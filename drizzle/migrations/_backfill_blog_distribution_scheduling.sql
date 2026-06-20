-- US-BLOG-052/053/054: distribution scheduling — UTM template, optimal-time
-- defaults, re-share cadence config + per-row cadence metadata.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_distribution_scheduling.sql
--
-- After creating the table, apply RLS:
--   psql "$DATABASE_URL" -f drizzle/rls/blog.sql

CREATE TABLE IF NOT EXISTS "blog_distribution_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL UNIQUE,
	"utm_template" jsonb,
	"optimal_time_defaults" jsonb,
	"cadence_config" jsonb,
	"cadence_min_engagement" integer NOT NULL DEFAULT 0,
	"short_link_provider" varchar(32),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_distribution_settings_tenant_idx"
	ON "blog_distribution_settings" USING btree ("tenant_id");

ALTER TABLE "blog_distributions" ADD COLUMN IF NOT EXISTS "reshare_cadence" jsonb;
