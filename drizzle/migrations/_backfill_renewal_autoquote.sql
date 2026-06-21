-- US-SUPER-010: Renewal auto-quote generator — drafts + per-tenant settings + suppressions.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_renewal_autoquote.sql

CREATE TABLE IF NOT EXISTS "renewal_auto_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"parent_contract_id" varchar,
	"customer_id" varchar NOT NULL,
	"status" varchar(24) NOT NULL DEFAULT 'renewal_draft',
	"assigned_sales_rep" varchar,
	"contract_end_date" timestamp,
	"expiration_date" timestamp,
	"total_black_pages" integer NOT NULL DEFAULT 0,
	"total_color_pages" integer NOT NULL DEFAULT 0,
	"monthly_avg_black" double precision NOT NULL DEFAULT 0,
	"monthly_avg_color" double precision NOT NULL DEFAULT 0,
	"peak_month" varchar,
	"peak_volume" integer NOT NULL DEFAULT 0,
	"machine_breakdown" jsonb,
	"current_black_rate" double precision,
	"current_color_rate" double precision,
	"current_monthly_base" double precision,
	"recommended_black_rate" double precision,
	"recommended_color_rate" double precision,
	"recommended_monthly_base" double precision,
	"current_monthly_revenue" double precision NOT NULL DEFAULT 0,
	"recommended_monthly_revenue" double precision NOT NULL DEFAULT 0,
	"is_underage" boolean NOT NULL DEFAULT false,
	"retier_detail" jsonb,
	"line_items" jsonb,
	"quote_value" double precision NOT NULL DEFAULT 0,
	"outcome" varchar(12) NOT NULL DEFAULT 'pending',
	"outcome_at" timestamp,
	"outcome_note" varchar,
	"generated_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "renewal_auto_quotes_tenant_idx"
	ON "renewal_auto_quotes" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "renewal_auto_quotes_tenant_status_idx"
	ON "renewal_auto_quotes" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "renewal_auto_quotes_tenant_contract_idx"
	ON "renewal_auto_quotes" USING btree ("tenant_id","contract_id");

CREATE TABLE IF NOT EXISTS "renewal_autoquote_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"days_window_start" integer NOT NULL DEFAULT 90,
	"days_window_end" integer NOT NULL DEFAULT 100,
	"growth_buffer_pct" integer NOT NULL DEFAULT 10,
	"underage_threshold_pct" integer NOT NULL DEFAULT 10,
	"expiration_days" integer NOT NULL DEFAULT 30,
	"auto_generate_enabled" boolean NOT NULL DEFAULT true,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "renewal_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"reason" varchar,
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "renewal_suppressions_tenant_customer_uq"
	ON "renewal_suppressions" USING btree ("tenant_id","customer_id");

-- Cross-table foreign keys (enforced here only; the Drizzle schema keeps the
-- columns as plain varchars to stay import-light). Guarded so re-runs are safe.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE constraint_name = 'renewal_auto_quotes_contract_id_contracts_id_fk'
	) THEN
		ALTER TABLE "renewal_auto_quotes"
			ADD CONSTRAINT "renewal_auto_quotes_contract_id_contracts_id_fk"
			FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
	END IF;
EXCEPTION WHEN others THEN
	NULL; -- contracts may be absent in some environments; skip silently.
END $$;
