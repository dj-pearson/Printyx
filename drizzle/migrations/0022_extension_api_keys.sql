-- PA-044: persist Chrome-extension API keys (hash + prefix, expiry, revocation).
-- Idempotent so it is safe to (re)apply against the existing database.
CREATE TABLE IF NOT EXISTS "extension_api_keys" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "key_hash" varchar NOT NULL,
  "key_prefix" varchar NOT NULL,
  "name" varchar,
  "last_used_at" timestamp,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_api_keys_prefix_idx" ON "extension_api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_api_keys_tenant_idx" ON "extension_api_keys" USING btree ("tenant_id");
