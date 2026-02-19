DO $$ BEGIN
  CREATE TYPE "public"."crm_object_type" AS ENUM('deals', 'leads', 'contacts', 'companies', 'opportunities');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."view_visibility" AS ENUM('private', 'team', 'everyone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "board_card_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"pipeline_id" varchar,
	"view_id" varchar,
	"user_id" varchar,
	"card_fields" jsonb,
	"tag_display_enabled" boolean DEFAULT true,
	"max_fields_shown" integer DEFAULT 5,
	"card_style" varchar(20) DEFAULT 'standard',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deal_tag_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deal_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#3B82F6',
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mobile_app_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(100),
	"session_id" varchar(100),
	"platform" varchar(20),
	"app_version" varchar(20),
	"level" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"screen" varchar(100),
	"data" jsonb,
	"log_timestamp" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_layout_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"object_type" "crm_object_type" NOT NULL,
	"role_id" varchar,
	"layout_sections" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_view_pins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"view_id" varchar NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"object_type" "crm_object_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"filter_definition" jsonb,
	"sort_config" jsonb,
	"column_config" jsonb,
	"board_config" jsonb,
	"visibility" "view_visibility" DEFAULT 'private' NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_system_view" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "business_records" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "business_records" ADD COLUMN IF NOT EXISTS "longitude" numeric(11, 8);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_card_configs_tenant_idx" ON "board_card_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_card_configs_pipeline_idx" ON "board_card_configs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_card_configs_tenant_pipeline_idx" ON "board_card_configs" USING btree ("tenant_id","pipeline_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_tag_assignments_deal_idx" ON "deal_tag_assignments" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_tag_assignments_tag_idx" ON "deal_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_tag_assignments_deal_tag_idx" ON "deal_tag_assignments" USING btree ("deal_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_tags_tenant_idx" ON "deal_tags" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_layout_configs_tenant_idx" ON "record_layout_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_layout_configs_tenant_object_idx" ON "record_layout_configs" USING btree ("tenant_id","object_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_view_pins_user_idx" ON "saved_view_pins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_view_pins_view_idx" ON "saved_view_pins" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_view_pins_user_view_idx" ON "saved_view_pins" USING btree ("user_id","view_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_views_tenant_idx" ON "saved_views" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_views_tenant_object_idx" ON "saved_views" USING btree ("tenant_id","object_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_views_user_idx" ON "saved_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_views_tenant_user_object_idx" ON "saved_views" USING btree ("tenant_id","user_id","object_type");