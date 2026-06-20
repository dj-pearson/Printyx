-- US-BLOG-041: predicted rank + traffic forecast pre-publish (calibrated post-publish).
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_rank_forecasts.sql

ALTER TABLE "blog_agent_settings"
  ADD COLUMN IF NOT EXISTS "domain_authority" integer;

CREATE TABLE IF NOT EXISTS "blog_rank_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"keyword" varchar(500),
	"search_volume" integer,
	"keyword_difficulty" integer,
	"domain_authority" integer,
	"quality_score" numeric(5,2),
	"serp_competitiveness" numeric(5,2),
	"predicted_rank_low" integer,
	"predicted_rank_high" integer,
	"predicted_position" numeric(6,2),
	"predicted_clicks_month" integer,
	"confidence" varchar(8),
	"recommendation" varchar(32),
	"rationale" text,
	"inputs" jsonb,
	"calibration" jsonb,
	"actual_position" numeric(6,2),
	"actual_clicks_month" integer,
	"actuals_updated_at" timestamp,
	"checked_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_rank_forecasts_tenant_idx" ON "blog_rank_forecasts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_rank_forecasts_post_checked_idx" ON "blog_rank_forecasts" USING btree ("post_id","checked_at");
