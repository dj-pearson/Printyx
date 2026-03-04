CREATE TYPE "public"."user_notification_category" AS ENUM('service', 'billing', 'inventory', 'system', 'customer');--> statement-breakpoint
CREATE TYPE "public"."user_notification_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"priority" "user_notification_priority" DEFAULT 'medium' NOT NULL,
	"category" "user_notification_category" DEFAULT 'system' NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"action_url" varchar(500),
	"action_label" varchar(100),
	"metadata" jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
	"tenant_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
	"tenant_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"description" text,
	"hours" integer NOT NULL,
	"entry_date" timestamp NOT NULL,
	"started_at" timestamp,
	"is_running" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar,
	"task_template" jsonb DEFAULT '[]',
	"is_public" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "is_running" boolean DEFAULT false;