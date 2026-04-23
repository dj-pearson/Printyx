-- ============================================================================
-- customer-success-tables.sql — create any missing customer-success tables.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + indexes. Run BEFORE
-- customer-success.sql (RLS) if your DB was initialized from a baseline that
-- skipped migration 0000.
--
-- DDL mirrors drizzle/migrations/0000_fuzzy_blizzard.sql.
--
-- Table name note: Express expects `customer_interventions` (from the PRD),
-- but production uses `success_interventions`. Canonical name here is the
-- one that actually exists in migration 0000.
-- ============================================================================

BEGIN;

-- ─── customer_health_scores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "customer_health_scores" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "customer_id" varchar NOT NULL,
  "overall_score" integer NOT NULL,
  "health_status" varchar NOT NULL,
  "trend" varchar NOT NULL,
  "usage_score" integer NOT NULL,
  "engagement_score" integer NOT NULL,
  "support_score" integer NOT NULL,
  "payment_score" integer NOT NULL,
  "satisfaction_score" integer NOT NULL,
  "days_since_last_service" integer,
  "open_tickets_count" integer DEFAULT 0,
  "overdue_invoices_count" integer DEFAULT 0,
  "nps_score" integer,
  "csat" numeric(3, 2),
  "risk_factors" text[],
  "strength_factors" text[],
  "recommendations" text[],
  "calculated_at" timestamp DEFAULT now() NOT NULL,
  "calculated_by" varchar,
  "next_calculation_due" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "customer_health_scores_tenant_idx" ON "customer_health_scores" ("tenant_id");
