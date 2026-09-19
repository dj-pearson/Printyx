CREATE TABLE "suggested_task_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"quote_expiry_window_days" integer DEFAULT 14 NOT NULL,
	"disabled_types" jsonb DEFAULT '[]'::jsonb,
	"sweep_enabled" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggested_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"suggestion_type" varchar(40) NOT NULL,
	"dedupe_key" varchar(200) NOT NULL,
	"record_type" varchar(20) NOT NULL,
	"record_id" varchar NOT NULL,
	"reason" text NOT NULL,
	"action" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"owner_id" varchar,
	"customer_id" varchar,
	"company_name" varchar,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"dismissed_reason" varchar,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suggested_tasks_dedupe_uq" UNIQUE("tenant_id","dedupe_key")
);
--> statement-breakpoint
CREATE INDEX "suggested_tasks_tenant_status_idx" ON "suggested_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "suggested_tasks_tenant_owner_idx" ON "suggested_tasks" USING btree ("tenant_id","owner_id");