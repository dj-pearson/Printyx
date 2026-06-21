-- US-SUPER-013: Voice phone agent (after-hours intake) — settings + call log.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_voice_agent.sql

CREATE TABLE IF NOT EXISTS "voice_agent_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL DEFAULT false,
	"after_hours_only" boolean NOT NULL DEFAULT true,
	"business_hours" jsonb,
	"languages" jsonb,
	"pii_redaction" boolean NOT NULL DEFAULT true,
	"twilio_number" varchar,
	"encrypted_config" jsonb,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "voice_agent_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"call_sid" varchar,
	"from_number" varchar,
	"caller_customer_id" varchar,
	"language" varchar(8),
	"transcript" varchar(8000),
	"recording_url" varchar,
	"recording_purge_at" timestamp,
	"detected_issue" varchar(2000),
	"machine_ref" varchar,
	"callback_number" varchar,
	"priority" varchar(4),
	"ticket_id" varchar,
	"escalated" boolean NOT NULL DEFAULT false,
	"on_call_tech_id" varchar,
	"twilio_cost" double precision NOT NULL DEFAULT 0,
	"ai_cost" double precision NOT NULL DEFAULT 0,
	"total_cost" double precision NOT NULL DEFAULT 0,
	"duration_seconds" integer NOT NULL DEFAULT 0,
	"status" varchar(16) NOT NULL DEFAULT 'completed',
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_agent_calls_tenant_idx" ON "voice_agent_calls" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "voice_agent_calls_tenant_created_idx" ON "voice_agent_calls" USING btree ("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "voice_agent_calls_purge_idx" ON "voice_agent_calls" USING btree ("recording_purge_at");
