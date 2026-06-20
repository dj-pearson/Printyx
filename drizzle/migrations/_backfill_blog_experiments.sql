-- US-BLOG-064: on-page A/B experiments for title / meta description / CTA.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_experiments.sql

CREATE TABLE IF NOT EXISTS "blog_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"element_type" varchar(20) NOT NULL,
	"variant_a" jsonb NOT NULL,
	"variant_b" jsonb NOT NULL,
	"serving_mode" varchar(16) NOT NULL DEFAULT 'weekly_alternate',
	"status" varchar(16) NOT NULL DEFAULT 'running',
	"winner" varchar(8),
	"significance" jsonb,
	"min_sample" integer NOT NULL DEFAULT 100,
	"auto_promote" boolean NOT NULL DEFAULT false,
	"approved_by_user_id" varchar,
	"promoted_at" timestamp,
	"started_at" timestamp NOT NULL DEFAULT now(),
	"a_impressions" integer NOT NULL DEFAULT 0,
	"a_clicks" integer NOT NULL DEFAULT 0,
	"a_assignments" integer NOT NULL DEFAULT 0,
	"a_conversions" integer NOT NULL DEFAULT 0,
	"b_impressions" integer NOT NULL DEFAULT 0,
	"b_clicks" integer NOT NULL DEFAULT 0,
	"b_assignments" integer NOT NULL DEFAULT 0,
	"b_conversions" integer NOT NULL DEFAULT 0,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_experiments_tenant_idx" ON "blog_experiments" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_experiments_post_idx" ON "blog_experiments" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "blog_experiments_tenant_status_idx" ON "blog_experiments" USING btree ("tenant_id","status");
