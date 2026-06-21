-- US-SUPER-016: Sales rep email autopilot (draft mode) — accounts + drafts + suppressions.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_email_autopilot.sql

CREATE TABLE IF NOT EXISTS "email_autopilot_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar(12) NOT NULL,
	"email_address" varchar,
	"encrypted_tokens" jsonb,
	"voice_fingerprint" jsonb,
	"enabled" boolean NOT NULL DEFAULT false,
	"last_scan_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_autopilot_accounts_tenant_user_uq" ON "email_autopilot_accounts" USING btree ("tenant_id","user_id");

CREATE TABLE IF NOT EXISTS "email_autopilot_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider_message_id" varchar,
	"thread_id" varchar,
	"contact_email" varchar,
	"crm_contact_id" varchar,
	"classification" varchar(16) NOT NULL DEFAULT 'needs_reply',
	"classification_confidence" double precision,
	"inbound_subject" varchar(500),
	"inbound_snippet" varchar(2000),
	"draft_subject" varchar(500),
	"draft_body" varchar(8000),
	"draft_source" varchar(12) NOT NULL DEFAULT 'fallback',
	"external_draft_id" varchar,
	"status" varchar(12) NOT NULL DEFAULT 'draft',
	"edit_distance_pct" double precision,
	"final_body" varchar(8000),
	"reviewed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_autopilot_drafts_tenant_user_idx" ON "email_autopilot_drafts" USING btree ("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "email_autopilot_drafts_tenant_status_idx" ON "email_autopilot_drafts" USING btree ("tenant_id","status");

CREATE TABLE IF NOT EXISTS "email_autopilot_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"contact_email" varchar NOT NULL,
	"reason" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_autopilot_suppressions_uq" ON "email_autopilot_suppressions" USING btree ("tenant_id","user_id","contact_email");
