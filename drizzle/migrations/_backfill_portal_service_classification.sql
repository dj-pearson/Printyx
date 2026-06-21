-- US-SUPER-011: Portal NL service-request classification (extends the existing
-- customer portal scaffolding). Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_portal_service_classification.sql

CREATE TABLE IF NOT EXISTS "portal_service_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"service_ticket_id" varchar,
	"raw_text" varchar(2000),
	"category" varchar(80),
	"suggested_priority" varchar(16),
	"recommended_parts" jsonb,
	"suggested_tech_id" varchar,
	"playbook" jsonb,
	"confidence" double precision,
	"source" varchar(12) NOT NULL DEFAULT 'fallback',
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "portal_service_classifications_tenant_idx"
	ON "portal_service_classifications" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "portal_service_classifications_tenant_request_idx"
	ON "portal_service_classifications" USING btree ("tenant_id","request_id");
