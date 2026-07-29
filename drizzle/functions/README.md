# Postgres Functions

SQL-level functions applied outside the Drizzle migration flow. These are
idempotent (`CREATE OR REPLACE FUNCTION`) so you can re-run any file after
making changes.

## Applying

From `psql` (or the Supabase SQL editor) connected to the target database:

```sql
\i drizzle/functions/dashboard-widget-data.sql
```

Or via any SQL runner pointed at `DATABASE_URL`.

## Files

| File                        | Purpose                                                                                                                                                                                                                                                                  | Consumed by                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `dashboard-widget-data.sql` | `dashboard_widget_data(widget_key, tenant_id, user_id, role_code, level)` — returns JSONB for one of 34 dashboard widgets. Tenant-scoped by explicit parameter.                                                                                                          | `supabase/functions/dashboard-widgets/`                                  |
| `billing-aggregates.sql`    | `ap_aging_summary(tenant)`, `ar_aging_summary(tenant)`, `billing_analytics(tenant)` — money totals computed in SQL instead of `SELECT *` + reduce in JS (AUDIT-006). Tenant-scoped by explicit parameter.                                                                | `supabase/functions/account-payable/`, `account-receivable/`, `billing/` |
| `ai-employee-analytics.sql` | `ai_employee_analytics_overview(tenant)` — dashboard aggregates (`COUNT FILTER`, `GROUP BY`, a `LEFT JOIN`, a `generate_series` 7-day series) that PostgREST cannot express (EDGE-019). Tenant-scoped by explicit parameter, which is `uuid` here — see the file header. | `supabase/functions/ai-employees/`                                       |

> **Callers of `billing-aggregates.sql` fall back to the old in-JS summation when the
> function is missing**, so the edge functions keep working if they deploy before this
> file is applied. That fallback is a safety net, not a substitute: while it is in use
> the totals are still silently truncated at PostgREST's `db-max-rows` (1000) and are
> therefore WRONG for large tenants. Apply this file to actually fix the numbers.

> **`ai-employee-analytics.sql` has no equivalent fallback** — the aggregation cannot be
> reproduced with PostgREST calls, which is the whole reason it is a SQL function. Until
> it is applied, `ai-employees` `/analytics/overview` returns the zeroed shape (a 200, so
> the dashboard renders zeroes rather than erroring). Apply this file to get real numbers.

## Why not in `drizzle/migrations/`

Drizzle-kit-generated migrations ship with a `meta/*_snapshot.json` that tracks
the schema state. Hand-written SQL (functions, triggers, RLS policies) doesn't
have a corresponding schema delta, so `drizzle-kit generate` won't pick it up,
and the migrator may choke on orphaned SQL files. Putting these in a sibling
directory keeps the two flows independent.

Related: `drizzle/rls/` follows the same pattern for RLS policies.
