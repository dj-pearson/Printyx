CREATE TABLE "sales_playbook_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"playbook_id" varchar NOT NULL,
	"parent_type" varchar(20) NOT NULL,
	"parent_id" varchar NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb,
	"write_back_log" jsonb,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"started_by" varchar,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "sales_playbook_runs_record_uq" UNIQUE("tenant_id","playbook_id","parent_type","parent_id")
);
--> statement-breakpoint
CREATE TABLE "sales_playbooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(160) NOT NULL,
	"motion" varchar(60),
	"description" text,
	"applies_to" varchar(20) DEFAULT 'deal' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb,
	"trigger_stage_id" varchar,
	"gates_stage_advance" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sales_playbook_runs_tenant_record_idx" ON "sales_playbook_runs" USING btree ("tenant_id","parent_type","parent_id");--> statement-breakpoint
CREATE INDEX "sales_playbooks_tenant_active_idx" ON "sales_playbooks" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "sales_playbooks_tenant_trigger_idx" ON "sales_playbooks" USING btree ("tenant_id","trigger_stage_id");