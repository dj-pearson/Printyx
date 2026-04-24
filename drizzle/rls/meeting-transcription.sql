-- ============================================================================
-- meeting-transcription.sql — RLS on all transcription-family tables.
-- Depends on: drizzle/rls/apply-rls.sql + meeting-transcription-tables.sql.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'meeting_recordings',
    'meeting_transcriptions',
    'meeting_notes',
    'meeting_highlights',
    'meeting_speakers',
    'meeting_content_search',
    'meeting_content_analytics',
    'recording_integrations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