CREATE INDEX IF NOT EXISTS "customer_health_scores_tenant_customer_idx" ON "customer_health_scores" ("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "customer_health_scores_status_idx" ON "customer_health_scores" ("tenant_id","health_status");

-- ─── churn_predictions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "churn_predictions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "customer_id" varchar NOT NULL,
  "churn_risk" varchar NOT NULL,
  "churn_probability" numeric(5, 4) NOT NULL,
  "confidence_level" numeric(5, 4) NOT NULL,
  "predicted_churn_date" timestamp,
  "days_until_churn" integer,
  "contract_end_date" timestamp,
  "primary_risk_factors" text[],
  "secondary_risk_factors" text[],
  "model_version" varchar NOT NULL,
  "model_type" varchar NOT NULL,
  "feature_importance" text,
  "estimated_mrr" numeric(12, 2),
  "estimated_ltv" numeric(12, 2),
  "retention_cost" numeric(12, 2),
  "intervention_required" boolean DEFAULT false,
  "intervention_triggered" boolean DEFAULT false,
  "intervention_id" varchar,
  "predicted_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "churn_predictions_tenant_idx" ON "churn_predictions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "churn_predictions_tenant_customer_idx" ON "churn_predictions" ("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "churn_predictions_risk_idx" ON "churn_predictions" ("tenant_id","churn_risk");

-- ─── success_interventions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "success_interventions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "customer_id" varchar NOT NULL,
  "intervention_type" varchar NOT NULL,
  "trigger" varchar NOT NULL,
  "priority" varchar NOT NULL,
  "status" varchar NOT NULL,
  "outcome" varchar,
  "assigned_to" varchar,
  "assigned_at" timestamp,
  "due_date" timestamp,
  "scheduled_date" timestamp,
  "executed_at" timestamp,
  "completed_at" timestamp,
  "title" varchar NOT NULL,
  "description" text,
  "action_items" text[],
  "notes" text,
  "customer_response" varchar,
  "follow_up_required" boolean DEFAULT false,
  "follow_up_date" timestamp,
  "health_score_before" integer,
  "health_score_after" integer,
  "churn_risk_before" varchar,
  "churn_risk_after" varchar,
  "related_health_score_id" varchar,
  "related_churn_prediction_id" varchar,
  "related_ticket_ids" text[],
  "automated_action" boolean DEFAULT false,
  "workflow_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" varchar
);
CREATE INDEX IF NOT EXISTS "success_interventions_tenant_idx" ON "success_interventions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "success_interventions_tenant_customer_idx" ON "success_interventions" ("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "success_interventions_assigned_to_idx" ON "success_interventions" ("assigned_to");
CREATE INDEX IF NOT EXISTS "success_interventions_status_idx" ON "success_interventions" ("tenant_id","status");

-- ─── customer_journeys ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "customer_journeys" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "customer_id" varchar NOT NULL,
  "current_stage" varchar NOT NULL,
  "previous_stage" varchar,
  "stage_entered_at" timestamp NOT NULL,
  "days_since_stage_change" integer DEFAULT 0,
  "total_days_as_customer" integer DEFAULT 0,
  "lifecycle_phase" varchar NOT NULL,
  "onboarding_completed" boolean DEFAULT false,
  "onboarding_completed_at" timestamp,
  "first_service_completed" boolean DEFAULT false,
  "first_service_completed_at" timestamp,
  "first_renewal_completed" boolean DEFAULT false,
  "first_renewal_completed_at" timestamp,
  "total_touchpoints" integer DEFAULT 0,
  "last_touchpoint_date" timestamp,
  "last_touchpoint_type" varchar,
  "avg_days_between_touchpoints" integer,
  "engagement_trend" varchar,
  "next_expected_stage" varchar,
  "predicted_stage_change_date" timestamp,
  "recommended_actions" text[],
  "journey_health" varchar NOT NULL,
  "blockers" text[],
  "current_intervention_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "customer_journeys_tenant_idx" ON "customer_journeys" ("tenant_id");
CREATE INDEX IF NOT EXISTS "customer_journeys_tenant_customer_idx" ON "customer_journeys" ("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "customer_journeys_stage_idx" ON "customer_journeys" ("tenant_id","current_stage");

-- ─── renewal_opportunities ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "renewal_opportunities" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "customer_id" varchar NOT NULL,
  "contract_id" varchar NOT NULL,
  "renewal_type" varchar NOT NULL,
  "renewal_status" varchar NOT NULL,
  "renewal_probability" numeric(5, 4) NOT NULL,
  "contract_end_date" timestamp NOT NULL,
  "days_until_renewal" integer NOT NULL,
  "outreach_start_date" timestamp,
  "target_close_date" timestamp,
  "actual_renewal_date" timestamp,
  "current_mrr" numeric(12, 2) NOT NULL,
  "projected_mrr" numeric(12, 2) NOT NULL,
  "mrr_change" numeric(12, 2),
  "mrr_change_percent" numeric(5, 2),
  "current_contract_value" numeric(12, 2),
  "projected_contract_value" numeric(12, 2),
  "expansion_potential" boolean DEFAULT false,
  "suggested_add_ons" text[],
  "suggested_upgrades" text[],
  "estimated_expansion_value" numeric(12, 2),
  "renewal_risk" varchar NOT NULL,
  "risk_factors" text[],
  "strength_factors" text[],
  "assigned_csm" varchar,
  "assigned_sales_rep" varchar,
  "last_contact_date" timestamp,
  "next_contact_date" timestamp,
  "contact_frequency" varchar,
  "action_plan" text[],
  "internal_notes" text,
  "competitor_threats" text[],
  "outcome_notes" text,
  "lost_reason" varchar,
  "win_reason" varchar,
  "related_health_score_id" varchar,
  "related_churn_prediction_id" varchar,
  "related_intervention_ids" text[],
  "quote_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" varchar
);
CREATE INDEX IF NOT EXISTS "renewal_opportunities_tenant_idx" ON "renewal_opportunities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "renewal_opportunities_tenant_customer_idx" ON "renewal_opportunities" ("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "renewal_opportunities_contract_idx" ON "renewal_opportunities" ("contract_id");
CREATE INDEX IF NOT EXISTS "renewal_opportunities_status_idx" ON "renewal_opportunities" ("tenant_id","renewal_status");
CREATE INDEX IF NOT EXISTS "renewal_opportunities_end_date_idx" ON "renewal_opportunities" ("tenant_id","contract_end_date");

COMMIT;
