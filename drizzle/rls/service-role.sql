-- Correct service_role configuration for self-hosted Supabase (PA-012).
--
-- Every edge function uses `service_role` (via createSupabaseServiceClient) and
-- needs to bypass Row-Level Security. The scoped attribute for that is
-- BYPASSRLS — NOT SUPERUSER.
--
-- The removed fix-service-role-bypass.sql granted `ALTER USER service_role WITH
-- SUPERUSER` (and `GRANT service_role TO postgres`). A superuser bypasses ALL
-- security unconditionally, neutralizes the RLS backstop, and turns any SQL
-- injection in an edge function into full-cluster compromise. Never do that.
--
-- Apply once as a Postgres superuser (operator step, not part of db:migrate):
ALTER ROLE service_role WITH BYPASSRLS NOSUPERUSER;

-- Verify (expects rolbypassrls = t, rolsuper = f):
--   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'service_role';
