-- ============================================================================
-- leases-tables.sql — create any missing lease tables.
--
-- Idempotent: enum guards + CREATE TABLE IF NOT EXISTS. Run BEFORE leases.sql
-- (RLS) if your DB was initialized from a baseline that skipped migration 0000.
-- ============================================================================

BEGIN;

-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "disposition_action" AS ENUM('return', 'purchase', 'renew', 'upgrade', 'extend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "lease_payment_status" AS ENUM('scheduled', 'processing', 'completed', 'failed', 'refunded', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "lease_status" AS ENUM('pending', 'active', 'pending_renewal', 'renewed', 'expired', 'terminated', 'defaulted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "lease_type" AS ENUM('fmv', 'dollar_buyout', 'ten_percent', 'trac', 'operating', 'capital');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── leases ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "leases" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "lease_number" varchar NOT NULL,
  "lease_name" varchar NOT NULL,
  "customer_id" varchar NOT NULL,
  "business_record_id" varchar,
  "proposal_id" varchar,
  "contract_id" varchar,
  "lease_type" "lease_type" DEFAULT 'fmv' NOT NULL,
  "status" "lease_status" DEFAULT 'pending' NOT NULL,
  "total_amount" numeric(12, 2) NOT NULL,
  "monthly_payment" numeric(10, 2) NOT NULL,
  "term" integer NOT NULL,
  "interest_rate" numeric(5, 3),
  "residual_value" numeric(12, 2),
  "buyout_amount" numeric(12, 2),
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "first_payment_date" timestamp NOT NULL,
  "last_payment_date" timestamp NOT NULL,
  "equipment_ids" jsonb DEFAULT '[]'::jsonb,
  "payment_method" varchar,
  "payment_day_of_month" integer DEFAULT 1,
  "auto_pay_enabled" boolean DEFAULT false,
  "insurance_required" boolean DEFAULT false,
  "maintenance_included" boolean DEFAULT false,
  "taxable" boolean DEFAULT true,
  "sales_tax_rate" numeric(5, 3),
  "renewal_option" boolean DEFAULT true,
  "renewal_notice_months" integer DEFAULT 6,
  "renewal_reminder_sent" boolean DEFAULT false,
  "renewal_reminder_date" timestamp,
  "early_termination_allowed" boolean DEFAULT false,
  "early_termination_penalty" numeric(10, 2),
  "document_url" varchar,
  "e_signature_id" varchar,
  "lessor_name" varchar,
  "lessor_contact_name" varchar,
  "lessor_contact_email" varchar,
  "lessor_contact_phone" varchar,
  "lessor_account_number" varchar,
  "notes" text,
  "special_terms" text,
  "payments_completed" integer DEFAULT 0,
  "total_paid" numeric(12, 2) DEFAULT 0,
  "balance_remaining" numeric(12, 2),
  "days_until_expiry" integer,
  "payment_health" varchar DEFAULT 'good',
  "missed_payments" integer DEFAULT 0,
  "created_by" varchar NOT NULL,
  "updated_by" varchar,
  "approved_by" varchar,
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "leases_lease_number_unique" UNIQUE("lease_number")
);
CREATE INDEX IF NOT EXISTS "leases_tenant_idx" ON "leases" ("tenant_id");
CREATE INDEX IF NOT EXISTS "leases_tenant_customer_idx" ON "leases" ("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "leases_tenant_status_idx" ON "leases" ("tenant_id","status");

-- ─── lease_payments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lease_payments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "lease_id" varchar NOT NULL,
  "payment_number" integer NOT NULL,
  "scheduled_date" timestamp NOT NULL,
  "scheduled_amount" numeric(10, 2) NOT NULL,
  "paid_date" timestamp,
  "paid_amount" numeric(10, 2),
  "status" "lease_payment_status" DEFAULT 'scheduled' NOT NULL,
  "payment_method" varchar,
  "confirmation_number" varchar,
  "transaction_id" varchar,
  "invoice_id" varchar,
  "payment_integration_id" varchar,
  "principal" numeric(10, 2),
  "interest" numeric(10, 2),
  "tax" numeric(10, 2),
  "fees" numeric(10, 2),
  "failure_reason" text,
  "retry_count" integer DEFAULT 0,
  "last_retry_date" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lease_payments_tenant_idx" ON "lease_payments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lease_payments_lease_idx" ON "lease_payments" ("lease_id");
CREATE INDEX IF NOT EXISTS "lease_payments_tenant_status_idx" ON "lease_payments" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "lease_payments_scheduled_date_idx" ON "lease_payments" ("tenant_id","scheduled_date");

-- ─── lease_renewals ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lease_renewals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "lease_id" varchar NOT NULL,
  "renewal_offered" boolean DEFAULT false,
  "renewal_offer_date" timestamp,
  "renewal_deadline" timestamp,
  "renewal_term" integer,
  "renewal_monthly_payment" numeric(10, 2),
  "renewal_total_amount" numeric(12, 2),
  "renewal_type" "lease_type",
  "customer_decision" varchar,
  "decision_date" timestamp,
  "decision_by" varchar,
  "reminders_sent" integer DEFAULT 0,
  "last_reminder_date" timestamp,
  "next_reminder_date" timestamp,
  "notes" text,
  "internal_notes" text,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lease_renewals_tenant_idx" ON "lease_renewals" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lease_renewals_lease_idx" ON "lease_renewals" ("lease_id");

-- ─── lease_dispositions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lease_dispositions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "lease_id" varchar NOT NULL,
  "action" "disposition_action" NOT NULL,
  "action_date" timestamp NOT NULL,
  "return_scheduled_date" timestamp,
  "return_completed_date" timestamp,
  "return_condition" varchar,
  "return_notes" text,
  "purchase_price" numeric(12, 2),
  "purchase_date" timestamp,
  "purchase_invoice_id" varchar,
  "upgrade_proposal_id" varchar,
  "upgrade_lease_id" varchar,
  "trade_in_value" numeric(12, 2),
  "settlement_amount" numeric(12, 2),
  "damage_fees" numeric(10, 2),
  "excess_usage_fees" numeric(10, 2),
  "other_fees" numeric(10, 2),
  "fee_notes" text,
  "equipment_condition_report" jsonb,
  "photo_urls" jsonb,
  "final_status" varchar,
  "completion_date" timestamp,
  "assigned_to" varchar,
  "completed_by" varchar,
  "notes" text,
  "internal_notes" text,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lease_dispositions_tenant_idx" ON "lease_dispositions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lease_dispositions_lease_idx" ON "lease_dispositions" ("lease_id");

COMMIT;
