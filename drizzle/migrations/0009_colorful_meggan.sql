-- Idempotent: this migration introduces the task_workflow_* objects AND records
-- pre-existing blog_* drift that was previously applied via db:push (so those
-- objects already exist in some environments). Every statement is guarded with
-- IF NOT EXISTS / duplicate_object handling so it is safe to (re-)run.

DO $$ BEGIN
 CREATE TYPE "public"."task_workflow_event_type" AS ENUM('created', 'started', 'step_completed', 'step_reopened', 'step_assigned', 'advanced', 'regressed', 'reassigned', 'commented', 'published', 'archived', 'notified');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_workflow_source" AS ENUM('manual', 'image', 'csv', 'xlsx', 'template');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_workflow_status" AS ENUM('draft', 'active', 'completed', 'archived', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_workflow_step_status" AS ENUM('pending', 'active', 'in_progress', 'completed', 'blocked', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_workflow_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"workflow_id" varchar NOT NULL,
	"step_id" varchar,
	"event_type" "task_workflow_event_type" NOT NULL,
	"actor_user_id" varchar,
	"from_stage_index" integer,
	"to_stage_index" integer,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_workflow_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"workflow_id" varchar NOT NULL,
	"title" varchar(512) NOT NULL,
	"details" text,
	"stage_index" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"assignee_user_id" varchar,
	"assignee_name" varchar(255),
	"assignee_email" varchar(320),
	"status" "task_workflow_step_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp,
	"notified_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"completed_by" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "task_workflow_status" DEFAULT 'draft' NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"template_id" varchar,
	"owner_id" varchar NOT NULL,
	"project_manager_id" varchar,
	"current_stage_index" integer DEFAULT 0 NOT NULL,
	"source_type" "task_workflow_source" DEFAULT 'manual' NOT NULL,
	"source_file_name" varchar(512),
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar NOT NULL,
	"last_modified_by" varchar,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_competitor_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"domain" varchar(255) NOT NULL,
	"is_own" boolean DEFAULT false NOT NULL,
	"keyword" varchar(500) NOT NULL,
	"rank" integer,
	"search_volume" integer,
	"keyword_difficulty" integer,
	"cpc" numeric(10, 2),
	"intent" varchar(20),
	"source_adapter" varchar(32) DEFAULT 'dataforseo' NOT NULL,
	"raw_data" jsonb,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"type" varchar(64) NOT NULL,
	"payload" jsonb,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" jsonb,
	"result" jsonb,
	"idempotency_key" varchar(200),
	"locked_until" timestamp,
	"locked_by" varchar(200),
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_serp_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"keyword" varchar(500) NOT NULL,
	"location_code" integer DEFAULT 2840 NOT NULL,
	"language_code" varchar(16) DEFAULT 'en' NOT NULL,
	"organic_results" jsonb NOT NULL,
	"serp_features" jsonb,
	"aggregate" jsonb,
	"source_adapter" varchar(32) DEFAULT 'dataforseo' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "revision_retention_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "own_domain" varchar(255);--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "competitor_domains" text[];--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "organization_name" varchar(255);--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "organization_url" varchar(500);--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "organization_logo_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "critique_loop_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_keywords" ADD COLUMN IF NOT EXISTS "source_type" varchar(20);--> statement-breakpoint
ALTER TABLE "blog_keywords" ADD COLUMN IF NOT EXISTS "parent_keyword_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_keywords" ADD COLUMN IF NOT EXISTS "parent_question" text;--> statement-breakpoint
ALTER TABLE "blog_keywords" ADD COLUMN IF NOT EXISTS "mining_depth" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflow_events_workflow_idx" ON "task_workflow_events" USING btree ("tenant_id","workflow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflow_events_created_idx" ON "task_workflow_events" USING btree ("workflow_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflow_steps_workflow_idx" ON "task_workflow_steps" USING btree ("tenant_id","workflow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflow_steps_assignee_idx" ON "task_workflow_steps" USING btree ("tenant_id","assignee_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflow_steps_stage_idx" ON "task_workflow_steps" USING btree ("workflow_id","stage_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflows_tenant_idx" ON "task_workflows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflows_tenant_status_idx" ON "task_workflows" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_workflows_template_idx" ON "task_workflows" USING btree ("tenant_id","is_template");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_keywords_tenant_idx" ON "blog_competitor_keywords" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_keywords_tenant_domain_idx" ON "blog_competitor_keywords" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_keywords_tenant_keyword_idx" ON "blog_competitor_keywords" USING btree ("tenant_id","keyword");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_jobs_tenant_idx" ON "blog_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_jobs_tenant_status_idx" ON "blog_jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_jobs_run_queue_idx" ON "blog_jobs" USING btree ("status","scheduled_at","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_snapshots_tenant_idx" ON "blog_serp_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_snapshots_tenant_keyword_idx" ON "blog_serp_snapshots" USING btree ("tenant_id","keyword","fetched_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_keywords_parent_idx" ON "blog_keywords" USING btree ("parent_keyword_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_keywords_tenant_source_idx" ON "blog_keywords" USING btree ("tenant_id","source_type");
