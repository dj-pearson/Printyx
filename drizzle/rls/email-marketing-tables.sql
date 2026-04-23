-- ============================================================================
-- email-marketing-tables.sql — create any missing email-marketing tables.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + indexes + unique constraints.
-- Run BEFORE email-marketing.sql (RLS) if your DB was initialized from a
-- baseline that skipped migration 0000.
--
-- DDL mirrors the table definitions in drizzle/migrations/0000_fuzzy_blizzard.sql.
-- ============================================================================

BEGIN;

-- ─── email_templates ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "template_name" varchar NOT NULL,
  "template_description" text,
  "template_type" varchar NOT NULL,
  "subject" varchar NOT NULL,
  "preheader_text" varchar,
  "html_content" text NOT NULL,
  "text_content" text,
  "design_json" jsonb,
  "variable_fields" jsonb,
  "category" varchar,
  "tags" text[],
  "version" integer DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "created_by" varchar NOT NULL,
  "last_modified_by" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "email_templates_name_unique" UNIQUE("tenant_id","template_name")
);
CREATE INDEX IF NOT EXISTS "email_templates_tenant_idx" ON "email_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "email_templates_tenant_type_idx" ON "email_templates" ("tenant_id","template_type");

-- ─── email_campaigns ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "campaign_name" varchar NOT NULL,
  "campaign_description" text,
  "campaign_type" varchar NOT NULL,
  "template_id" varchar,
  "subject" varchar NOT NULL,
  "sender_name" varchar NOT NULL,
  "sender_email" varchar NOT NULL,
  "reply_to_email" varchar,
  "list_ids" text[],
  "segment_criteria" jsonb,
  "exclude_list_ids" text[],
  "sequence_steps" jsonb,
  "current_step" integer DEFAULT 1,
  "schedule_type" varchar NOT NULL,
  "scheduled_date" timestamp,
  "timezone" varchar DEFAULT 'UTC',
  "recurring_pattern" jsonb,
  "status" varchar DEFAULT 'draft' NOT NULL,
  "total_recipients" integer DEFAULT 0,
  "emails_sent" integer DEFAULT 0,
  "emails_delivered" integer DEFAULT 0,
  "emails_opened" integer DEFAULT 0,
  "emails_clicked" integer DEFAULT 0,
  "emails_bounced" integer DEFAULT 0,
  "emails_unsubscribed" integer DEFAULT 0,
  "emails_spam_reported" integer DEFAULT 0,
  "delivery_rate" numeric(5, 2),
  "open_rate" numeric(5, 2),
  "click_rate" numeric(5, 2),
  "bounce_rate" numeric(5, 2),
  "unsubscribe_rate" numeric(5, 2),
  "is_ab_test" boolean DEFAULT false,
  "ab_test_variants" jsonb,
  "winning_variant" varchar,
  "sendgrid_campaign_id" varchar,
  "owner_id" varchar NOT NULL,
  "created_by" varchar NOT NULL,
  "sent_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "email_campaigns_name_unique" UNIQUE("tenant_id","campaign_name")
);
CREATE INDEX IF NOT EXISTS "email_campaigns_tenant_idx" ON "email_campaigns" ("tenant_id");
CREATE INDEX IF NOT EXISTS "email_campaigns_tenant_status_idx" ON "email_campaigns" ("tenant_id","status");

-- ─── email_sends ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_sends" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "campaign_id" varchar NOT NULL,
  "template_id" varchar,
  "recipient_email" varchar NOT NULL,
  "recipient_name" varchar,
  "contact_id" varchar,
  "subject" varchar NOT NULL,
  "html_content" text,
  "text_content" text,
  "merge_data" jsonb,
  "status" varchar DEFAULT 'pending' NOT NULL,
  "sendgrid_message_id" varchar,
  "provider_status" varchar,
  "provider_response" jsonb,
  "error_message" text,
  "error_code" varchar,
  "bounce_type" varchar,
  "bounce_reason" text,
  "queued_at" timestamp,
  "sent_at" timestamp,
  "delivered_at" timestamp,
  "bounced_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_sends_tenant_idx" ON "email_sends" ("tenant_id");
