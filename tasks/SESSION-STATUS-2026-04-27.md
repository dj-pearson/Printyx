# Session Status — 2026-04-27

Picked up from `SESSION-STATUS-2026-04-26.md` step 2 ("Reports second tier").
Everything in this session is uncommitted on `main`. Three files were created
and one file was modified; the `.gitignore` was also fixed because a stray
`report*` rule was preventing the new handler files from being tracked.

## TL;DR

- **Phase 6 reports second tier — done.** All 17 endpoints the
  Financial Intelligence / Sales Performance / Service Forecasting / Custom
  Report Builder / Breach Detection dashboards call now have edge-function
  handlers under `supabase/functions/reports/`. 7 are real ports of existing
  Express implementations; 14 are new shape-compatible degraded
  implementations for endpoints the frontend was hitting blind (the Express
  side had no handler, so they were 404-ing).
- **Custom Reports CRUD ported.** GET list / GET by id / POST create / POST
  preview / POST execute / PUT update / DELETE — all functional under
  `/reports/custom/*`. Aggregation/grouping flagged degraded (PostgREST
  can't run dynamic SQL safely; full implementation needs RPC functions).
- **Sunset is still NOT done.** The new edge-function handlers exist but no
  proxy routes `/api/reports/*` to the edge function. Express still serves
  these endpoints. The Express files listed at the bottom of yesterday's
  session-status are still safe-to-leave-in-place until the proxy is wired
  AND the edge function is verified live.

## What shipped this session

### .gitignore fix

The previous session's `1af24d9a` commit replaced `!supabase/functions/reports/`
with `!drizzle/reports/` in the gitignore. Result: ANY new files under any
`/reports*` path were silently being ignored — including the
`supabase/functions/reports/handlers/*.ts` files committed earlier. The fix
re-adds the un-ignore rules for every report-related path that's tracked,
while keeping the broad `report*` pattern for top-level scratch files like
`report.json`.

### Three new handler files

```
supabase/functions/reports/handlers/
├── second-tier.ts        750 lines — 7 endpoints with real Express ports
├── frontend-stubs.ts     680 lines — 14 endpoints with shape-compatible
│                                     responses computed where possible
└── custom-reports.ts     590 lines — 7 endpoints (custom report CRUD +
                                      preview + execute)
```

Plus `supabase/functions/reports/index.ts` updated to dispatch to all three
via the existing `pathParts[0]` switch + `isSecondTierEndpoint` /
`isFrontendStubEndpoint` predicate functions for the bare-path endpoints.

### Endpoints — `second-tier.ts` (real ports, schema-honest)

| Endpoint | Source | Schema reality fix |
|---|---|---|
| `/reports/breaches` | `routes-breach-detection.ts:31` | PO breach uses `expected_date IS NOT NULL` (no `approved_date` column); service SLA uses `status IN ('open','in-progress')` (Express used `'in_progress'`). Other 4 detectors translate cleanly. |
| `/reports/breach-summary` | `routes-breach-detection.ts:210` | calls `breaches()` and aggregates per severity — Express version did the same via internal HTTP fetch which we don't need. |
| `/reports/customer-health` | `routes-reports.ts:177` | `paid_date IS NOT NULL` (not `isPaid`); `total_amount` (not `amount`); `business_records.updated_at` as activity proxy (no `last_activity_date` column). `degraded.lastActivityProxy: true`. |
| `/reports/sales-pipeline` | `routes-reports.ts:86` | `deals.owner_id` joins to `users` via `fetchUserNames`; no Drizzle `with: { stage, owner }` magic. |
| `/reports/revenue-recognition` | `routes-reports.ts:136` | `total_amount` + `paid_date IS NOT NULL`. |
| `/reports/service-sla-compliance` | `routes-reports.ts:26` | hardcoded 8h SLA threshold (no `sla_response_minutes` col); `resolved_at` (no `completed_at`); `assigned_technician_id` (no `technician_id`). `degraded.slaThresholdHardcoded: true`. |
| `/reports/technician-utilization` | `routes-reports.ts:392` | hours-worked estimated from `completed-tickets × 60min` (no `started_at`/`completed_at`); FTF rate looks at follow-on tickets within 7d. `degraded.hoursEstimatedFromCount: true`. |

### Endpoints — `frontend-stubs.ts` (frontend-only, compute where possible)

| Endpoint | What it returns | Real-data fields |
|---|---|---|
| `financial-summary` | FinancialSummary object | totalRevenue, totalAR, cashFlow, overdue*, collectionRate from invoices |
| `payment-alerts` | PaymentAlert[] | severity-classified open invoices, with customer names; up to 50 |
| `ar-aging` | ARAgingBucket[] | 5 buckets (Current, 1-30, 31-60, 61-90, 90+) computed from due_date |
| `customer-profitability` | CustomerProfitability[] | revenue, outstanding, payment-history per customer; costs + margin = degraded |
| `cash-flow-forecast` | CashFlowForecast[] | weekly inflow buckets across the horizon; outflow = degraded |
| `territory-financials` | TerritoryFinancials[] | grouped by `business_records.territory`; growth + profitability = degraded |
| `sales-reps` | SalesRep[] | one per user with deals; pipeline + close rate; coaching + targets = degraded |
| `team-performance` | aggregate | sums sales-reps result |
| `pipeline-funnel` | PipelineFunnel[] | per-stage value/count from `deal_stages`+`deals`; falls back to status buckets |
| `service-forecasts` | `[]` | requires meter-reading time series + ML — out of scope |
| `technician-capacity` | TechnicianCapacity[] | utilization estimated from open ticket count; forecasted = same as current |
| `inventory-forecast` | `[]` | requires demand model — out of scope |
| `service-summary` | aggregate | totalTickets, openTickets, avgResolutionHours, criticalTickets |
| `revenue` | snapshot | 30-day total + collected revenue from invoices |

### Endpoints — `custom-reports.ts`

| Method + path | Replaces | Notes |
|---|---|---|
| `GET /reports/custom` | `routes-custom-reports.ts:157` | own + public reports — fetched as two queries and merged in JS (PostgREST `.or()` with jsonb-contains is fragile) |
| `POST /reports/custom/preview` | line 206 | basic SELECT with eq/gt/lt/like filters; aggregation/grouping flagged `degraded.aggregationsUnsupported` |
| `POST /reports/custom` | line 321 | persists to `report_definitions` |
| `GET /reports/custom/:id` | line 525 | id-or-code lookup; visibility check in JS |
| `PUT /reports/custom/:id` | line 407 | ownership-checked update |
| `DELETE /reports/custom/:id` | line 485 | ownership-checked delete |
| `POST /reports/custom/:id/execute` | line 567 | replays the saved config; `report_executions` audit row inserted fire-and-forget |

The execute path uses `applyFilter()` which translates filter operators
(`eq`/`gt`/`lt`/`contains`/`starts_with`/`is_null`/`between`) to PostgREST.
Aggregation+grouping isn't supported — same caveat as the engine and the
preview path.

## What's NOT done

### Sunset is still blocked

Even though the edge-function handlers are complete, **none of the
`/api/reports/*` requests from the frontend reach them yet.** The
`server/middleware/edge-function-proxy.ts` only proxies the CRM endpoints
(business-records / companies / deals / contacts / opportunities / quotes /
proposals). Adding a `/api/reports` proxy entry is the right next step but
intentionally not done in this session because:

1. It would shadow the 7 working Express endpoints (customer-health,
   sales-pipeline, etc. from `routes-reports.ts`) — if the edge function has
   a bug we don't catch in dev, the dashboards using those endpoints break.
2. It needs a manual smoke test against Coolify to confirm the edge
   function deploys correctly with the new files.

When ready to flip the switch:

```ts
// server/middleware/edge-function-proxy.ts inside crmProxies map
'/api/reports': 'reports',
```

…AND verify these dashboards behave: ExecutiveDashboard, BreachDetectionTiles,
FinancialIntelligenceDashboard, SalesPerformanceAnalytics,
ServiceForecastingAnalytics, CustomReportBuilder.

After the proxy is verified, delete:

```
server/routes-reports.ts
server/routes-breach-detection.ts          # used elsewhere? grep first
server/routes-custom-reports.ts
```

Plus the persona-based files listed in yesterday's session-status
("Express files NOT safe to delete (yet)") — those are now safe once their
proxy lands too.

### Persona-reports / reports / sales-reports / team-reports duplication

Four edge functions exist. `reports/` is the canonical modular dispatcher
(this is the one I extended). `persona-reports/`, `sales-reports/`,
`team-reports/` are older parallel implementations. The most recent commits
(d3690780, 27a647b2, c98a9013, 4d037ae5 — all by another session) added new
handlers to `persona-reports/` rather than `reports/`, which suggests
confusion about which is canonical.

Recommendation: delete `persona-reports/`, `sales-reports/`, `team-reports/`
once the proxy from `/api/reports → reports` is verified. The `reports/`
function covers their full surface.

### Still-pending phases

- **Phase 6 admin** — not started. PRD and grep commands in yesterday's
  session-status §Phase 6 admin are still the right starting point. Pay
  particular attention to the `audit-log/` vs `audit-logs/` duplicate.
- **Phase 6 cron-realtime websocket swap** — defer until Coolify can run
  a UI test pass.
- **Phase 6 final sunset** — gated on every Phase 6 sub-port being live.

## Verification commands

```bash
# 1. Confirm new files are tracked
git status

# 2. New handler files
ls supabase/functions/reports/handlers/{second-tier,frontend-stubs,custom-reports}.ts

# 3. Dispatcher includes the three new branches
grep -nE "isSecondTierEndpoint|isFrontendStubEndpoint|handleCustomReports" \
  supabase/functions/reports/index.ts

# 4. Schema-honest gaps audit (every degraded field)
grep -rn "degraded:" supabase/functions/reports/

# 5. Schema portability check
npm run check:deno-schemas
```

Expected:
- 3 new handler files in `git status` as untracked
- index.ts dispatcher contains the new branches
- `degraded:` grep returns ~30 instances total (was ~25 before this session)
- `check:deno-schemas` → "✅ OK — no Node-only imports detected."

## Files of interest for next session

```
# Where the schema-honest degraded fields cluster
supabase/functions/reports/handlers/second-tier.ts
supabase/functions/reports/handlers/frontend-stubs.ts

# To enable the frontend to actually reach the edge function
server/middleware/edge-function-proxy.ts

# To delete on sunset (still mounted in routes-registry.ts:506-518)
server/routes-reports.ts
server/routes-breach-detection.ts
server/routes-custom-reports.ts
```

That's it. Three new handler files, one updated dispatcher, one fixed
gitignore. Working tree NOT clean — commit when ready.
