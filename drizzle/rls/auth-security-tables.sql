-- ============================================================================
-- auth-security-tables.sql — create any missing auth tables + enums.
--
-- Covers api-keys, MFA, SSO. Idempotent.
--
-- Encryption-at-rest for mfa_enrollments.secret is a cross-domain follow-up
-- (see tasks/followup-credentials-encryption.md). This file stores the TOTP
-- seed as text; a future pass will wrap it in pgcrypto.
-- ============================================================================

BEGIN;

-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "api_key_type" AS ENUM('service', 'user', 'integration', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "api_key_status" AS ENUM('active', 'inactive', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── mfa_enrollments (TOTP + backup-codes enrollment state) ──────────────────
CREATE TABLE IF NOT EXISTS "mfa_enrollments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "tenant_id" varchar,
  "method" varchar NOT NULL,                   -- 'totp' | 'email' | 'sms'
  "secret" text,                                -- TOTP seed (encrypt at rest: follow-up)
  "phone_number" varchar,
  "email" varchar,
  "is_verified" boolean DEFAULT false NOT NULL,
  "verified_at" timestamp,
  "is_primary" boolean DEFAULT false NOT NULL,
  "last_used_at" timestamp,
  "failure_count" integer DEFAULT 0,
  "locked_until" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "mfa_enrollments_user_method_unique" UNIQUE("user_id","method")
);
CREATE INDEX IF NOT EXISTS "mfa_enrollments_user_idx" ON "mfa_enrollments" ("user_id");
CREATE INDEX IF NOT EXISTS "mfa_enrollments_tenant_idx" ON "mfa_enrollments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "mfa_enrollments_verified_idx" ON "mfa_enrollments" ("is_verified");

-- ─── mfa_otp_tokens (email/SMS one-time codes) ───────────────────────────────
CREATE TABLE IF NOT EXISTS "mfa_otp_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "tenant_id" varchar,
  "method" varchar NOT NULL,                   -- 'email' | 'sms'
  "token_hash" varchar NOT NULL,               -- sha-256 of the code we sent
  "destination" varchar NOT NULL,              -- email address or phone number
  "consumed" boolean DEFAULT false NOT NULL,
  "consumed_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "attempt_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "mfa_otp_tokens_user_idx" ON "mfa_otp_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "mfa_otp_tokens_hash_idx" ON "mfa_otp_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "mfa_otp_tokens_expires_idx" ON "mfa_otp_tokens" ("expires_at");

-- mfa_audit_logs + mfa_backup_codes + api_keys + api_key_usage_logs + sso_sessions
-- all exist in migration 0000. ADD COLUMN IF NOT EXISTS for any drift.
ALTER TABLE IF EXISTS "api_keys" ADD COLUMN IF NOT EXISTS "rate_limit_per_hour" integer DEFAULT 10000;
ALTER TABLE IF EXISTS "api_keys" ADD COLUMN IF NOT EXISTS "rate_limit_per_day" integer DEFAULT 100000;

-- ─── sso_provider_configs ────────────────────────────────────────────────────
-- Mirrors shared/sso-schema.ts::ssoProviderConfigs (richer variant). If the
-- DB has a simpler `sso_providers` table, run both idempotently.
DO $$ BEGIN
  CREATE TYPE "sso_provider_type" AS ENUM(
    'azure_ad', 'okta', 'google_workspace', 'onelogin', 'ping_identity',
    'custom_saml', 'custom_oidc'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "sso_protocol" AS ENUM('saml2', 'oidc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "sso_connection_status" AS ENUM(
    'pending', 'configured', 'active', 'error', 'disabled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sso_provider_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "provider_type" "sso_provider_type" NOT NULL,
  "protocol" "sso_protocol" NOT NULL,
  "name" varchar(255) NOT NULL,
  "display_name" varchar(255),
  "description" text,
  "status" "sso_connection_status" DEFAULT 'pending' NOT NULL,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "saml_entity_id" varchar(512),
  "saml_sso_url" varchar(1024),
  "saml_slo_url" varchar(1024),
  "saml_certificate" text,
  "saml_certificate_fingerprint" varchar(255),
  "saml_signing_algorithm" varchar(50) DEFAULT 'sha256',
  "saml_digest_algorithm" varchar(50) DEFAULT 'sha256',
  "saml_request_signature" boolean DEFAULT true,
  "saml_want_assertions_signed" boolean DEFAULT true,
  "oidc_client_id" varchar(512),
  "oidc_client_secret" text,
  "oidc_issuer" varchar(1024),
  "oidc_authorization_url" varchar(1024),
  "oidc_token_url" varchar(1024),
  "oidc_userinfo_url" varchar(1024),
  "oidc_jwks_url" varchar(1024),
  "oidc_scopes" varchar(512) DEFAULT 'openid profile email',
  "attribute_mapping" jsonb DEFAULT '{}'::jsonb,
  "group_role_mapping" jsonb DEFAULT '{}'::jsonb,
  "allowed_domains" varchar(1024),
  "allowed_email_domains" varchar(1024),
  "auto_provision_users" boolean DEFAULT true NOT NULL,
  "auto_update_user_attributes" boolean DEFAULT true NOT NULL,
  "auto_deactivate_users" boolean DEFAULT false NOT NULL,
  "default_role" varchar(100),
  "default_location_id" uuid,
  "jit_provisioning" boolean DEFAULT true NOT NULL,
  "jit_provisioning_rules" jsonb DEFAULT '{}'::jsonb,
  "last_tested_at" timestamp,
  "last_test_success" boolean,
  "last_test_error" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sso_provider_configs_tenant_idx" ON "sso_provider_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "sso_provider_configs_status_idx" ON "sso_provider_configs" ("tenant_id","status");

COMMIT;
