-- API Key Management tables (US-020)
-- Idempotent: safe to run multiple times.
-- Matches shared/api-key-schema.ts. tenant/user references are varchar
-- because tenants.id and users.id are varchar in this database.

-- Enums
DO $$ BEGIN
  CREATE TYPE api_key_type AS ENUM ('service', 'integration', 'webhook', 'readonly', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE api_key_status AS ENUM ('active', 'inactive', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  key_type api_key_type NOT NULL DEFAULT 'service',
  key_prefix varchar(20) NOT NULL,
  key_last4 varchar(4),
  key_hash varchar(128) NOT NULL,
  key_salt varchar(64) NOT NULL,
  status api_key_status NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp,
  never_expires boolean NOT NULL DEFAULT false,
  scopes jsonb DEFAULT '[]'::jsonb,
  permissions jsonb DEFAULT '[]'::jsonb,
  allowed_ips jsonb DEFAULT '[]'::jsonb,
  allow_all_ips boolean NOT NULL DEFAULT true,
  rate_limit_per_minute integer DEFAULT 1000,
  rate_limit_per_hour integer DEFAULT 10000,
  rate_limit_per_day integer DEFAULT 100000,
  last_used_at timestamp,
  usage_count varchar(20) DEFAULT '0',
  last_used_ip varchar(45),
  last_used_user_agent text,
  environment varchar(50) DEFAULT 'production',
  allowed_environments jsonb DEFAULT '["production"]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  revoked_by varchar REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamp,
  revoked_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash)
);

-- Upgrade path for installs that created the table before this migration
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_last4 varchar(4);
ALTER TABLE api_keys ALTER COLUMN key_prefix TYPE varchar(20);

CREATE INDEX IF NOT EXISTS api_keys_tenant_idx ON api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_status_idx ON api_keys (status);
CREATE INDEX IF NOT EXISTS api_keys_expires_at_idx ON api_keys (expires_at);
CREATE INDEX IF NOT EXISTS api_keys_key_type_idx ON api_keys (key_type);

-- Usage logs (append-only audit of every API-key request)
CREATE TABLE IF NOT EXISTS api_key_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id varchar(255),
  method varchar(10) NOT NULL,
  path varchar(1024) NOT NULL,
  query_params jsonb DEFAULT '{}'::jsonb,
  status_code integer,
  response_time_ms integer,
  error_message text,
  client_ip varchar(45),
  user_agent text,
  origin varchar(512),
  timestamp timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_key_usage_logs_api_key_idx ON api_key_usage_logs (api_key_id);
CREATE INDEX IF NOT EXISTS api_key_usage_logs_tenant_idx ON api_key_usage_logs (tenant_id);
CREATE INDEX IF NOT EXISTS api_key_usage_logs_timestamp_idx ON api_key_usage_logs (timestamp);
CREATE INDEX IF NOT EXISTS api_key_usage_logs_method_path_idx ON api_key_usage_logs (method, path);

-- Rate limit buckets
CREATE TABLE IF NOT EXISTS api_key_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  bucket_type varchar(20) NOT NULL,
  bucket_key varchar(50) NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  bucket_start timestamp NOT NULL,
  bucket_end timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT api_key_rate_limits_bucket_unique UNIQUE (api_key_id, bucket_type, bucket_key)
);

CREATE INDEX IF NOT EXISTS api_key_rate_limits_api_key_idx ON api_key_rate_limits (api_key_id);
CREATE INDEX IF NOT EXISTS api_key_rate_limits_bucket_key_idx ON api_key_rate_limits (api_key_id, bucket_type, bucket_key);
CREATE INDEX IF NOT EXISTS api_key_rate_limits_bucket_end_idx ON api_key_rate_limits (bucket_end);

-- Rotation history
CREATE TABLE IF NOT EXISTS api_key_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  old_key_prefix varchar(20) NOT NULL,
  old_key_hash varchar(128) NOT NULL,
  new_key_prefix varchar(20) NOT NULL,
  rotated_at timestamp NOT NULL DEFAULT now(),
  rotated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  grace_period_ends_at timestamp,
  old_key_disabled_at timestamp
);

CREATE INDEX IF NOT EXISTS api_key_rotations_api_key_idx ON api_key_rotations (api_key_id);
CREATE INDEX IF NOT EXISTS api_key_rotations_tenant_idx ON api_key_rotations (tenant_id);
CREATE INDEX IF NOT EXISTS api_key_rotations_rotated_at_idx ON api_key_rotations (rotated_at);
