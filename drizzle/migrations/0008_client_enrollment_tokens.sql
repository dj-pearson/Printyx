-- Adds the client_enrollment_tokens table used by the monitoring-client
-- bootstrap flow. An admin generates a one-time token in the platform UI;
-- the installer redeems it at install time over HTTPS to receive its
-- permanent API key (never embeds the key in a downloaded artifact).
--
-- Tokens are stored as SHA-256 hashes so a database leak does not
-- compromise active enrollments. `used_at` enforces single-use.
--
-- This migration is defensive: if the prerequisite `monitoring_clients`
-- table or its enum types do not exist (because the 0000 baseline was
-- never applied to this database), we create them here. On a database
-- that already has them via 0000, the IF NOT EXISTS guards make these
-- statements no-ops.

-- Prerequisite enums --------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "public"."client_status" AS ENUM ('active','inactive','error','pending_setup');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."client_type" AS ENUM ('on_premise','cloud','hybrid');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Prerequisite table: monitoring_clients ------------------------------
CREATE TABLE IF NOT EXISTS "monitoring_clients" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL,
    "client_id" varchar(100) NOT NULL,
    "client_name" varchar(255) NOT NULL,
    "client_type" "client_type" DEFAULT 'on_premise' NOT NULL,
    "status" "client_status" DEFAULT 'pending_setup' NOT NULL,
    "api_key" varchar(255) NOT NULL,
    "api_key_last_rotated" timestamp,
    "version" varchar(50),
    "hostname" varchar(255),
    "ip_address" varchar(45),
    "network_ranges" text[],
    "configuration" jsonb DEFAULT '{"pollingInterval":300,"discoveryEnabled":true,"retryAttempts":3,"timeout":10000,"tonerThreshold":15,"paperThreshold":20}'::jsonb,
    "last_heartbeat" timestamp,
    "last_successful_collection" timestamp,
    "total_devices_monitored" jsonb DEFAULT '0'::jsonb,
    "total_metrics_collected" jsonb DEFAULT '0'::jsonb,
    "description" text,
    "location" varchar(255),
    "contact_email" varchar(255),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "monitoring_clients_client_id_unique" UNIQUE ("client_id"),
    CONSTRAINT "monitoring_clients_api_key_unique"   UNIQUE ("api_key")
);

CREATE INDEX IF NOT EXISTS "tenant_client_idx"      ON "monitoring_clients" ("tenant_id","client_id");
CREATE INDEX IF NOT EXISTS "client_status_idx"      ON "monitoring_clients" ("status");
CREATE INDEX IF NOT EXISTS "client_heartbeat_idx"   ON "monitoring_clients" ("last_heartbeat");
CREATE INDEX IF NOT EXISTS "client_api_key_idx"     ON "monitoring_clients" ("api_key");

-- Main table: client_enrollment_tokens --------------------------------
CREATE TABLE IF NOT EXISTS "client_enrollment_tokens" (
    "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id"           uuid                       NOT NULL,
    "client_id"           uuid                       NOT NULL,
    "token_hash"          varchar(64)                NOT NULL,
    "created_by_user_id"  varchar(255),
    "expires_at"          timestamp                  NOT NULL,
    "used_at"             timestamp,
    "used_from_ip"        varchar(45),
    "used_from_hostname"  varchar(255),
    "revoked_at"          timestamp,
    "created_at"          timestamp DEFAULT now()    NOT NULL,
    CONSTRAINT "client_enrollment_tokens_token_hash_unique" UNIQUE ("token_hash")
);

-- FK is added separately so the script doesn't fail if the constraint
-- already exists from a previous attempt. Postgres has no IF NOT EXISTS
-- for constraints, so we drop-then-add inside a DO block.
DO $$ BEGIN
    ALTER TABLE "client_enrollment_tokens"
        ADD CONSTRAINT "client_enrollment_tokens_client_id_fk"
        FOREIGN KEY ("client_id")
        REFERENCES "monitoring_clients"("id")
        ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "enrollment_tenant_idx"     ON "client_enrollment_tokens" ("tenant_id");
CREATE INDEX IF NOT EXISTS "enrollment_client_idx"     ON "client_enrollment_tokens" ("client_id");
CREATE INDEX IF NOT EXISTS "enrollment_token_hash_idx" ON "client_enrollment_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "enrollment_expires_idx"    ON "client_enrollment_tokens" ("expires_at");
