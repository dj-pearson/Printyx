-- ============================================================================
-- reports.sql — scheduled report delivery.
--
-- Depends on: _bootstrap.sql.
-- NOTE: the reports edge function is not yet ported (Phase 6 US-023 pending).
-- This schedule is wired up in advance; the endpoint will 404 until that
-- port lands — pg_cron will log the failure but not block.
-- ============================================================================

-- ─── Every 15 min: dispatch due scheduled reports ─────────────────────────
SELECT cron.unschedule('scheduled-reports-dispatch') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'scheduled-reports-dispatch'
);
SELECT cron.schedule(
  'scheduled-reports-dispatch',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/reports/schedule/dispatch-due',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'scheduled-reports-dispatch'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 600000
    );
  $$
);
