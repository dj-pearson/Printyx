-- CRMX-006: first-class Notes + generic polymorphic associations.
-- Hand-authored + idempotent (drizzle-kit snapshot in this tree is stale; see 0021).
-- NOT auto-applied; run via db:migrate.

CREATE TABLE IF NOT EXISTS "crm_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"parent_type" varchar(20) NOT NULL,
	"parent_id" varchar NOT NULL,
	"body" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"author_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_notes_tenant_parent_idx"
  ON "crm_notes" ("tenant_id","parent_type","parent_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_associations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_id" varchar NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" varchar NOT NULL,
	"relation" varchar(40) DEFAULT 'related' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_associations_link_uq" UNIQUE("tenant_id","source_type","source_id","target_type","target_id","relation")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_associations_tenant_source_idx"
  ON "crm_associations" ("tenant_id","source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_associations_tenant_target_idx"
  ON "crm_associations" ("tenant_id","target_type","target_id");
