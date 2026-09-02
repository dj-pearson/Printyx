-- Preventive maintenance gets its tables written down (WF-V-04).
--
-- supabase/functions/maintenance/ has read and written maintenance_schedules and
-- maintenance_records since it shipped and NEITHER EXISTED in any schema or
-- migration - both were among the undeclared relations in
-- docs/phantom-tables-baseline.json. The columns below are exactly the ones that
-- function reads and writes, recovered from its queries rather than designed
-- fresh: changing the shape would have meant rewriting a working handler to match
-- a table nobody had written down.
--
-- IF NOT EXISTS throughout, in COP-M00's reconciliation idiom. This environment has
-- no credentials for the live project, so it cannot be confirmed whether db:push
-- already created these there - and that is precisely the case this form is for.
-- If they exist live with a different shape, this migration will not correct it;
-- run npm run check:phantom-cols against the deploy before assuming it did.
--
-- The other half of the story was the fixture router: server/routes-preventive-
-- maintenance.ts answered /api/maintenance/* from hard-coded samples whose own
-- comments said "until schema is updated", and it was never registered, so it was
-- dead in dev too. It is deleted and /api/maintenance is proxied.

CREATE TABLE IF NOT EXISTS "maintenance_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"schedule_id" varchar,
	"equipment_id" varchar NOT NULL,
	"maintenance_type" varchar,
	"completed_by" varchar,
	"completed_at" timestamp NOT NULL,
	"notes" text,
	"parts_used" jsonb,
	"labor_hours" numeric(6, 2),
	"cost" numeric(12, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"equipment_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"maintenance_type" varchar DEFAULT 'preventive' NOT NULL,
	"frequency" varchar DEFAULT 'monthly' NOT NULL,
	"frequency_value" integer DEFAULT 1 NOT NULL,
	"next_due_date" timestamp NOT NULL,
	"last_completed_date" timestamp,
	"assigned_to" varchar,
	"estimated_duration" integer,
	"checklist" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_records_tenant_completed_idx" ON "maintenance_records" USING btree ("tenant_id","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_schedules_tenant_due_idx" ON "maintenance_schedules" USING btree ("tenant_id","next_due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_schedules_tenant_equipment_idx" ON "maintenance_schedules" USING btree ("tenant_id","equipment_id");