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

| File                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                          | Consumed by                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `dashboard-widget-data.sql` | `dashboard_widget_data(widget_key, tenant_id, user_id, role_code, level)` — returns JSONB for one of 34 dashboard widgets. Tenant-scoped by explicit parameter.                                                                                                                                                                                                                                                                                  | `supabase/functions/dashboard-widgets/`                                  |
| `billing-aggregates.sql`    | `ap_aging_summary(tenant)`, `ar_aging_summary(tenant)`, `billing_analytics(tenant)` — money totals computed in SQL instead of `SELECT *` + reduce in JS (AUDIT-006). Tenant-scoped by explicit parameter.                                                                                                                                                                                                                                        | `supabase/functions/account-payable/`, `account-receivable/`, `billing/` |
| `ai-employee-analytics.sql` | `ai_employee_analytics_overview(tenant)` — dashboard aggregates (`COUNT FILTER`, `GROUP BY`, a `LEFT JOIN`, a `generate_series` 7-day series) that PostgREST cannot express (EDGE-019). Tenant-scoped by explicit parameter, which is `uuid` here — see the file header.                                                                                                                                                                         | `supabase/functions/ai-employees/`                                       |
| `contract-pnl-refresh.sql`  | `refresh_contract_pnl_views()` — `REFRESH MATERIALIZED VIEW` on `contract_pnl_v` + `contract_pnl_monthly_v`, which PostgREST cannot issue (EDGE-023). The only `SECURITY DEFINER` function here (REFRESH needs view ownership); takes no arguments and touches two hard-coded views, so there is no injection surface. Global, not per-tenant — a materialized view refreshes wholly, and the per-tenant 60s cooldown is enforced by the caller. | `supabase/functions/contract-pnl/`                                       |
| `global-search.sql`         | `global_search(tenant, query, limit)` — trigram-ranked unified search across CRM entities, replacing the edge function's unranked ILIKE scans. Tenant-scoped by explicit parameter.                                                                                                                                                                                                                                                              | `supabase/functions/search/`                                             |
| `sales-pipeline.sql`        | `sales_pipeline_rep_metrics(tenant)`, `sales_pipeline_summary(tenant)` — per-rep rollups and pipeline totals as complex CTEs. Tenant-scoped by explicit parameter.                                                                                                                                                                                                                                                                               | `supabase/functions/sales-pipeline/`                                     |
| `pipeline-config.sql`       | `pipeline_conversion_analytics(tenant, template?)`, `pipeline_velocity_analytics(tenant, template?)`, `pipeline_stages_reorder(tenant, stages)`, `pipeline_template_clone(tenant, source, name)`, `pipeline_deal_transition(tenant, deal, stage, ...)` — two GROUP BY analytics plus three transactional writes. Tenant-scoped by explicit parameter.                                                                                            | `supabase/functions/pipeline-config/`                                    |
| `lead-scoring.sql`          | `lead_scoring_leaderboard(tenant, limit)`, `lead_scoring_by_grade(tenant, grade, limit)`, `lead_scoring_analytics(tenant)` — latest-score-per-lead via `DISTINCT ON`, plus grade rollups. Tenant-scoped by explicit parameter.                                                                                                                                                                                                                   | `supabase/functions/lead-scoring/`                                       |
| `lead-assignment.sql`       | `lead_assignment_bump_rep_load(tenant, user)`, `lead_assignment_round_robin(tenant, rule)` — atomic counter increment and next-rep selection, both of which need a single statement to be race-free. Also `lead_assignment_reset_counters()`, which takes no arguments and **has no caller anywhere in the repo** (see below). Tenant-scoped by explicit parameter.                                                                              | `supabase/functions/lead-assignment/`                                    |

> **Callers of `billing-aggregates.sql` fall back to the old in-JS summation when the
> function is missing**, so the edge functions keep working if they deploy before this
> file is applied. That fallback is a safety net, not a substitute: while it is in use
> the totals are still silently truncated at PostgREST's `db-max-rows` (1000) and are
> therefore WRONG for large tenants. Apply this file to actually fix the numbers.

> **`ai-employee-analytics.sql` has no equivalent fallback** — the aggregation cannot be
> reproduced with PostgREST calls, which is the whole reason it is a SQL function. Until
> it is applied, `ai-employees` `/analytics/overview` returns the zeroed shape (a 200, so
> the dashboard renders zeroes rather than erroring). Apply this file to get real numbers.

> **Twelve of the thirteen called functions in `global-search`,
> `sales-pipeline`, `pipeline-config`, `lead-scoring` and `lead-assignment` have
> NO fallback: the caller fails when the file has not been applied.** That is
> both `sales-pipeline` functions, all five in `pipeline-config` (including
> `pipeline_deal_transition`, which is the deals board's drag-and-drop), all
> three in `lead-scoring`, and both called `lead_assignment` functions.
> Applying these is not an optimization the way `billing-aggregates.sql` is -
> until they are applied those endpoints do not work at all. **`global_search`
> is the only exception** and does degrade, to an unranked ILIKE scan.
>
> `lead_assignment_bump_rep_load` is worth singling out because its two call
> sites disagreed: `_engine.ts` throws on failure, while `handlers/assign.ts`
> discarded the result and answered 201 with the counter unmoved, so the rep
> kept their previous load and round-robin kept handing them the next lead.
> That path now reports `repLoadUpdated: false` and a warning rather than
> failing the assignment, because the history row is already written by then.
>
> This table listed four of the nine files until round 139, and the five it
> omitted were exactly the ones that 500 - the four it documented are the ones
> whose authors had thought about the missing-function case and written a
> fallback, which is presumably why they thought to write a row too.
> `npm run check:edge-rpc` fails when a file here is unlisted, and when an edge
> `.rpc()` name resolves to no definition anywhere in the repo.

> **`lead_assignment_reset_counters()` is fired by nothing.** It resets
> `leads_assigned_today` / `leads_assigned_this_week` on `rep_capacity`, and no
> edge function calls it and no `drizzle/cron/*.sql` schedules it, so those
> counters only ever increase. A daily-rollover job belongs in `drizzle/cron/`
> (that directory's README carries the job inventory); until one exists, a
> routing rule reading a per-day cap is reading a number that never resets.

## Why not in `drizzle/migrations/`

Drizzle-kit-generated migrations ship with a `meta/*_snapshot.json` that tracks
the schema state. Hand-written SQL (functions, triggers, RLS policies) doesn't
have a corresponding schema delta, so `drizzle-kit generate` won't pick it up,
and the migrator may choke on orphaned SQL files. Putting these in a sibling
directory keeps the two flows independent.

Related: `drizzle/rls/` follows the same pattern for RLS policies.
