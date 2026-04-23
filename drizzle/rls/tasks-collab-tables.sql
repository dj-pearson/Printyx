-- ============================================================================
-- tasks-collab-tables.sql — create any missing task + collab tables.
--
-- Only 5 tables exist in migration 0000 for this domain:
--   tasks, task_comments, time_entries, teams, projects
--
-- The PRD references categories / suggestions / schedules / members / assignments /
-- dependencies / templates / analytics / alerts — none of those have tables.
-- Those endpoints return sensible-default stubs in the edge handlers.
-- ============================================================================

BEGIN;

-- ─── Enums (referenced by tasks + projects) ──────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "task_status" AS ENUM('todo', 'in_progress', 'review', 'completed', 'blocked', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "task_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" "task_status" DEFAULT 'todo' NOT NULL,
  "priority" "task_priority" DEFAULT 'medium' NOT NULL,
  "assigned_to" varchar,
  "created_by" varchar NOT NULL,
  "project_id" varchar,
  "parent_task_id" varchar,
  "due_date" timestamp,
  "start_date" timestamp,
  "estimated_hours" integer,
  "actual_hours" integer,
  "completion_percentage" integer DEFAULT 0,
  "dependencies" jsonb DEFAULT '[]'::jsonb,
  "watchers" jsonb DEFAULT '[]'::jsonb,
  "time_tracked" integer DEFAULT 0,
  "comment_count" integer DEFAULT 0,
  "attachment_count" integer DEFAULT 0,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "custom_fields" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);
CREATE INDEX IF NOT EXISTS "tasks_tenant_idx" ON "tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tasks_tenant_status_idx" ON "tasks" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_idx" ON "tasks" ("assigned_to");
CREATE INDEX IF NOT EXISTS "tasks_project_idx" ON "tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks" ("tenant_id","due_date");

-- ─── task_comments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "task_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "comment" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "task_comments_task_idx" ON "task_comments" ("task_id");
CREATE INDEX IF NOT EXISTS "task_comments_tenant_idx" ON "task_comments" ("tenant_id");

-- ─── time_entries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "task_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "description" text,
  "hours" integer NOT NULL,
  "entry_date" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "time_entries_task_idx" ON "time_entries" ("task_id");
CREATE INDEX IF NOT EXISTS "time_entries_user_date_idx" ON "time_entries" ("user_id","entry_date");
CREATE INDEX IF NOT EXISTS "time_entries_tenant_idx" ON "time_entries" ("tenant_id");

-- ─── teams ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "teams" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "location_id" varchar,
  "name" varchar(100) NOT NULL,
  "department" varchar(30) NOT NULL,
  "manager_id" varchar,
  "parent_team_id" varchar,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "teams_tenant_idx" ON "teams" ("tenant_id");
CREATE INDEX IF NOT EXISTS "teams_manager_idx" ON "teams" ("manager_id");

-- ─── projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "projects" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "status" "project_status" DEFAULT 'planning' NOT NULL,
  "project_manager" varchar,
  "created_by" varchar NOT NULL,
  "customer_id" varchar,
  "contract_id" varchar,
  "start_date" timestamp,
  "end_date" timestamp,
  "estimated_budget" integer,
  "actual_budget" integer,
  "completion_percentage" integer DEFAULT 0,
  "color" varchar DEFAULT '#3b82f6',
  "template" varchar,
  "workflow" jsonb DEFAULT '[]'::jsonb,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "custom_fields" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);
CREATE INDEX IF NOT EXISTS "projects_tenant_idx" ON "projects" ("tenant_id");
CREATE INDEX IF NOT EXISTS "projects_tenant_status_idx" ON "projects" ("tenant_id","status");

-- The `projects` table exists in two conflicting Drizzle definitions in this
-- repo (shared/schema.ts — simpler; shared/task-schema.ts + migration 0000 —
-- richer). The edge handler writes to the richer column set. Bring the DB
-- up to the richer shape via idempotent ADD COLUMN statements.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "project_manager" varchar;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "contract_id" varchar;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "estimated_budget" integer;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "actual_budget" integer;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "color" varchar DEFAULT '#3b82f6';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "template" varchar;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workflow" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;

CREATE INDEX IF NOT EXISTS "projects_manager_idx" ON "projects" ("project_manager");

-- Likewise for tasks — the handler writes comment_count / attachment_count /
-- time_tracked / watchers / dependencies / tags / custom_fields / parent_task_id
-- / completion_percentage / estimated_hours / actual_hours. All are declared
-- in migration 0000's `tasks` table, but a simpler variant may exist too.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" varchar;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "start_date" timestamp;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_hours" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "actual_hours" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completion_percentage" integer DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dependencies" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "watchers" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "time_tracked" integer DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "comment_count" integer DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "attachment_count" integer DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;

COMMIT;
