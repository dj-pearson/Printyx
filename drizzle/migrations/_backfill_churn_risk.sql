-- US-SUPER-009: customer churn-risk weekly scoring — scores + per-tenant settings.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_churn_risk.sql

CREATE TABLE IF NOT EXISTS "customer_churn_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"score" double precision NOT NULL DEFAULT 0,
	"band" varchar(20) NOT NULL DEFAULT 'healthy',
	"signals" jsonb,
	"contract_value" double precision DEFAULT 0,
	"calculated_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "customer_churn_scores_tenant_idx"
	ON "customer_churn_scores" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "customer_churn_scores_tenant_customer_idx"
	ON "customer_churn_scores" USING btree ("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "customer_churn_scores_tenant_band_idx"
	ON "customer_churn_scores" USING btree ("tenant_id","band");

CREATE TABLE IF NOT EXISTS "churn_risk_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"weights" jsonb,
	"watch_threshold" integer NOT NULL DEFAULT 31,
	"at_risk_threshold" integer NOT NULL DEFAULT 61,
	"digest_enabled" boolean NOT NULL DEFAULT true,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);

-- Cross-table foreign keys (enforced here only — the Drizzle schema keeps the
-- columns as plain varchars to stay import-light). Guarded so re-runs are safe.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE constraint_name = 'customer_churn_scores_customer_id_business_records_id_fk'
	) THEN
		ALTER TABLE "customer_churn_scores"
			ADD CONSTRAINT "customer_churn_scores_customer_id_business_records_id_fk"
			FOREIGN KEY ("customer_id") REFERENCES "business_records"("id") ON DELETE CASCADE;
	END IF;
EXCEPTION WHEN others THEN
	-- business_records may not exist in every environment; skip silently.
	NULL;
END $$;
