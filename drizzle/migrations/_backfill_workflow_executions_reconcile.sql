-- BACKFILL: reconcile a drifted physical `workflow_executions` table up to the
-- canonical CRMX-008 shape so migration 0025 can build its indexes.
-- Root cause: the DB already had an OLDER `workflow_executions` (from a past db:push
-- predating the `workflow_id` column), so `CREATE TABLE IF NOT EXISTS` was a no-op and
-- 0025 errored with 42703: column "workflow_id" does not exist.
--
-- Idempotent hand-run repair. Adds every canonical column as NULLABLE (existing rows,
-- if any, would violate NOT NULL) — 0025 only needs tenant_id + workflow_id present.
-- Run this BEFORE 0025. Canonical columns from 0000_fuzzy_blizzard.sql.

ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "tenant_id" varchar;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "workflow_id" varchar;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "workflow_version_id" varchar;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "trigger_id" varchar;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "initiated_by" varchar;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "context" jsonb;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "result" jsonb;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "error" text;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "started_at" timestamp;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
