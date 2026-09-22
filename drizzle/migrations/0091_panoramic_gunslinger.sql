CREATE TABLE "fleet_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deal_id" varchar,
	"customer_id" varchar NOT NULL,
	"name" varchar(200),
	"term_months" integer DEFAULT 36 NOT NULL,
	"current_state" jsonb NOT NULL,
	"proposed_fleet" jsonb,
	"proposed_state" jsonb,
	"comparison" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fleet_assessments_tenant_deal_idx" ON "fleet_assessments" USING btree ("tenant_id","deal_id");--> statement-breakpoint
CREATE INDEX "fleet_assessments_tenant_customer_idx" ON "fleet_assessments" USING btree ("tenant_id","customer_id");