CREATE TABLE "forecast_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"owner_id" varchar,
	"commit_one_time_value" numeric(14, 2),
	"best_case_one_time_value" numeric(14, 2),
	"pipeline_one_time_value" numeric(14, 2),
	"commit_recurring_monthly_value" numeric(14, 2),
	"deal_count" integer,
	"uncategorized_count" integer,
	"captured_by" varchar,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "forecast_snapshots_tenant_period_idx" ON "forecast_snapshots" USING btree ("tenant_id","period_start");--> statement-breakpoint
CREATE INDEX "forecast_snapshots_tenant_owner_idx" ON "forecast_snapshots" USING btree ("tenant_id","owner_id");