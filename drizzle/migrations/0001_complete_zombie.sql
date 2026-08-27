ALTER TABLE "billing_disputes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_memos" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_content_queue" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_maintenance_appointments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_analytics" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_questions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_responses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_service_request_status_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "technician_availability_slots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_bookmarks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_ratings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_votes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reading_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "billing_disputes" CASCADE;--> statement-breakpoint
DROP TABLE "credit_memos" CASCADE;--> statement-breakpoint
DROP TABLE "blog_content_queue" CASCADE;--> statement-breakpoint
DROP TABLE "customer_maintenance_appointments" CASCADE;--> statement-breakpoint
DROP TABLE "customer_satisfaction_analytics" CASCADE;--> statement-breakpoint
DROP TABLE "customer_satisfaction_survey_questions" CASCADE;--> statement-breakpoint
DROP TABLE "customer_satisfaction_survey_responses" CASCADE;--> statement-breakpoint
DROP TABLE "customer_satisfaction_survey_templates" CASCADE;--> statement-breakpoint
DROP TABLE "customer_satisfaction_surveys" CASCADE;--> statement-breakpoint
DROP TABLE "customer_service_request_status_history" CASCADE;--> statement-breakpoint
DROP TABLE "technician_availability_slots" CASCADE;--> statement-breakpoint
DROP TABLE "article_bookmarks" CASCADE;--> statement-breakpoint
DROP TABLE "article_ratings" CASCADE;--> statement-breakpoint
DROP TABLE "article_votes" CASCADE;--> statement-breakpoint
DROP TABLE "reading_history" CASCADE;--> statement-breakpoint
ALTER TABLE "client_activity_logs" DROP CONSTRAINT "client_activity_logs_client_id_monitoring_clients_id_fk";
--> statement-breakpoint
DROP INDEX "client_tenant_time_idx";--> statement-breakpoint
DROP INDEX "client_activity_time_idx";--> statement-breakpoint
DROP INDEX "client_activity_idx";--> statement-breakpoint
DROP INDEX "client_activity_status_idx";--> statement-breakpoint
-- PA-032: two statements removed here. `serial` is not a TYPE — it is shorthand
-- for integer plus a sequence — so `SET DATA TYPE serial` is invalid SQL that
-- Postgres has always rejected, and `tenant_id` to integer had no USING clause
-- and could not cast either. Both also contradict the schema as it stands:
-- client_activity_logs.id and .tenant_id are uuid, which is what 0000 already
-- creates. They never executed anywhere; removing them is what lets this
-- migration apply to an empty database. The `id DROP DEFAULT` that sat between
-- them goes with them: it existed only because a serial column takes its default
-- from a sequence, and the schema wants defaultRandom() on that uuid.
ALTER TABLE "client_activity_logs" ALTER COLUMN "client_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "purchase_order_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "unit_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "total_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "po_number" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "vendor_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "order_date" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "order_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "total_amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "total_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "created_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "event_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "event_data" jsonb;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD COLUMN "severity" text DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "line_number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "item_description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "item_code" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "requested_by" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "expected_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "subtotal" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "tax_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "shipping_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "delivery_address" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "special_instructions" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_by" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_date" timestamp;--> statement-breakpoint
CREATE INDEX "client_activity_logs_tenant_client_idx" ON "client_activity_logs" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "client_activity_logs_event_type_idx" ON "client_activity_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "client_activity_logs_timestamp_idx" ON "client_activity_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "client_activity_logs_severity_idx" ON "client_activity_logs" USING btree ("severity");--> statement-breakpoint
ALTER TABLE "client_activity_logs" DROP COLUMN "activity";--> statement-breakpoint
ALTER TABLE "client_activity_logs" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "client_activity_logs" DROP COLUMN "details";--> statement-breakpoint
ALTER TABLE "client_activity_logs" DROP COLUMN "devices_in_submission";--> statement-breakpoint
ALTER TABLE "client_activity_logs" DROP COLUMN "metrics_count";--> statement-breakpoint
ALTER TABLE "client_activity_logs" DROP COLUMN "error_code";--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP COLUMN "serial_number";--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "expected_delivery_date";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "notes";--> statement-breakpoint
-- PA-032: the three DROP DEFAULTs below are added. A column default keeps
-- depending on the enum after the column itself is switched to text — it stays
-- as 'json'::export_format — so DROP TYPE failed with "cannot drop type
-- export_format because other objects depend on it" and the whole rewrite
-- unravelled from there. drizzle-kit does not emit them. The defaults are
-- restored after the type is recreated; all three values are members of the new
-- enum, so they survive the round trip unchanged.
ALTER TABLE "public"."data_export_templates" ALTER COLUMN "format" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."personal_data_exports" ALTER COLUMN "format" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."report_schedules" ALTER COLUMN "export_format" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."data_export_templates" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."personal_data_exports" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."report_executions" ALTER COLUMN "export_format" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."report_schedules" ALTER COLUMN "export_format" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."export_format";--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('json', 'csv', 'xlsx', 'pdf');--> statement-breakpoint
ALTER TABLE "public"."data_export_templates" ALTER COLUMN "format" SET DATA TYPE "public"."export_format" USING "format"::"public"."export_format";--> statement-breakpoint
ALTER TABLE "public"."personal_data_exports" ALTER COLUMN "format" SET DATA TYPE "public"."export_format" USING "format"::"public"."export_format";--> statement-breakpoint
ALTER TABLE "public"."report_executions" ALTER COLUMN "export_format" SET DATA TYPE "public"."export_format" USING "export_format"::"public"."export_format";--> statement-breakpoint
ALTER TABLE "public"."report_schedules" ALTER COLUMN "export_format" SET DATA TYPE "public"."export_format" USING "export_format"::"public"."export_format";--> statement-breakpoint
-- PA-032: restore the defaults dropped above, now that the enum exists again.
ALTER TABLE "public"."data_export_templates" ALTER COLUMN "format" SET DEFAULT 'json';--> statement-breakpoint
ALTER TABLE "public"."personal_data_exports" ALTER COLUMN "format" SET DEFAULT 'json';--> statement-breakpoint
ALTER TABLE "public"."report_schedules" ALTER COLUMN "export_format" SET DEFAULT 'pdf';--> statement-breakpoint
DROP TYPE "public"."blog_content_queue_status";--> statement-breakpoint
DROP TYPE "public"."appointment_status";--> statement-breakpoint
DROP TYPE "public"."equipment_health_status";--> statement-breakpoint
DROP TYPE "public"."maintenance_type";--> statement-breakpoint
DROP TYPE "public"."period_type";--> statement-breakpoint
DROP TYPE "public"."satisfaction_question_type";--> statement-breakpoint
DROP TYPE "public"."satisfaction_response_status";--> statement-breakpoint
DROP TYPE "public"."satisfaction_survey_type";--> statement-breakpoint
DROP TYPE "public"."usage_type";