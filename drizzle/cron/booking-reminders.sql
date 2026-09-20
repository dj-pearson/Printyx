-- ============================================================================
-- booking-reminders.sql — reminder emails for public bookings (COP-B14 AC6),
-- and the prune that keeps the rate-limit table from growing forever (AC4).
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Hourly: remind invitees of meetings starting in the next 24 hours ────
-- The sweep is idempotent by column (booking_page_bookings.reminder_email_sent_at
-- is stamped before the send and only null rows are selected), so an hourly
-- cadence over a 24-hour window sends exactly one reminder per booking. The
-- hourly run is what keeps a booking made 90 minutes before its start from
-- missing its reminder entirely.
SELECT cron.unschedule('booking-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'booking-reminders'
);
SELECT cron.schedule(
  'booking-reminders',
  '15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/booking-pages/reminders/sweep?windowMinutes=1440',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'booking-reminders'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    );
  $$
);

-- ─── Daily @ 03:40 UTC: prune spent rate-limit attempts ──────────────────
-- One row per attempt against a public booking page. The limit only ever reads
-- the last ten minutes, so anything older is dead weight. Deleted in SQL rather
-- than through an endpoint: it is a maintenance job on one table, and giving it
-- an HTTP surface would be a delete endpoint on a public-facing table for no
-- reason.
SELECT cron.unschedule('booking-attempts-prune') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'booking-attempts-prune'
);
SELECT cron.schedule(
  'booking-attempts-prune',
  '40 3 * * *',
  $$
    DELETE FROM public_booking_attempts WHERE created_at < now() - interval '2 days';
  $$
);
