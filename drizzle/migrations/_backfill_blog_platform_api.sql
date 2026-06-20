-- US-BLOG-079..085: Universal Blog System platform/infra tables.
--   079 webhooks:      blog_webhooks, blog_webhook_deliveries
--   080 public API:    blog_api_keys, blog_api_usage
--   081 backup/export: blog_backups, blog_backup_config
--   083 white-label:   blog_widget_config
--   084 compliance:    blog_dsar_requests
-- FKs to existing blog tables are declared here (NOT in the Drizzle schema file).
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_platform_api.sql

-- ---------------------------------------------------------------------------
-- US-BLOG-079 — webhooks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" varchar(2000) NOT NULL,
	"encrypted_secret" jsonb,
	"event_filter" varchar(60)[],
	"retry_policy" jsonb,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_webhooks_tenant_idx"
	ON "blog_webhooks" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_webhooks_tenant_active_idx"
	ON "blog_webhooks" USING btree ("tenant_id","is_active");

CREATE TABLE IF NOT EXISTS "blog_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"webhook_id" uuid NOT NULL REFERENCES "blog_webhooks"("id") ON DELETE CASCADE,
	"event_type" varchar(60) NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" varchar(128),
	"status" varchar(20) NOT NULL DEFAULT 'pending',
	"attempt_count" integer NOT NULL DEFAULT 0,
	"max_attempts" integer NOT NULL DEFAULT 5,
	"last_response_status" integer,
	"last_response_body" varchar(2000),
	"next_attempt_at" timestamp,
	"delivered_at" timestamp,
	"attempts" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_webhook_deliveries_tenant_idx"
	ON "blog_webhook_deliveries" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_webhook_deliveries_webhook_idx"
	ON "blog_webhook_deliveries" USING btree ("webhook_id");
CREATE INDEX IF NOT EXISTS "blog_webhook_deliveries_status_idx"
	ON "blog_webhook_deliveries" USING btree ("status","next_attempt_at");

-- ---------------------------------------------------------------------------
-- US-BLOG-080 — public API keys + usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"key_prefix" varchar(32) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scopes" varchar(40)[],
	"rate_limit_per_minute" integer NOT NULL DEFAULT 120,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_api_keys_tenant_idx"
	ON "blog_api_keys" USING btree ("tenant_id");
-- Hash lookup resolves key -> tenant, so it is globally unique + indexed alone.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_api_keys_hash_idx"
	ON "blog_api_keys" USING btree ("key_hash");

CREATE TABLE IF NOT EXISTS "blog_api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"api_key_id" uuid NOT NULL REFERENCES "blog_api_keys"("id") ON DELETE CASCADE,
	"window_start" timestamp NOT NULL,
	"request_count" integer NOT NULL DEFAULT 0,
	"last_endpoint" varchar(200),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_api_usage_tenant_idx"
	ON "blog_api_usage" USING btree ("tenant_id");
-- One counter per (key, minute window); upsert target.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_api_usage_key_window_idx"
	ON "blog_api_usage" USING btree ("api_key_id","window_start");

-- ---------------------------------------------------------------------------
-- US-BLOG-081 — backups + backup config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"kind" varchar(20) NOT NULL DEFAULT 'manual',
	"status" varchar(20) NOT NULL DEFAULT 'pending',
	"manifest" jsonb,
	"storage_key" varchar(500),
	"size_bytes" integer,
	"expires_at" timestamp,
	"error" varchar(2000),
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_backups_tenant_idx"
	ON "blog_backups" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_backups_tenant_status_idx"
	ON "blog_backups" USING btree ("tenant_id","status");

CREATE TABLE IF NOT EXISTS "blog_backup_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"scheduled_enabled" boolean NOT NULL DEFAULT false,
	"retention_days" integer NOT NULL DEFAULT 30,
	"storage_config" jsonb,
	"encrypted_storage_creds" jsonb,
	"last_backup_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

-- One backup config row per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_backup_config_tenant_idx"
	ON "blog_backup_config" USING btree ("tenant_id");

-- ---------------------------------------------------------------------------
-- US-BLOG-083 — white-label / widget config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_widget_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"hide_branding" boolean NOT NULL DEFAULT false,
	"logo_url" varchar(2000),
	"theme" varchar(40) NOT NULL DEFAULT 'light',
	"css_variables" jsonb,
	"encrypted_sso_secret" jsonb,
	"sso_session_ttl_seconds" integer NOT NULL DEFAULT 3600,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_widget_config_tenant_idx"
	ON "blog_widget_config" USING btree ("tenant_id");

-- ---------------------------------------------------------------------------
-- US-BLOG-084 — DSAR request log (GDPR/CCPA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_dsar_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subject_user_id" varchar NOT NULL,
	"request_type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL DEFAULT 'requested',
	"result" jsonb,
	"error" varchar(2000),
	"requested_at" timestamp NOT NULL DEFAULT now(),
	"completed_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_dsar_requests_tenant_idx"
	ON "blog_dsar_requests" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_dsar_requests_subject_idx"
	ON "blog_dsar_requests" USING btree ("subject_user_id");
