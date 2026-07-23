-- PA-044: persisted Chrome-extension API keys (hashed).
CREATE TABLE IF NOT EXISTS "extension_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"key_hash" varchar NOT NULL,
	"key_prefix" varchar NOT NULL,
	"name" varchar,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "extension_api_keys_key_hash_uniq"
	ON "extension_api_keys" ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_api_keys_tenant_idx"
	ON "extension_api_keys" ("tenant_id");
