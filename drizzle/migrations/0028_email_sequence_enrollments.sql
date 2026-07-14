-- CRMX-009: per-recipient email sequence (drip) enrollment + state.
-- Hand-authored + idempotent (drizzle-kit snapshot in this tree is stale; see
-- 0021/0024/0025/0026/0027). NOT auto-applied; run via db:migrate.

CREATE TABLE IF NOT EXISTS "email_sequence_enrollments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "campaign_id" varchar NOT NULL,
  "recipient_email" varchar NOT NULL,
  "business_record_id" varchar,
  "contact_id" varchar,
  "current_step" integer NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "next_send_at" timestamp,
  "last_sent_at" timestamp,
  "stopped_reason" text,
  "send_count" integer NOT NULL DEFAULT 0,
  "history" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "enrolled_by" varchar,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_tenant_idx" ON "email_sequence_enrollments" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_campaign_idx" ON "email_sequence_enrollments" ("campaign_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_status_idx" ON "email_sequence_enrollments" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_next_send_idx" ON "email_sequence_enrollments" ("next_send_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_seq_enroll_campaign_email_unique" ON "email_sequence_enrollments" ("campaign_id","recipient_email");
