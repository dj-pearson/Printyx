-- US-SUPER-002: SMS/photo meter reads with vision extraction — submissions + settings.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_meter_read_vision.sql

CREATE TABLE IF NOT EXISTS "meter_read_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source" varchar(12) NOT NULL DEFAULT 'manual',
	"from_phone" varchar,
	"customer_id" varchar,
	"machine_id" varchar,
	"raw_image_url" varchar,
	"image_hash" varchar,
	"extracted_values" jsonb,
	"validation_status" varchar(16) NOT NULL DEFAULT 'pending',
	"validation_detail" jsonb,
	"outbound_message" varchar(1000),
	"meter_reading_id" varchar,
	"submitted_at" timestamp NOT NULL DEFAULT now(),
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "meter_read_submissions_tenant_idx" ON "meter_read_submissions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "meter_read_submissions_tenant_status_idx" ON "meter_read_submissions" USING btree ("tenant_id","validation_status");
CREATE INDEX IF NOT EXISTS "meter_read_submissions_tenant_hash_idx" ON "meter_read_submissions" USING btree ("tenant_id","image_hash");

CREATE TABLE IF NOT EXISTS "meter_read_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"max_delta_multiplier" integer NOT NULL DEFAULT 3,
	"confirm_template" varchar(1000),
	"clarify_template" varchar(1000),
	"encrypted_config" jsonb,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);
