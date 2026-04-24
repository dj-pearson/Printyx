-- ============================================================================
-- email-marketing.sql — scheduled campaign sends.
--
-- Runs every 5 minutes to pick up any `email_campaigns` rows whose
-- `scheduled_at` has arrived. The edge function does the actual send batch
-- + updates status; this job just nudges it.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Every 5 min: dispatch scheduled campaigns ─────────────────────────────
SELECT cron.unschedule('email-campaigns-dispatch') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'email-campaigns-dispatch'
);
SELECT cron.schedule(
  'email-campaigns-dispatch',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/email-marketing/campaigns/dispatch-due',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'email-campaigns-dispatch'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $$
);
