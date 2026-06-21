-- US-SUPER-004: Quarterly Business Review decks — reports + per-customer suppressions.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_qbr.sql

CREATE TABLE IF NOT EXISTS "qbr_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"quarter" varchar(12) NOT NULL,
	"status" varchar(16) NOT NULL DEFAULT 'draft',
	"content" jsonb,
	"pdf_url" varchar,
	"html_url" varchar,
	"generated_at" timestamp NOT NULL DEFAULT now(),
	"sent_at" timestamp,
	"sent_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "qbr_reports_tenant_idx"
	ON "qbr_reports" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "qbr_reports_tenant_customer_idx"
	ON "qbr_reports" USING btree ("tenant_id","customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "qbr_reports_tenant_customer_quarter_uq"
	ON "qbr_reports" USING btree ("tenant_id","customer_id","quarter");

CREATE TABLE IF NOT EXISTS "qbr_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"reason" varchar,
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "qbr_suppressions_tenant_customer_uq"
	ON "qbr_suppressions" USING btree ("tenant_id","customer_id");

-- Cross-table foreign key (enforced here only). Guarded so re-runs are safe.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE constraint_name = 'qbr_reports_customer_id_business_records_id_fk'
	) THEN
		ALTER TABLE "qbr_reports"
			ADD CONSTRAINT "qbr_reports_customer_id_business_records_id_fk"
			FOREIGN KEY ("customer_id") REFERENCES "business_records"("id") ON DELETE CASCADE;
	END IF;
EXCEPTION WHEN others THEN
	NULL; -- business_records may be absent in some environments; skip silently.
END $$;
