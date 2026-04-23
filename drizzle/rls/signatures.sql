-- ============================================================================
-- signatures.sql — RLS on the 5 signature-related tables.
--
-- Run order: apply-rls.sql → signatures-tables.sql (if baseline gaps) → this
-- file. Idempotent; defensive (skips missing tables, emits NOTICE).
--
-- Note: integration_credentials is shared across providers (signatures,
-- manufacturer-orders, SSO, etc.). Applying RLS here is a no-op if the
-- manufacturer-orders port applies it first — both paths are idempotent.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'integration_credentials',
    'signature_requests',
    'signature_signers',
    'signature_documents',
    'signature_audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist — run signatures-tables.sql first', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
