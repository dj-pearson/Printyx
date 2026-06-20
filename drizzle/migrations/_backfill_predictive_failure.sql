-- US-SUPER-001: predictive failure dispatch — predictions + per-tenant agent settings.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_predictive_failure.sql

CREATE TABLE IF NOT EXISTS "equipment_failure_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"predicted_window_start" timestamp,
	"predicted_window_end" timestamp,
	"confidence" double precision NOT NULL DEFAULT 0,
	"signals" jsonb,
	"contract_value" double precision DEFAULT 0,
	"service_ticket_id" varchar,
	"status" varchar(20) NOT NULL DEFAULT 'pending',
	"outcome" varchar(20),
	"snoozed_until" timestamp,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"generated_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "equipment_failure_predictions_tenant_idx"
	ON "equipment_failure_predictions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "equipment_failure_predictions_tenant_status_idx"
	ON "equipment_failure_predictions" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "equipment_failure_predictions_tenant_machine_idx"
	ON "equipment_failure_predictions" USING btree ("tenant_id","machine_id");

CREATE TABLE IF NOT EXISTS "predictive_dispatch_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"agent_enabled" boolean NOT NULL DEFAULT true,
	"confidence_threshold" double precision NOT NULL DEFAULT 0.7,
	"paused_at" timestamp,
	"paused_reason" varchar(500),
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);
