CREATE TABLE IF NOT EXISTS "disposable_email_domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(255) NOT NULL,
	"is_blocked" boolean DEFAULT true NOT NULL,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"notes" text,
	"added_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "disposable_email_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disposable_email_domains_is_blocked_idx" ON "disposable_email_domains" USING btree ("is_blocked");
