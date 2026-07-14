-- CRMX-011: web forms builder + landing-page lead capture.
--   web_forms             — tenant form definitions (fields/mapping/settings)
--   web_form_submissions  — raw captures, later processed into leads
-- Hand-authored + idempotent (drizzle-kit snapshot in this tree is stale; see
-- 0021/0024/0025/0026). NOT auto-applied; run via db:migrate.

CREATE TABLE IF NOT EXISTS "web_forms" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "settings" jsonb,
  "public_token" varchar NOT NULL,
  "submission_count" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" varchar,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_forms_tenant_idx" ON "web_forms" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_forms_tenant_slug_unique" ON "web_forms" ("tenant_id","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_forms_public_token_idx" ON "web_forms" ("public_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_forms_status_idx" ON "web_forms" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_form_submissions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "form_id" varchar NOT NULL,
  "business_record_id" varchar,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "utm" jsonb,
  "referrer" text,
  "ip_address" varchar,
  "user_agent" text,
  "status" varchar(20) NOT NULL DEFAULT 'new',
  "deduped_to_existing" boolean NOT NULL DEFAULT false,
  "processing_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "processed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_tenant_idx" ON "web_form_submissions" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_form_idx" ON "web_form_submissions" ("form_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_status_idx" ON "web_form_submissions" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_created_at_idx" ON "web_form_submissions" ("created_at");
