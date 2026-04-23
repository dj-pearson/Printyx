-- ============================================================================
-- lead-assignment-tables.sql — create any missing lead-assignment tables.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + indexes. Run BEFORE
-- lead-assignment.sql (RLS) if your DB was initialized from a baseline
-- that skipped migration 0000_fuzzy_blizzard.sql.
--
-- DDL mirrors `shared/lead-assignment-schema.ts` and the table definitions
-- in drizzle/migrations/0000_fuzzy_blizzard.sql.
-- ============================================================================

BEGIN;

-- ─── sales_territories ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sales_territories" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "territory_name" varchar(255) NOT NULL,
  "territory_code" varchar(50),
  "description" text,
  "territory_type" varchar(50) NOT NULL,
  "geographic_rules" jsonb,
  "account_rules" jsonb,
  "product_focus" text[],
  "is_active" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 0,
  "owner_id" varchar,
  "team_members" text[],
  "manager_id" varchar,
  "monthly_quota" numeric(12, 2),
  "current_pipeline" numeric(12, 2) DEFAULT '0',
  "active_leads_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sales_territories_tenant_idx" ON "sales_territories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "sales_territories_tenant_active_idx" ON "sales_territories" ("tenant_id","is_active");
CREATE INDEX IF NOT EXISTS "sales_territories_owner_idx" ON "sales_territories" ("owner_id");

-- ─── lead_assignment_rules ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_assignment_rules" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "rule_name" varchar(255) NOT NULL,
  "description" text,
  "assignment_type" varchar(50) NOT NULL,
  "criteria" jsonb NOT NULL,
  "territory_id" varchar,
  "assign_to_user_id" varchar,
  "assign_to_team" varchar,
  "round_robin_config" jsonb,
  "respect_capacity_limits" boolean DEFAULT true,
  "max_leads_per_rep" integer,
  "max_leads_per_day" integer,
  "assign_immediately" boolean DEFAULT true,
  "delay_minutes" integer DEFAULT 0,
  "business_hours_only" boolean DEFAULT false,
  "escalation_enabled" boolean DEFAULT false,
  "escalate_after_minutes" integer DEFAULT 60,
  "escalate_to_user_id" varchar,
  "priority" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "assignments_count" integer DEFAULT 0,
  "last_assigned_at" timestamp,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_assignment_rules_tenant_idx" ON "lead_assignment_rules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lead_assignment_rules_tenant_active_idx" ON "lead_assignment_rules" ("tenant_id","is_active");
CREATE INDEX IF NOT EXISTS "lead_assignment_rules_priority_idx" ON "lead_assignment_rules" ("priority");
CREATE INDEX IF NOT EXISTS "lead_assignment_rules_territory_idx" ON "lead_assignment_rules" ("territory_id");

-- ─── rep_capacity ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "rep_capacity" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "max_active_leads" integer DEFAULT 50,
  "max_new_leads_per_day" integer DEFAULT 10,
  "max_new_leads_per_week" integer DEFAULT 30,
  "current_active_leads" integer DEFAULT 0,
  "leads_assigned_today" integer DEFAULT 0,
  "leads_assigned_this_week" integer DEFAULT 0,
  "is_available" boolean DEFAULT true,
  "unavailable_reason" varchar(100),
  "unavailable_until" timestamp,
  "skills" text[],
  "certifications" text[],
  "languages" text[],
  "average_response_time_minutes" integer,
  "conversion_rate" numeric(5, 2),
  "average_deal_size" numeric(12, 2),
  "working_hours" jsonb,
  "last_reset_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "rep_capacity_tenant_user_idx" ON "rep_capacity" ("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "rep_capacity_user_idx" ON "rep_capacity" ("user_id");
CREATE INDEX IF NOT EXISTS "rep_capacity_available_idx" ON "rep_capacity" ("is_available");

-- ─── lead_assignment_history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_assignment_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "lead_id" varchar NOT NULL,
  "assigned_from" varchar,
  "assigned_to" varchar NOT NULL,
  "assignment_reason" varchar(100) NOT NULL,
  "rule_id" varchar,
  "assigned_by" varchar,
  "assignment_notes" text,
  "first_response_at" timestamp,
  "first_response_time_minutes" integer,
  "accepted_at" timestamp,
  "rejected_at" timestamp,
  "rejection_reason" text,
  "assigned_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_assignment_history_lead_idx" ON "lead_assignment_history" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_assignment_history_tenant_lead_idx" ON "lead_assignment_history" ("tenant_id","lead_id");
CREATE INDEX IF NOT EXISTS "lead_assignment_history_assigned_to_idx" ON "lead_assignment_history" ("assigned_to");
CREATE INDEX IF NOT EXISTS "lead_assignment_history_assigned_at_idx" ON "lead_assignment_history" ("assigned_at");

-- ─── lead_assignment_queue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_assignment_queue" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "lead_id" varchar NOT NULL,
  "status" varchar(50) DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 0,
  "target_user_id" varchar,
  "rule_id" varchar,
  "schedule_for" timestamp,
  "processed_at" timestamp,
  "assigned_at" timestamp,
  "attempt_count" integer DEFAULT 0,
  "last_error" text,
  "max_attempts" integer DEFAULT 3,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_assignment_queue_tenant_status_idx" ON "lead_assignment_queue" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "lead_assignment_queue_lead_idx" ON "lead_assignment_queue" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_assignment_queue_schedule_idx" ON "lead_assignment_queue" ("schedule_for");
CREATE INDEX IF NOT EXISTS "lead_assignment_queue_priority_idx" ON "lead_assignment_queue" ("priority");

COMMIT;

-- Verify all 5 tables exist:
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'sales_territories', 'lead_assignment_rules', 'rep_capacity',
--       'lead_assignment_history', 'lead_assignment_queue'
--     );
