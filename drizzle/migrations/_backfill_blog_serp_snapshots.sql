-- US-BLOG-015: cached SERP fetches for strategy work.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_serp_snapshots.sql

CREATE TABLE IF NOT EXISTS "blog_serp_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"keyword" varchar(500) NOT NULL,
	"location_code" integer NOT NULL DEFAULT 2840,
	"language_code" varchar(16) NOT NULL DEFAULT 'en',
	"organic_results" jsonb NOT NULL,
	"serp_features" jsonb,
	"aggregate" jsonb,
	"source_adapter" varchar(32) NOT NULL DEFAULT 'dataforseo',
	"fetched_at" timestamp NOT NULL DEFAULT now(),
	"cost_cents" integer NOT NULL DEFAULT 0,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_serp_snapshots_tenant_idx" ON "blog_serp_snapshots" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_serp_snapshots_tenant_keyword_idx" ON "blog_serp_snapshots" USING btree ("tenant_id","keyword","fetched_at");
