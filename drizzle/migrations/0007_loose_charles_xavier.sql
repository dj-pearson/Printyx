CREATE TABLE "integration_sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"sync_type" varchar(16) DEFAULT 'pull' NOT NULL,
	"entity_type" varchar(64),
	"status" varchar(24) DEFAULT 'in_progress' NOT NULL,
	"records_fetched" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "integration_webhooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"integration_id" varchar NOT NULL,
	"webhook_url" text NOT NULL,
	"event_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"integration_key" varchar(64) NOT NULL,
	"integration_name" varchar(128) NOT NULL,
	"category" varchar(32) NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_mappings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sync_frequency" varchar(32) DEFAULT 'manual' NOT NULL,
	"status" varchar(32) DEFAULT 'configured' NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_status" varchar(32),
	"last_error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"event" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"error_message" text,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(128) NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" text NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"retry_count" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "integration_sync_logs_integration_idx" ON "integration_sync_logs" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "integration_sync_logs_tenant_started_idx" ON "integration_sync_logs" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "integration_webhooks_tenant_idx" ON "integration_webhooks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "integration_webhooks_integration_idx" ON "integration_webhooks" USING btree ("integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_integrations_tenant_key_unique" ON "platform_integrations" USING btree ("tenant_id","integration_key");--> statement-breakpoint
CREATE INDEX "platform_integrations_tenant_idx" ON "platform_integrations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "platform_integrations_status_idx" ON "platform_integrations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "webhook_logs_webhook_idx" ON "webhook_logs" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_logs_tenant_idx" ON "webhook_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "webhooks_tenant_idx" ON "webhooks" USING btree ("tenant_id");