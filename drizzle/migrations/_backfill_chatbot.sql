-- US-SUPER-014: Slack/Teams NL Printyx bot (read-only) — connections + user links + query log.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_chatbot.sql

CREATE TABLE IF NOT EXISTS "chatbot_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(12) NOT NULL,
	"team_id" varchar NOT NULL,
	"team_name" varchar,
	"encrypted_tokens" jsonb,
	"enabled" boolean NOT NULL DEFAULT true,
	"installed_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "chatbot_connections_tenant_idx" ON "chatbot_connections" USING btree ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_connections_tenant_platform_team_uq" ON "chatbot_connections" USING btree ("tenant_id","platform","team_id");

CREATE TABLE IF NOT EXISTS "chatbot_user_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(12) NOT NULL,
	"platform_user_id" varchar NOT NULL,
	"email" varchar,
	"printyx_user_id" varchar,
	"verified" boolean NOT NULL DEFAULT false,
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_user_links_tenant_platform_user_uq" ON "chatbot_user_links" USING btree ("tenant_id","platform","platform_user_id");

CREATE TABLE IF NOT EXISTS "chatbot_query_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(12),
	"channel" varchar,
	"platform_user_id" varchar,
	"printyx_user_id" varchar,
	"question" varchar(2000),
	"tools_called" jsonb,
	"response_excerpt" varchar(2000),
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "chatbot_query_log_tenant_idx" ON "chatbot_query_log" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "chatbot_query_log_tenant_created_idx" ON "chatbot_query_log" USING btree ("tenant_id","created_at");