CREATE INDEX IF NOT EXISTS "email_sends_campaign_idx" ON "email_sends" ("campaign_id");
CREATE INDEX IF NOT EXISTS "email_sends_sendgrid_msg_idx" ON "email_sends" ("sendgrid_message_id");
CREATE INDEX IF NOT EXISTS "email_sends_tenant_recipient_idx" ON "email_sends" ("tenant_id","recipient_email");

-- ─── email_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "email_send_id" varchar NOT NULL,
  "campaign_id" varchar NOT NULL,
  "event_type" varchar NOT NULL,
  "event_timestamp" timestamp NOT NULL,
  "clicked_url" text,
  "link_label" varchar,
  "user_agent" text,
  "ip_address" varchar,
  "device_type" varchar,
  "email_client" varchar,
  "operating_system" varchar,
  "country" varchar,
  "city" varchar,
  "sendgrid_event_id" varchar,
  "provider_data" jsonb,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_events_tenant_send_idx" ON "email_events" ("tenant_id","email_send_id");
CREATE INDEX IF NOT EXISTS "email_events_tenant_campaign_idx" ON "email_events" ("tenant_id","campaign_id","event_type");
CREATE INDEX IF NOT EXISTS "email_events_tenant_timestamp_idx" ON "email_events" ("tenant_id","event_timestamp");

-- ─── email_lists ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_lists" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "list_name" varchar NOT NULL,
  "list_description" text,
  "list_type" varchar NOT NULL,
  "segment_criteria" jsonb,
  "tags" text[],
  "category" varchar,
  "is_active" boolean DEFAULT true,
  "total_members" integer DEFAULT 0,
  "active_members" integer DEFAULT 0,
  "unsubscribed_members" integer DEFAULT 0,
  "owner_id" varchar NOT NULL,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "email_lists_name_unique" UNIQUE("tenant_id","list_name")
);
CREATE INDEX IF NOT EXISTS "email_lists_tenant_idx" ON "email_lists" ("tenant_id");

-- ─── email_list_members ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_list_members" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "list_id" varchar NOT NULL,
  "email" varchar NOT NULL,
  "contact_id" varchar,
  "first_name" varchar,
  "last_name" varchar,
  "company" varchar,
  "custom_fields" jsonb,
  "tags" text[],
  "status" varchar DEFAULT 'active' NOT NULL,
  "subscription_source" varchar,
  "engagement_score" integer DEFAULT 0,
  "last_email_opened" timestamp,
  "last_email_clicked" timestamp,
  "subscribed_at" timestamp DEFAULT now(),
  "unsubscribed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "email_list_members_unique" UNIQUE("list_id","email")
);
CREATE INDEX IF NOT EXISTS "email_list_members_tenant_list_idx" ON "email_list_members" ("tenant_id","list_id");
CREATE INDEX IF NOT EXISTS "email_list_members_tenant_email_idx" ON "email_list_members" ("tenant_id","email");

-- ─── email_unsubscribes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_unsubscribes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "email" varchar NOT NULL,
  "contact_id" varchar,
  "unsubscribe_type" varchar NOT NULL,
  "campaign_id" varchar,
  "list_id" varchar,
  "reason" varchar,
  "feedback_text" text,
  "unsubscribe_method" varchar,
  "email_send_id" varchar,
  "user_agent" text,
  "ip_address" varchar,
  "unsubscribed_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "email_unsubscribes_unique" UNIQUE("tenant_id","email","unsubscribe_type")
);
CREATE INDEX IF NOT EXISTS "email_unsubscribes_tenant_email_idx" ON "email_unsubscribes" ("tenant_id","email");

COMMIT;
