-- AUDIT-032: 21 tables declared tenant_id as integer while tenants.id is a
-- varchar uuid, so neither a read nor a write could name a real tenant.
--
--   SELECT ... WHERE tenant_id = '<uuid>'  -> 22P02 invalid input syntax for
--                                             type integer
--   INSERT ... (tenant_id) VALUES ('<uuid>') -> 42804 column is of type integer
--                                               but expression is of type
--                                               character varying
--
-- Both reproduced against Postgres 16. Under PostgREST the read error leaves
-- .data null, and this codebase writes `?? []` / `|| 0` around it, so the
-- symptom was an empty dashboard rather than an error - which is why several of
-- these tables were recorded as "nothing writes to them" when the truth is that
-- nothing could.
--
-- No row can exist that this conversion would lose: every insert that named a
-- tenant failed, and an integer tenant id matches no tenants.id. USING makes it
-- explicit anyway.
--
-- The inbound_webhook_events CREATE is not drift. INTEG-WEBHOOK-001 shipped that
-- table as an unjournaled hand-run file (drizzle/migrations/_inbound_webhook_events.sql),
-- which drizzle-kit correctly reports as missing from the chain. It is folded in
-- here rather than hand-edited out, because editing statements out of a
-- generated migration is what left the snapshot and the database disagreeing in
-- COP-M00. Everything below is idempotent so it is safe on a database where the
-- hand-run file was already applied.

CREATE TABLE IF NOT EXISTS "inbound_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"provider" varchar(64) NOT NULL,
	"event_type" varchar(128) DEFAULT '' NOT NULL,
	"external_event_id" varchar(128),
	"external_account_id" varchar(128),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'received' NOT NULL,
	"processing_error" text,
	"processed_at" timestamp,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_supply_orders" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "client_collected_metrics" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "client_registrations" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "device_meter_history" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "monitored_devices" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "supply_monitoring" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "supply_replenishment_analytics" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "supply_replenishment_rules" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "supply_usage_history" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "toner_alerts" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "contract_renewal_tracking" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "document_field_mappings" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "document_notifications" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "document_templates" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "document_uploads" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "document_workflow_actions" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "generated_documents" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "renewal_analytics" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "renewal_automation_rules" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "renewal_communication_log" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
ALTER TABLE "renewal_proposals" ALTER COLUMN "tenant_id" SET DATA TYPE varchar USING "tenant_id"::varchar;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_webhook_events_provider_idx" ON "inbound_webhook_events" USING btree ("provider","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_webhook_events_status_idx" ON "inbound_webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_webhook_events_tenant_idx" ON "inbound_webhook_events" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inbound_webhook_events_dedupe_idx" ON "inbound_webhook_events" USING btree ("provider","external_event_id");