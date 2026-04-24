-- ============================================================================
-- contract-renewals.sql — daily notifications for contracts approaching
-- their renewal date.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Daily @ 06:00 UTC: contract renewal notices ─────────────────────────
-- The edge function queries contracts where renewal is 60/30/7 days out and
-- dispatches emails to the account owner + customer contact.
SELECT cron.unschedule('contract-renewal-notifications') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'contract-renewal-notifications'
);
SELECT cron.schedule(
  'contract-renewal-notifications',
  '0 6 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/contracts/renewals/send-notices',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'contract-renewal-notifications'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 600000
    );
  $$
);
