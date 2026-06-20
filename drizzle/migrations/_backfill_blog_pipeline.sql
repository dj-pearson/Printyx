-- US-BLOG-073: multi-agent draft pipeline (runs + per-stage artifacts).
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_pipeline.sql

-- Per-workspace stage toggles live on the existing agent settings row.
ALTER TABLE "blog_agent_settings"
  ADD COLUMN IF NOT EXISTS "pipeline_stages_config" jsonb;

CREATE TABLE IF NOT EXISTS "blog_pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"brief_id" uuid,
	"post_id" uuid,
	"topic" varchar(500) NOT NULL,
	"target_keyword" varchar(500),
	"brand_voice_id" uuid,
	"stages_config" jsonb,
	"status" varchar(20) NOT NULL DEFAULT 'queued',
	"current_stage" varchar(24),
	"total_cost_cents" integer NOT NULL DEFAULT 0,
	"total_latency_ms" integer NOT NULL DEFAULT 0,
	"error" jsonb,
	"agent_run_id" varchar(100),
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "blog_pipeline_runs_tenant_idx" ON "blog_pipeline_runs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_pipeline_runs_tenant_status_idx" ON "blog_pipeline_runs" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_pipeline_runs_post_idx" ON "blog_pipeline_runs" USING btree ("post_id");

CREATE TABLE IF NOT EXISTS "blog_pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL REFERENCES "blog_pipeline_runs"("id") ON DELETE CASCADE,
	"tenant_id" varchar NOT NULL,
	"stage" varchar(24) NOT NULL,
	"seq" integer NOT NULL,
	"status" varchar(16) NOT NULL DEFAULT 'pending',
	"input" jsonb,
	"output" jsonb,
	"model" varchar(80),
	"prompt_tokens" integer NOT NULL DEFAULT 0,
	"completion_tokens" integer NOT NULL DEFAULT 0,
	"cost_cents" integer NOT NULL DEFAULT 0,
	"latency_ms" integer NOT NULL DEFAULT 0,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_pipeline_stages_run_idx" ON "blog_pipeline_stages" USING btree ("run_id");
CREATE INDEX IF NOT EXISTS "blog_pipeline_stages_tenant_idx" ON "blog_pipeline_stages" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_pipeline_stages_run_seq_idx" ON "blog_pipeline_stages" USING btree ("run_id","seq");
