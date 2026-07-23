-- PA-045: GL journal entries (flat header-level model).
CREATE TABLE IF NOT EXISTS "journal_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"entry_number" varchar NOT NULL,
	"description" text NOT NULL,
	"entry_date" date NOT NULL,
	"reference" varchar,
	"total_debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_entries_tenant_idx"
	ON "journal_entries" ("tenant_id");
