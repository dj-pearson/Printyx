-- ============================================================================
-- admin-tables.sql — schema safety net for the Phase 6 US-024 admin slice
-- (audit-logs, feature-flags, user-settings, chrome-extension).
--
-- These tables mostly exist from earlier phases; this file is the idempotent
-- replay. Full admin scope (admin-seed, enhanced-rbac, tenant-onboarding)
-- intentionally deferred — those need the docs/admin-parity.md audit the PRD
-- calls for before code touches them.
-- ============================================================================

BEGIN;

-- ─── audit_logs ────────────────────────────────────────────────────────────
-- Already created by shared/security-schema.ts. Replay the essential shape
-- for fresh installs. Timestamp column is named `timestamp` (not `created_at`)
-- per the Drizzle schema; the edge function queries that same column.
-- `severity` and `category` are enum types at the schema level — we use text
-- here since the enum definitions live in shared/security-schema.ts and
-- re-declaring them here would clash on re-run. CREATE TABLE IF NOT EXISTS
-- is a no-op when the live table exists.
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action varchar(255) NOT NULL,
  resource varchar(255) NOT NULL,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  additional_context jsonb,
  ip_address varchar(45) NOT NULL,
  user_agent text,
  session_id varchar(255),
  severity varchar(50) NOT NULL,
  category varchar(50) NOT NULL,
  request_id uuid,
  parent_action_id uuid,
  "timestamp" timestamp NOT NULL DEFAULT now()
);
-- Indexes on audit_logs are conditional because the live schema has drifted
-- from shared/security-schema.ts in some deployments (missing category /
-- session_id / etc.). We create each index only if its target column exists.
DO $$
DECLARE
  ts_col text;
BEGIN
  -- Prefer `timestamp` (current schema); fall back to `created_at` on older DBs.
  SELECT column_name INTO ts_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'audit_logs'
     AND column_name IN ('timestamp', 'created_at')
   ORDER BY CASE column_name WHEN 'timestamp' THEN 0 ELSE 1 END
   LIMIT 1;

  IF ts_col IS NOT NULL THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_ts ON audit_logs(tenant_id, %I DESC)',
      ts_col
    );
  ELSE
    RAISE NOTICE 'SKIP idx_audit_logs_tenant_ts: no timestamp/created_at column';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'category'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category)';
  ELSE
    RAISE NOTICE 'SKIP idx_audit_logs_category: column does not exist in live schema';
  END IF;
END $$;

-- ─── feature_flags ─────────────────────────────────────────────────────────
-- CROSS-TENANT table — no tenant_id column. Per-tenant behavior via the
-- tenant_overrides jsonb column. RLS deny-by-default for authenticated role
-- (only platform admins should touch flags; they use service-role).
CREATE TABLE IF NOT EXISTS feature_flags (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name varchar(255) NOT NULL,
  description text DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer NOT NULL DEFAULT 100,
  tenant_overrides jsonb DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE feature_flags
    ADD CONSTRAINT feature_flags_name_unique UNIQUE (name);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx ON feature_flags(enabled);

-- ─── user_settings ─────────────────────────────────────────────────────────
-- Per-user settings (profile extras + preferences + accessibility). Keyed on
-- user_id (unique), scoped by tenant_id for RLS.
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  phone varchar(50),
  job_title varchar(255),
  department varchar(255),
  bio text,
  avatar text,
  theme varchar(50) DEFAULT 'system',
  language varchar(10) DEFAULT 'en',
  timezone varchar(100) DEFAULT 'America/New_York',
  date_format varchar(50) DEFAULT 'MM/dd/yyyy',
  time_format varchar(10) DEFAULT '12',
  currency varchar(10) DEFAULT 'USD',
  notifications jsonb DEFAULT '{}',
  accessibility jsonb DEFAULT '{}',
  two_factor_enabled boolean DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS user_settings_tenant_idx ON user_settings(tenant_id);

COMMIT;
