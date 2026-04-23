-- ============================================================================
-- lead-scoring-tables.sql — create any missing lead-scoring tables.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + indexes. Run BEFORE
-- lead-scoring.sql (RLS) if your DB was initialized from a baseline that
-- skipped migration 0000_fuzzy_blizzard.sql.
--
-- DDL mirrors `shared/lead-scoring-schema.ts` + the table definitions in
-- drizzle/migrations/0000_fuzzy_blizzard.sql.
-- ============================================================================

BEGIN;

-- ─── lead_scoring_rules ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_scoring_rules" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "rule_name" varchar NOT NULL,
  "rule_description" text,
  "category" varchar NOT NULL,
  "field" varchar NOT NULL,
  "operator" varchar NOT NULL,
  "value" jsonb NOT NULL,
  "score_points" integer NOT NULL,
  "max_score" integer,
  "priority" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_scoring_rules_tenant_idx" ON "lead_scoring_rules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lead_scoring_rules_tenant_active_idx" ON "lead_scoring_rules" ("tenant_id","is_active");
CREATE INDEX IF NOT EXISTS "lead_scoring_rules_category_idx" ON "lead_scoring_rules" ("category");

-- ─── lead_score_calculations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_score_calculations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" varchar NOT NULL,
  "tenant_id" varchar NOT NULL,
  "demographic_score" integer DEFAULT 0,
  "firmographic_score" integer DEFAULT 0,
  "behavioral_score" integer DEFAULT 0,
  "engagement_score" integer DEFAULT 0,
  "bant_score" integer DEFAULT 0,
  "total_score" integer DEFAULT 0 NOT NULL,
  "previous_score" integer,
  "score_change" integer,
  "lead_grade" varchar,
  "lead_tier" varchar,
  "prediction_score" numeric(5, 2),
  "confidence_level" varchar,
  "recommended_action" varchar,
  "calculation_method" varchar DEFAULT 'rule_based',
  "rules_applied" jsonb,
  "calculation_duration_ms" integer,
  "calculated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_score_calculations_lead_idx" ON "lead_score_calculations" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_score_calculations_tenant_idx" ON "lead_score_calculations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lead_score_calculations_calculated_at_idx" ON "lead_score_calculations" ("calculated_at");

-- ─── lead_scoring_factors ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_scoring_factors" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" varchar NOT NULL,
  "rule_id" varchar NOT NULL,
  "tenant_id" varchar NOT NULL,
  "factor_name" varchar NOT NULL,
  "factor_category" varchar NOT NULL,
  "points_awarded" integer NOT NULL,
  "evaluated_field" varchar,
  "evaluated_value" jsonb,
  "rule_condition" jsonb,
  "evaluated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_scoring_factors_lead_idx" ON "lead_scoring_factors" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_scoring_factors_tenant_idx" ON "lead_scoring_factors" ("tenant_id");

-- ─── bant_qualification_criteria ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bant_qualification_criteria" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" varchar NOT NULL,
  "tenant_id" varchar NOT NULL,
  "budget_identified" boolean DEFAULT false,
  "budget_amount" numeric(15, 2),
  "budget_timeframe" varchar,
  "budget_approved" boolean DEFAULT false,
  "budget_score" integer DEFAULT 0,
  "budget_notes" text,
  "decision_maker_identified" boolean DEFAULT false,
  "decision_maker_name" varchar,
  "decision_maker_title" varchar,
  "decision_maker_contact" varchar,
  "decision_process" text,
  "authority_score" integer DEFAULT 0,
  "authority_notes" text,
  "need_identified" boolean DEFAULT false,
  "need_type" varchar,
  "need_urgency" varchar,
  "need_description" text,
  "pain_points" jsonb,
  "need_score" integer DEFAULT 0,
  "need_notes" text,
  "timeline_identified" boolean DEFAULT false,
  "expected_close_date" timestamp,
  "decision_timeline" varchar,
  "implementation_timeline" varchar,
  "blockers" jsonb,
  "timeline_score" integer DEFAULT 0,
  "timeline_notes" text,
  "total_bant_score" integer DEFAULT 0,
  "qualification_status" varchar DEFAULT 'unqualified',
  "qualified_date" timestamp,
  "disqualified_reason" text,
  "assessed_by" varchar,
  "last_assessed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "bant_qualification_lead_idx" ON "bant_qualification_criteria" ("lead_id");
CREATE INDEX IF NOT EXISTS "bant_qualification_tenant_idx" ON "bant_qualification_criteria" ("tenant_id");
CREATE INDEX IF NOT EXISTS "bant_qualification_status_idx" ON "bant_qualification_criteria" ("qualification_status");

-- ─── lead_engagement_tracking ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_engagement_tracking" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" varchar NOT NULL,
  "tenant_id" varchar NOT NULL,
  "engagement_type" varchar NOT NULL,
  "engagement_channel" varchar,
  "engagement_source" varchar,
  "engagement_value" integer DEFAULT 1,
  "engagement_metadata" jsonb,
  "campaign_id" varchar,
  "user_id" varchar,
  "engaged_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_engagement_lead_idx" ON "lead_engagement_tracking" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_engagement_tenant_idx" ON "lead_engagement_tracking" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lead_engagement_engaged_at_idx" ON "lead_engagement_tracking" ("engaged_at");

-- ─── lead_qualification_history ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_qualification_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" varchar NOT NULL,
  "tenant_id" varchar NOT NULL,
  "previous_status" varchar,
  "new_status" varchar NOT NULL,
  "status_reason" text,
  "score_at_change" integer,
  "bant_score_at_change" integer,
  "changed_by" varchar,
  "change_reason" varchar,
  "notes" text,
  "metadata" jsonb,
  "changed_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_qualification_history_lead_idx" ON "lead_qualification_history" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_qualification_history_tenant_idx" ON "lead_qualification_history" ("tenant_id");

COMMIT;
