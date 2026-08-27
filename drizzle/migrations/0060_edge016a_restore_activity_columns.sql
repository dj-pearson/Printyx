DROP INDEX "client_activity_logs_tenant_client_idx";--> statement-breakpoint
DROP INDEX "client_activity_logs_event_type_idx";--> statement-breakpoint
DROP INDEX "client_activity_logs_timestamp_idx";--> statement-breakpoint
DROP INDEX "client_activity_logs_severity_idx";--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "tenant_id" SET DATA TYPE uuid;--> statement-breakpoint
-- EDGE-016a: text does not cast to uuid implicitly. A row holding a non-uuid
-- client_id fails here, which is correct — it could not satisfy the foreign key
-- restored below either.
ALTER TABLE "client_activity_logs" ALTER COLUMN "client_id" SET DATA TYPE uuid USING "client_id"::uuid;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "event_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "severity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "severity" DROP NOT NULL;--> statement-breakpoint
-- EDGE-016a: added WITH a transitional default and then without one. A bare
-- ADD COLUMN ... NOT NULL fails on a table that has rows, and any row already
-- here was written before 0001 dropped these columns — 'unknown' is the honest
-- value for it, not a guess at what the activity was.
ALTER TABLE "client_activity_logs" ADD COLUMN "activity" varchar(100) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "activity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "status" varchar(50) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "devices_in_submission" jsonb DEFAULT '0'::jsonb;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "metrics_count" jsonb DEFAULT '0'::jsonb;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "error_code" varchar(50);--> statement-breakpoint
-- EDGE-016a: 0001 dropped this constraint. It is added back plainly rather than
-- guarded, because skipping it silently would leave the drift this story exists
-- to close. If it fails on an environment with orphaned rows, that is the
-- finding; clear them first with
--   DELETE FROM client_activity_logs a
--    WHERE NOT EXISTS (SELECT 1 FROM monitoring_clients c WHERE c.id = a.client_id);
-- Orphans are unlikely: every write to this table has errored since 0001.
ALTER TABLE "client_activity_logs" ADD CONSTRAINT "client_activity_logs_client_id_monitoring_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."monitoring_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_tenant_time_idx" ON "client_activity_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "client_activity_time_idx" ON "client_activity_logs" USING btree ("client_id","timestamp");--> statement-breakpoint
CREATE INDEX "client_activity_idx" ON "client_activity_logs" USING btree ("activity");--> statement-breakpoint
CREATE INDEX "client_activity_status_idx" ON "client_activity_logs" USING btree ("status");