-- US-SUPER-005: Voice-first ticket close — voice close drafts.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_voice_ticket_close.sql

CREATE TABLE IF NOT EXISTS "voice_ticket_closes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"tech_user_id" varchar,
	"client_dedupe_key" varchar,
	"audio_url" varchar,
	"transcript" varchar(8000),
	"transcript_source" varchar(16) NOT NULL DEFAULT 'fallback',
	"extracted" jsonb,
	"extraction_source" varchar(16) NOT NULL DEFAULT 'fallback',
	"sku_resolutions" jsonb,
	"draft_invoice_items" jsonb,
	"labor_minutes" integer,
	"follow_up_needed" boolean NOT NULL DEFAULT false,
	"status" varchar(12) NOT NULL DEFAULT 'draft',
	"audio_purge_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_tenant_idx" ON "voice_ticket_closes" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_tenant_ticket_idx" ON "voice_ticket_closes" USING btree ("tenant_id","ticket_id");
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_tenant_status_idx" ON "voice_ticket_closes" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_purge_idx" ON "voice_ticket_closes" USING btree ("audio_purge_at");

-- Dedupe key uniqueness per tenant (IndexedDB queue retries) — partial unique
-- so multiple NULLs are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "voice_ticket_closes_tenant_dedupe_uq"
	ON "voice_ticket_closes" USING btree ("tenant_id","client_dedupe_key")
	WHERE "client_dedupe_key" IS NOT NULL;
