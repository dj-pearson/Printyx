-- ============================================================
-- PostgREST Grants for Supabase Auth Roles
-- ============================================================
-- Fixes "permission denied for table ..." 403s from /rest/v1/*
-- by granting the authenticated role access to required tables.
--
-- IMPORTANT:
-- - RLS remains enabled and continues to enforce tenant isolation.
-- - These grants only allow PostgREST to query; policies still apply.
-- ============================================================

-- Schema usage
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Core tables needed by the app UI
GRANT SELECT ON TABLE public.roles TO authenticated;
GRANT SELECT ON TABLE public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_records TO authenticated;

-- If your app reads tenants in-client (optional; keep RLS)
GRANT SELECT ON TABLE public.tenants TO authenticated;

-- Sequences (needed for inserts on tables with sequences)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Default privileges for future tables (optional but recommended)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

