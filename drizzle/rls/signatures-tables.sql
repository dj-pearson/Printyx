-- ============================================================================
-- signatures-tables.sql — create any missing signature tables.
--
-- Idempotent. Run BEFORE signatures.sql (RLS). Note: integration_credentials
-- is shared across providers (signatures, manufacturer-orders, etc.), not
-- signature-specific. The signatures edge function only reads/writes rows
-- where provider IN ('docusign', 'adobe_sign', 'hellosign').
-- ============================================================================

BEGIN;

-- ─── integration_credentials (shared, multi-provider) ────────────────────────
CREATE TABLE IF NOT EXISTS "integration_credentials" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "provider" varchar NOT NULL,
  "integration_name" varchar NOT NULL,
  "status" varchar DEFAULT 'active' NOT NULL,
  "api_key" text,
  "api_secret" text,
  "access_token" text,
  "refresh_token" text,
  "token_expiry" timestamp,
  "account_id" varchar,
  "webhook_secret" varchar,
  "sandbox_mode" boolean DEFAULT false,
  "config" jsonb,
  "last_health_check" timestamp,
  "health_status" varchar DEFAULT 'unknown',
  "error_message" text,
  "created_by" varchar,
  "updated_by" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "integration_credentials_tenant_provider_idx" ON "integration_credentials" ("tenant_id","provider");
CREATE INDEX IF NOT EXISTS "integration_credentials_status_idx" ON "integration_credentials" ("status");

-- ─── signature_requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "signature_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "request_number" varchar NOT NULL,
  "title" varchar NOT NULL,
  "description" text,
  "customer_id" varchar,
  "proposal_id" varchar,
  "contract_id" varchar,
  "lease_id" varchar,
  "provider" varchar NOT NULL,
  "integration_id" varchar,
  "external_id" varchar,
  "status" varchar DEFAULT 'draft' NOT NULL,
  "sent_at" timestamp,
  "completed_at" timestamp,
  "expires_at" timestamp,
  "email_subject" varchar,
  "email_message" text,
  "reminder_enabled" boolean DEFAULT true,
  "reminder_days" integer DEFAULT 3,
  "sequential_signing" boolean DEFAULT false,
  "total_signers" integer DEFAULT 0,
  "signers_completed" integer DEFAULT 0,
  "total_documents" integer DEFAULT 0,
  "voided_reason" text,
  "declined_reason" text,
  "created_by" varchar,
  "updated_by" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "signature_requests_tenant_request_number_unique" UNIQUE("tenant_id","request_number")
);
CREATE INDEX IF NOT EXISTS "signature_requests_tenant_idx" ON "signature_requests" ("tenant_id");
CREATE INDEX IF NOT EXISTS "signature_requests_tenant_status_idx" ON "signature_requests" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "signature_requests_customer_idx" ON "signature_requests" ("tenant_id","customer_id");

-- ─── signature_signers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "signature_signers" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "request_id" varchar NOT NULL,
  "signer_order" integer DEFAULT 1 NOT NULL,
  "signer_type" varchar DEFAULT 'signer' NOT NULL,
  "name" varchar NOT NULL,
  "email" varchar NOT NULL,
  "phone" varchar,
  "contact_id" varchar,
  "user_id" varchar,
  "external_signer_id" varchar,
  "status" varchar DEFAULT 'pending' NOT NULL,
  "sent_at" timestamp,
  "viewed_at" timestamp,
  "signed_at" timestamp,
  "declined_at" timestamp,
  "signature_method" varchar,
  "ip_address" varchar,
  "decline_reason" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "signature_signers_tenant_idx" ON "signature_signers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "signature_signers_request_idx" ON "signature_signers" ("request_id");

-- ─── signature_documents ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "signature_documents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "request_id" varchar NOT NULL,
  "document_order" integer DEFAULT 1 NOT NULL,
  "document_name" varchar NOT NULL,
  "document_type" varchar,
  "original_file_url" text,
  "signed_file_url" text,
  "certificate_url" text,
  "file_size" integer,
  "external_document_id" varchar,
  "status" varchar DEFAULT 'pending' NOT NULL,
  "total_fields" integer DEFAULT 0,
  "completed_fields" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "signature_documents_tenant_idx" ON "signature_documents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "signature_documents_request_idx" ON "signature_documents" ("request_id");

-- ─── signature_audit_logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "signature_audit_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "request_id" varchar,
  "signer_id" varchar,
  "document_id" varchar,
  "event_type" varchar NOT NULL,
  "event_description" text,
  "actor_type" varchar,
  "actor_id" varchar,
  "actor_name" varchar,
  "actor_email" varchar,
  "ip_address" varchar,
  "user_agent" text,
  "external_event_id" varchar,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "signature_audit_logs_tenant_idx" ON "signature_audit_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "signature_audit_logs_request_idx" ON "signature_audit_logs" ("request_id");
CREATE INDEX IF NOT EXISTS "signature_audit_logs_signer_idx" ON "signature_audit_logs" ("signer_id");

COMMIT;
