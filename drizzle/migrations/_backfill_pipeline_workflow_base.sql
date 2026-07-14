-- BACKFILL: create the base tables that migrations 0024 / 0025 patch.
-- Root cause: the 0000 baseline was marked-applied-without-executing on this DB
-- (baseline pattern), so `pipeline_stages` (patched by 0024) and
-- `workflow_executions` (patched by 0025) were never created. 0024 errored with
-- 42P01 relation does not exist; 0025 with 42703 column "workflow_id" does not exist.
--
-- Idempotent hand-run repair (journal stops at 0009; see backfill-migration-tracking).
-- Run this BEFORE 0024 and 0025. Definitions copied verbatim from 0000_fuzzy_blizzard.sql.
-- FKs are intentionally omitted here (0000 adds them via ALTER after all tables exist).

-- execution_status enum (needed by workflow_executions). CREATE TYPE has no IF NOT EXISTS.
DO $$ BEGIN
  CREATE TYPE "public"."execution_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled', 'paused');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pipeline_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"pipeline_template_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3B82F6',
	"icon" varchar(50),
	"order" integer NOT NULL,
	"is_final_stage" boolean DEFAULT false,
	"is_closed_won" boolean DEFAULT false,
	"is_closed_lost" boolean DEFAULT false,
	"required_fields" jsonb,
	"sla_enabled" boolean DEFAULT false,
	"sla_days" integer,
	"sla_hours" integer,
	"sla_escalation_enabled" boolean DEFAULT false,
	"sla_escalate_to" varchar,
	"automation_triggers" jsonb,
	"default_probability" integer DEFAULT 50,
	"include_in_forecast" boolean DEFAULT true,
	"weighted_value" boolean DEFAULT true,
	"best_practices" text,
	"action_required" text,
	"exit_criteria" text,
	"average_days_in_stage" numeric(8, 2),
	"conversion_rate" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_executions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"workflow_id" varchar NOT NULL,
	"workflow_version_id" varchar NOT NULL,
	"trigger_id" varchar,
	"tenant_id" varchar NOT NULL,
	"status" "execution_status" DEFAULT 'queued' NOT NULL,
	"initiated_by" varchar,
	"context" jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
