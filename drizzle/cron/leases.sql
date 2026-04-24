-- ============================================================================
-- leases.sql — daily payment-due notifications.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Daily @ 07:00 UTC: lease payment due notifications ──────────────────
SELECT cron.unschedule('lease-payment-due-notices') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'lease-payment-due-notices'
);
SELECT cron.schedule(
  'lease-payment-due-notices',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/leases/payments/send-due-notices',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'lease-payment-due-notices'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $$
);
