-- PA-034: schema-of-record for the billing DRIFT tables so a fresh database can
-- provision them (they previously existed only as raw-SQL tables in prod, absent
-- from every migration, causing silent 503s on billing writes). Idempotent:
-- CREATE TABLE IF NOT EXISTS is a no-op where they already exist.
CREATE TABLE IF NOT EXISTS "billing_configurations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "configuration_name" text,
  "billing_type" text,
  "billing_frequency" text,
  "billing_day" integer,
  "base_rate" numeric(12, 4),
  "minimum_charge" numeric(12, 2),
  "maximum_charge" numeric(12, 2),
  "overage_rate" numeric(12, 4),
  "setup_fee" numeric(12, 2),
  "maintenance_fee" numeric(12, 2),
  "tax_rate" numeric(6, 4),
  "tax_inclusive" boolean DEFAULT false,
  "contract_length_months" integer,
  "early_termination_fee" numeric(12, 2),
  "is_default" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_cycles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "cycle_name" text,
  "cycle_date" date,
  "status" varchar DEFAULT 'processing',
  "started_at" timestamp,
  "completed_at" timestamp,
  "total_invoices_generated" integer DEFAULT 0,
  "total_amount" numeric(14, 2) DEFAULT '0',
  "created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_adjustments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "adjustment_type" text,
  "adjustment_reason" text,
  "amount" numeric(14, 2),
  "description" text,
  "invoice_id" varchar,
  "business_record_id" varchar,
  "status" varchar DEFAULT 'pending',
  "requested_by" varchar,
  "approved_by" varchar,
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_configurations_tenant_idx" ON "billing_configurations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_cycles_tenant_idx" ON "billing_cycles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_adjustments_tenant_idx" ON "billing_adjustments" USING btree ("tenant_id");
