-- ============================================================================
-- suggested-tasks.sql — the nightly suggestion sweep (COP-B03 AC1).
--
-- `suggested_tasks` had NO REACHABLE WRITER. The sweep that generates every
-- suggestion is POST /suggested-tasks/sweep, no client tree posts to it, and
-- until this file there was no schedule - while `SuggestedTasksCard` sits in
-- TodayDashboard's card slots, so every rep's My Day carried a Suggested Tasks
-- card that was permanently empty. An empty suggestions card reads as "nothing
-- needs doing", which is the most flattering way for a feature to be absent.
--
-- That function's own header anticipated this: it says the sweep "is callable
-- from a workflow action or pg_cron the day that runtime closes", because
-- CRMX-008a leaves an edge enrolment able only to QUEUE. pg_cron is the half
-- that does not wait on CRMX-008a.
--
-- Depends on: _bootstrap.sql.
-- ============================================================================

-- ─── Nightly @ 04:50 UTC: sweep every tenant ─────────────────────────────
-- Tenants run SEQUENTIALLY inside the function: each one pages its whole open
-- pipeline, its live quotes and its radar plays, so fifty in parallel would
-- multiply the peak load to finish a nightly job a few minutes sooner. A tenant
-- that throws is recorded and stepped over, and a sweep where every tenant
-- failed answers 500 rather than a 200 nobody reads.
--
-- Idempotent by construction (AC7): the upsert collides on
-- (tenant_id, dedupe_key) with ignoreDuplicates, so a second run of the same
-- night leaves the existing rows alone and `detected - created` reports how
-- many were already open. A missed night therefore costs nothing.
--
-- AC4 is a set difference, which is why running it nightly matters in BOTH
-- directions: the sweep expires every open row whose key it did not reproduce,
-- so a suggestion whose signal has gone (the rep logged the call, the quote was
-- accepted) is retracted by the same pass that raises new ones. Without a
-- schedule nothing retracts either.
--
-- The per-tenant kill switch (suggested_task_settings.sweep_enabled) is
-- honoured inside runSweep, so a tenant that turned suggestions off is skipped
-- and counted rather than silently producing nothing (AC5).
--
-- 04:50 rather than on the hour: 03:00 and 04:00 already carry billing,
-- renewals, the meter aggregate and the opportunity radar, and the radar at
-- 04:20 writes the `radar_plays` this sweep reads - so it runs after it.
SELECT cron.unschedule('suggested-tasks-sweep') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'suggested-tasks-sweep'
);
SELECT cron.schedule(
  'suggested-tasks-sweep',
  '50 4 * * *',
  $$
    SELECT net.http_post(
      url := 'https://functions.printyx.net/suggested-tasks/sweep/all',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
        'Content-Type', 'application/json',
        'X-Cron-Job', 'suggested-tasks-sweep'
      ),
      body := '{}'::jsonb,
      -- Every tenant's open pipeline in one call.
      timeout_milliseconds := 900000
    );
  $$
);
