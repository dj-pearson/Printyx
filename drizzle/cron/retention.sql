-- ============================================================================
-- retention.sql — data retention trimming jobs. Pure SQL, no edge calls.
--
-- Depends on: _bootstrap.sql (pg_cron).
-- Idempotent: each schedule call is wrapped so re-running this file updates
-- timing without creating duplicates.
-- ============================================================================

-- ─── Audit logs: trim older than 2 years, daily at 02:00 UTC ──────────────
-- audit_logs column is `timestamp` per shared/security-schema.ts, not
-- `created_at` — same drift noted in drizzle/rls/admin-tables.sql.
SELECT cron.unschedule('audit-log-retention') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'audit-log-retention'
);
SELECT cron.schedule(
  'audit-log-retention',
  '0 2 * * *',
  $$
    DELETE FROM audit_logs
    WHERE "timestamp" < NOW() - INTERVAL '2 years'
  $$
);

-- ─── Reading history: trim older than 90 days, daily at 02:15 UTC ─────────
SELECT cron.unschedule('reading-history-retention') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reading-history-retention'
);
SELECT cron.schedule(
  'reading-history-retention',
  '15 2 * * *',
  $$
    DELETE FROM reading_history
    WHERE last_viewed_at < NOW() - INTERVAL '90 days'
  $$
);

-- ─── Meeting recordings: trim audio + metadata older than 90 days ─────────
-- daily at 02:30 UTC. Storage-backed audio files must be cleaned up by the
-- meeting-transcription edge function's retention endpoint; this row-level
-- delete only clears the metadata. See followup TODO at the bottom.
SELECT cron.unschedule('meeting-recordings-retention') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'meeting-recordings-retention'
);
SELECT cron.schedule(
  'meeting-recordings-retention',
  '30 2 * * *',
  $$
    DELETE FROM meeting_recordings
    WHERE uploaded_at < NOW() - INTERVAL '90 days'
  $$
);

-- ─── MFA OTP tokens: trim expired+consumed older than 30 days ─────────────
-- Hourly. Small table, fast delete.
SELECT cron.unschedule('mfa-otp-retention') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mfa-otp-retention'
);
SELECT cron.schedule(
  'mfa-otp-retention',
  '0 * * * *',
  $$
    DELETE FROM mfa_otp_tokens
    WHERE (consumed = true OR expires_at < NOW())
      AND created_at < NOW() - INTERVAL '30 days'
  $$
);

-- ─── Calendar sync logs: trim older than 30 days, daily at 02:45 UTC ──────
SELECT cron.unschedule('calendar-sync-logs-retention') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'calendar-sync-logs-retention'
);
SELECT cron.schedule(
  'calendar-sync-logs-retention',
  '45 2 * * *',
  $$
    DELETE FROM calendar_sync_logs
    WHERE created_at < NOW() - INTERVAL '30 days'
  $$
);

-- TODO (followup): Storage bucket cleanup for meeting-recordings audio.
-- pg_cron can't call Supabase Storage directly. Plan: add a
-- /meeting-transcription/retention/cleanup endpoint that lists storage
-- objects with no matching DB row and deletes them; schedule it here via
-- pg_net.http_post after the endpoint lands.
