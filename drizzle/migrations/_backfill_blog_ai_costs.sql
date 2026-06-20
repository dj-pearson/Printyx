-- US-BLOG-078: per-call AI spend ledger + per-workspace monthly quota.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_ai_costs.sql

CREATE TABLE IF NOT EXISTS "blog_ai_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(80),
	"feature" varchar(64) NOT NULL,
	"prompt_tokens" integer NOT NULL DEFAULT 0,
	"completion_tokens" integer NOT NULL DEFAULT 0,
	"total_tokens" integer NOT NULL DEFAULT 0,
	"cost_cents" integer NOT NULL DEFAULT 0,
	"request_id" varchar(200),
	"post_id" uuid,
	"pipeline_run_id" uuid,
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_ai_costs_tenant_created_idx" ON "blog_ai_costs" USING btree ("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "blog_ai_costs_tenant_feature_idx" ON "blog_ai_costs" USING btree ("tenant_id","feature");
CREATE INDEX IF NOT EXISTS "blog_ai_costs_tenant_model_idx" ON "blog_ai_costs" USING btree ("tenant_id","model");
CREATE INDEX IF NOT EXISTS "blog_ai_costs_post_idx" ON "blog_ai_costs" USING btree ("post_id");

CREATE TABLE IF NOT EXISTS "blog_ai_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"monthly_limit_cents" integer,
	"warn_threshold_pct" integer NOT NULL DEFAULT 80,
	"hard_stop" boolean NOT NULL DEFAULT true,
	"anomaly_multiplier" numeric(5,2) NOT NULL DEFAULT 3,
	"alert_email" varchar(320),
	"alert_slack_webhook" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_ai_quotas_tenant_unique" ON "blog_ai_quotas" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_ai_quotas_tenant_idx" ON "blog_ai_quotas" USING btree ("tenant_id");
