# drizzle/cron/ — scheduled jobs via `pg_cron`

All recurring jobs in Printyx run as `pg_cron` schedules inside Supabase Postgres. Node's `node-cron` is removed — per `tasks/prd-migration-cron-realtime.md`, it was already disabled in-code before the migration started.

Each domain owns a file here. Job bodies are either pure SQL (retention trims) or `pg_net.http_post` calls to an edge-function endpoint. The edge functions recognize these invocations by the `Authorization: Bearer <INTERNAL_CRON_TOKEN>` header — see `supabase/functions/_shared/cron-auth.ts`.

## First-time setup

```bash
psql $DATABASE_URL -f drizzle/cron/_bootstrap.sql
```

Then, once per database, set the cron token out of band (this value never goes into git):

```sql
ALTER DATABASE postgres SET app.internal_cron_token = '<generate-a-64-char-random-value>';
```

Apply per-domain schedules:

```bash
for f in drizzle/cron/*.sql; do
  # _bootstrap runs first; order of the rest doesn't matter
  psql $DATABASE_URL -f "$f"
done
```

Every file is idempotent: each `cron.schedule(...)` call is preceded by a conditional `cron.unschedule(...)` for the same job name, so re-running updates the timing without creating duplicates.

## Job inventory

| Job name | File | Cron | Type | Description |
|---|---|---|---|---|
| `audit-log-retention` | retention.sql | `0 2 * * *` | SQL | Delete `audit_logs` rows older than 2 years |
| `reading-history-retention` | retention.sql | `15 2 * * *` | SQL | Delete `reading_history` rows older than 90 days |
| `meeting-recordings-retention` | retention.sql | `30 2 * * *` | SQL | Delete `meeting_recordings` metadata older than 90 days |
| `mfa-otp-retention` | retention.sql | `0 * * * *` | SQL | Hourly purge of expired + consumed MFA OTPs older than 30 days |
| `calendar-sync-logs-retention` | retention.sql | `45 2 * * *` | SQL | Delete `calendar_sync_logs` older than 30 days |
| `health-score-recalc-nightly` | customer-success.sql | `0 1 * * *` | HTTP | POST `/customer-success/health-scores/recalc` |
| `customer-at-risk-alerts-hourly` | customer-success.sql | `15 * * * *` | HTTP | POST `/customer-success/at-risk/check` |
| `email-campaigns-dispatch` | email-marketing.sql | `*/5 * * * *` | HTTP | POST `/email-marketing/campaigns/dispatch-due` |
| `subscription-trial-expiry-check` | subscriptions.sql | `30 * * * *` | HTTP | POST `/billing/subscriptions/check-trials` |
| `subscription-renewal-charges` | subscriptions.sql | `0 3 * * *` | HTTP | POST `/billing/subscriptions/process-renewals` |
| `billing-invoice-monthly` | billing.sql | `0 3 1 * *` | HTTP | POST `/billing/invoices/run-monthly` (first of each month) |
| `billing-meter-aggregate-daily` | billing.sql | `0 4 * * *` | HTTP | POST `/billing/meters/aggregate-daily` |
| `contract-renewal-notifications` | contract-renewals.sql | `0 6 * * *` | HTTP | POST `/contracts/renewals/send-notices` |
| `lease-payment-due-notices` | leases.sql | `0 7 * * *` | HTTP | POST `/leases/payments/send-due-notices` |
| `mileage-auto-generate-nightly` | mileage.sql | `0 5 * * *` | HTTP | POST `/field-service/mileage/auto-generate` |
| `scheduled-reports-dispatch` | reports.sql | `*/15 * * * *` | HTTP | POST `/reports/schedule/dispatch-due` (reports edge function pending US-023) |

**Total: 16 jobs.**

Times are UTC. Retention jobs are clustered in the 02:00–03:00 UTC window because that's the low-traffic quiet period for our customer base.

## Adding a new job

1. Pick a domain file (or create a new one). Name: `drizzle/cron/<domain>.sql`.
2. Use the idempotent pattern — unschedule-then-schedule:

   ```sql
   SELECT cron.unschedule('your-job-name') WHERE EXISTS (
     SELECT 1 FROM cron.job WHERE jobname = 'your-job-name'
   );
   SELECT cron.schedule('your-job-name', '<cron expression>', $$ <SQL body> $$);
   ```

3. For HTTP calls, include the `Authorization` + `X-Cron-Job` headers so the edge function can validate the token and stamp logs:

   ```sql
   SELECT net.http_post(
     url := 'https://functions.printyx.net/<path>',
     headers := jsonb_build_object(
       'Authorization', 'Bearer ' || current_setting('app.internal_cron_token', true),
       'Content-Type', 'application/json',
       'X-Cron-Job', 'your-job-name'
     ),
     body := '{}'::jsonb,
     timeout_milliseconds := <reasonable cap>
   );
   ```

4. Add a row to the inventory table above.
5. Apply: `psql $DATABASE_URL -f drizzle/cron/<your-file>.sql`.

## Monitoring

Query `cron.job_run_details` for recent runs:

```sql
SELECT jobname, status, start_time, end_time, return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 50;
```

Failure pattern to watch for: the same job failing 3+ times in a row. A follow-up ticket will wire this into an admin dashboard.

## Killing a misbehaving job

```sql
SELECT cron.unschedule('<job_name>');
```

Individual job kill — no full rollback needed. Re-apply the domain file to reinstate.

## Internal cron token

- Set via `ALTER DATABASE postgres SET app.internal_cron_token = '…';` — committed nowhere
- Read from cron bodies via `current_setting('app.internal_cron_token', true)` (the second arg = `true` prevents an error if the setting is absent, useful in dev)
- Edge functions validate via `supabase/functions/_shared/cron-auth.ts`
- Rotate periodically: set a new token, re-apply every `drizzle/cron/*.sql`, redeploy edge functions with the new token env var; old token stops working

## Relationship to the WebSocket → Realtime migration

This directory is Part A of `prd-migration-cron-realtime.md`. Part B (the Realtime swap) lives in `client/src/hooks/useRealtimeTable.ts` + `useRealtimeBroadcast.ts`. The two are independent but both must land before `server/` can be sunset.
