-- CRMX-003: Custom fields framework — user-defined fields on canonical CRM objects.
-- Values are stored on each object's existing `customFields` jsonb column, keyed by `key`.
--
-- NOTE: hand-authored. The drizzle-kit meta snapshot in this tree is stale (journal
-- stops at idx 0011 while committed SQL runs to 0020), so `drizzle-kit generate`
-- emits a polluted multi-table diff. Reconciling the snapshot is a separate task;
-- this migration is idempotent and safe to apply on its own.

DO $$ BEGIN
  CREATE TYPE "public"."custom_field_object_type" AS ENUM('deals', 'leads', 'contacts', 'companies');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url', 'email');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"object_type" "custom_field_object_type" NOT NULL,
	"key" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_definitions_tenant_object_key_uq" UNIQUE("tenant_id","object_type","key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_field_definitions_tenant_object_idx"
  ON "custom_field_definitions" ("tenant_id","object_type");
