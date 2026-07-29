# Supabase Transition Remediation (SUPA-###)

Living tracker for the work stream that fixes breakage introduced when production
moved from **Neon Postgres + Express** to **self-hosted Supabase** (Edge Functions
+ Postgres pooler + GoTrue). Stories live in `prd.json` under the `SUPA-` id prefix.

## Root cause (the reframing)

Neon → Supabase was mostly a Postgres **host** swap (that part is healthy). The
breakage came from three things that rode along and were never finished:

1. **The API layer moved from Express to Supabase Edge Functions.** In production
   there is **no Express server** — the static frontend calls
   `functions.printyx.net/<fn>/*` directly (`client/src/lib/queryClient.ts` →
   `getApiUrl`; dispatcher `supabase/functions/server.ts`). `server/routes-*.ts`
   is **dev-only**. Any endpoint never ported to an edge function 404s in prod.
2. **Migration bookkeeping broke.** `drizzle/migrations/meta/_journal.json` lists
   only 12 migrations (0000–0011); files 0012–0028 + duplicate-numbered 0008–0011
   were hand-authored and never journaled, so `npm run db:migrate` applies nothing
   past 0011 → the live DB is missing schema.
3. **Pages built against mock shapes** return 200 but render blank/fake data.

Plus (4) env/auth/connection integrity (baked frontend anon key, pooler username
format, SSL).

## Breakage classes → epics

| Epic | Class | Stories |
|---|---|---|
| 1 | DB / migration reconciliation | SUPA-001..005 |
| 2 | Missing edge fns (prod 404) | SUPA-010..017 |
| 3 | Divergent Express/edge (dev≠prod) | SUPA-020..024 |
| 4 | Data-contract mismatches | SUPA-030..031 |
| 5 | Env / auth / connection | SUPA-040..041 |

## Story status

Legend: ✅ done · 🟡 in progress · ⛔ blocked-on-user · ⬜ not started

| Story | Title | Status | Notes |
|---|---|---|---|
| SUPA-000 | Tracking epic | ✅ | This doc. |
| SUPA-001 | Introspect live schema | ⛔ | Needs working direct-Postgres creds (see "Blocked" below). |
| SUPA-002 | Reconcile drizzle journal | 🟡 | File/journal reconciliation is offline-doable; final verify needs DB (SUPA-001). |
| SUPA-003 | Apply missing migrations | ⛔ | Needs backup + prod/staging DB access. HIGH RISK. |
| SUPA-004 | Remove PGRST204 fallbacks | ⬜ | Depends on SUPA-003. |
| SUPA-005 | CI guard: journal ↔ files | ✅ | `scripts/check-migration-journal.mjs` passes (40 files/40 entries) and is now wired into the CI quality gate (`npm run check:migrations`, ci.yml after check:routes). |
| SUPA-010 | Triage 45 missing-edge | ✅ | Classified below: 3 ALIAS · 37 PORT · 5 DEAD. Drives SUPA-011 (alias), SUPA-012..016 (port), SUPA-017 (dead). |
| SUPA-011 | Dispatcher aliases | ⬜ | Depends on SUPA-010. |
| SUPA-012 | Port: forecasting/AI | ⬜ | Depends on SUPA-010 (+ schema for some). |
| SUPA-013 | Port: service/field | ⬜ | Depends on SUPA-010. |
| SUPA-014 | Port: financial/contracts | ⬜ | Depends on SUPA-010 (+ SUPA-003). |
| SUPA-015 | Port: platform/security | ⬜ | Depends on SUPA-010. |
| SUPA-016 | Port: workflow/documents | ⬜ | Depends on SUPA-010. |
| SUPA-017 | Remove DEAD calls | ⬜ | Depends on SUPA-010. |
| SUPA-020 | Triage 59 divergent | ✅ | Classified below: 49 PROXY · 6 INVESTIGATE · 2 KEEP-EXPRESS · 2 RETIRE-EXPRESS. Drives SUPA-021..024. |
| SUPA-021 | Converge: financial | ⬜ | Depends on SUPA-020. |
| SUPA-022 | Converge: CRM/sales | ⬜ | Depends on SUPA-020. |
| SUPA-023 | Converge: service/inventory | ⬜ | Depends on SUPA-020. |
| SUPA-024 | Converge: platform/admin | ⬜ | Depends on SUPA-020. |
| SUPA-030 | Audit mock-shape pages | ⬜ | Read-only; next after triages. |
| SUPA-031 | Fix top contract mismatches | ⬜ | Depends on SUPA-030. |
| SUPA-040 | Verify prod frontend anon key | ⛔ | Needs Cloudflare/wrangler build env + prod login test. |
| SUPA-041 | Document/harden DB connection | ⛔ | Needs correct Supavisor creds to verify. |

## ⛔ Blocked-on-user — what I need from you

These cannot proceed without input; everything else is being worked autonomously.

1. **Direct-Postgres / Supavisor credentials** (unblocks SUPA-001, 041, then 002/003):
   - A `DATABASE_URL_MIGRATE` / `DIRECT_DATABASE_URL` pointing at **direct Postgres
     (usually 5432)**, not the 5433 pooler.
   - The correct Supavisor username format (`role.tenant`) for the 5433 pooler.
   - The correct `DB_SSL` / `DB_SSL_REJECT_UNAUTHORIZED` values per port.
   - Audit evidence: local probe failed with `Tenant or user not found` (5433, no
     SSL) and `server does not support SSL connections` (5433, SSL).
2. **Prod deploy / build access** (unblocks SUPA-040): which
   `VITE_SUPABASE_ANON_KEY` the deployed Cloudflare bundle was built with, and
   ability to rebuild/redeploy if stale.
3. **Explicit go-ahead + backup confirmation** before SUPA-003 applies any
   migration to a live DB (staging rehearsal first).

## SUPA-010 — missing-edge classification (45 domains)

The 45 frontend-called `/api/<domain>` prefixes with no same-named edge fn, classified
alias / port / dead. Buckets drive SUPA-011 (ALIAS), SUPA-012..016 (PORT), SUPA-017 (DEAD).

| domain | bucket | evidence (fe call · express handler · candidate edge fn) | action |
|---|---|---|---|
| accessories | ALIAS | `EnhancedProductAccessories.tsx:78` · `routes-products-crud.ts:747` · edge `product-accessories` handles `compatibility` | server.ts override `accessories`→`product-accessories` + crmProxies |
| documents | ALIAS | `DocumentBuilder.tsx:118` · (no Express reg) · edge `document-management` (CRUD `/`,`/:id`) | server.ts override `documents`→`document-management` + crmProxies |
| lease-payments | ALIAS | `LeaseDetail.tsx:82` · leases router · edge `leases` (`handlers/payments.ts`; server.ts already overrides `lease-payments`→`leases`) | add crmProxies entry for dev parity (prod override already exists) |
| ai | PORT | `GPT5Dashboard.tsx:91` · `routes-ai-gpt5.ts` | build `ai` edge fn |
| ai-analytics | PORT | `AIAnalyticsDashboard.tsx:24` · `routes-sample-data.ts:1663` (MOCK) | build `ai-analytics` edge fn (backing is mock today) |
| approvals | PORT | `my-approvals.tsx:56` · `workflow-automation-routes.ts:879` | build `approvals` edge fn (or fold into workflow-automation) |
| assignment-groups | PORT | `assignment-groups.tsx:68` · `workflow-automation-routes.ts:759` | build `assignment-groups` edge fn |
| business-process | PORT | `BusinessProcessOptimization.tsx:190` · `routes-business-process-optimization.ts` | build edge fn |
| chatbot | PORT | `ChatbotConsole.tsx:144` · `routes-chatbot.ts` | build edge fn |
| churn-risk | PORT | `CustomerRisk.tsx:166` · `routes-churn-risk.ts` | build edge fn |
| content | PORT | `seoUtils.tsx:230` · `routes-content-marketing.ts` | build edge fn |
| contract-pnl | PORT | `ContractPnlDetail.tsx:91` · `routes-contract-pnl.ts` | build edge fn |
| contract-tiered-rates | PORT | `MeterBilling.tsx:96` · `routes-products-crud.ts:1733` | build edge fn |
| daily-briefing | PORT | `DailyBriefings.tsx:100` · `routes-daily-briefing.ts` | build edge fn |
| email-autopilot | PORT | `EmailAutopilot.tsx:117` · `routes-email-autopilot.ts` | build edge fn |
| email-parser | PORT | `settings/email-parser-settings.tsx:77` · `routes-email-parser.ts` | build edge fn |
| equipment-disposal | PORT | `EquipmentDisposalDialog.tsx:118` · `routes-equipment-disposal.ts` | build edge fn |
| erp-integration | PORT | `ERPIntegration.tsx:327` · `routes-erp-integration.ts` | build edge fn |
| financial-forecasting | PORT | `role-dashboard-config.ts:119` · `routes-financial-forecasting.ts` | build edge fn |
| incident-response | PORT | `IncidentResponseSystem.tsx:287` · `routes-incident-response.ts` | build edge fn |
| lead-intelligence | PORT | `LeadIntelligenceDashboard.tsx:101` · `lead-intelligence-routes.ts` | build edge fn |
| meter-reads | PORT | `MeterReadReview.tsx:115` (`/submissions`) · `routes-meter-read-vision.ts` · NOTE `meter-readings` edge fn is billing CRUD, NOT a valid alias | build `meter-reads` (AI vision review) edge fn |
| pipeline-forecast | PORT | `SalesCommandCenter.tsx:104` · `routes-sales-forecasting.ts` | build edge fn |
| portal-service | PORT | `CustomerPortalService.tsx:5` · `routes-portal-service.ts` | build edge fn |
| predictive-failure | PORT | `ServicePredictions.tsx:127` · `routes-predictive-failure-dispatch.ts` | build edge fn |
| qbr | PORT | `CustomerQbrs.tsx:87` · `routes-qbr.ts` | build edge fn |
| record-layout-config | PORT | `RecordPageLayout.tsx:251` · `routes-record-layout.ts` | build edge fn |
| renewal-autoquote | PORT | `RenewalAutoQuote.tsx:143` · `routes-renewal-autoquote.ts` | build edge fn |
| sales-forecasts | PORT | `SalesCommandCenter.tsx:98` · `routes-sales-forecasting.ts` | build edge fn |
| sales-performance | PORT | `role-dashboard-config.ts:72` · `routes-sales-forecasting.ts` | build edge fn |
| salesforce | PORT | `SalesforceIntegration.tsx:85` · `routes-salesforce-integration.ts` | build edge fn (deferrable — needs live creds) |
| security-compliance | PORT | `SecurityComplianceManagement.tsx:282` · `routes-security-compliance.ts` | build edge fn |
| service | PORT | `KnowledgeSearch.tsx:80` · `routes-service-knowledge.ts` + `routes-proactive-maintenance.ts` | build `service` edge fn (aggregates `/api/service/*`) |
| task-workflows | PORT | `WorkflowBuilderPage.tsx:101` · `routes-task-workflows.ts` | build edge fn |
| toner-replenish | PORT | `TonerReplenish.tsx:159` · `routes-toner-replenish.ts` | build edge fn |
| truck-stock | PORT | `TruckStocking.tsx:116` · `routes-truck-stock.ts` | build edge fn |
| voice-agent | PORT | `VoiceAgent.tsx:159` · `routes-voice-agent.ts` | build edge fn |
| voice-ticket-close | PORT | `VoiceTicketClose.tsx:241` · `routes-voice-ticket-close.ts` | build edge fn |
| white-label | PORT | `WhiteLabelDashboard.tsx:37` · `routes-white-label.ts` | build edge fn |
| workflow-automation | PORT | `AutopilotDashboard.tsx:44` (`/dashboard`) · real runtime `workflow-automation-routes.ts` · edge `automation`/`workflows` lack `/dashboard` | build `/dashboard` into `automation` edge fn |
| platform | DEAD | `role-dashboard-config.ts:173,186,192` · NO Express · NO `platform` edge fn (only `platform-*`) | remove/repoint dashboard `dataSource` strings |
| predictive-analytics | DEAD | `PredictiveAnalytics.tsx:125` · NO Express · NO same-name edge | gate/remove (SUPA-017) |
| quote-templates | DEAD | `quote-templates.tsx:80` · NO Express · NO edge fn | gate/remove (SUPA-017) |
| system-monitoring | DEAD | `role-dashboard-config.ts:180` · NO Express · NO edge fn | remove/repoint dashboard `dataSource` |
| technician-sessions | DEAD | `TechnicianTicketWorkflow.tsx:184` · NO Express · NO edge fn | gate/remove (SUPA-017) |

**Corrections vs the story's example hints:** `meter-reads` is NOT an alias to `meter-readings`
(the latter is billing meter CRUD with no `/submissions`; `/api/meter-reads` is the AI-vision
review queue → PORT). `workflow-automation`'s `/dashboard` is mock-backed and unserved by the
existing `automation`/`workflows` edge fns → PORT, not a clean alias.

## SUPA-020 — both-divergent classification (59 domains)

All 59 have BOTH a real Express handler and a same-named edge fn. `EXPRESS_CANONICAL`
(`scripts/lib/route-parity.mjs:37`) contains none of them. Buckets drive SUPA-021..024:
PROXY = add to `crmProxies` (dev→edge; makes dev match prod, low-risk); RETIRE-EXPRESS =
delete the superseded Express handler; KEEP-EXPRESS = edge is a stub, Express must stay
until real CRUD is ported; INVESTIGATE = data-contract/security review before acting.

**PROXY (49):** auto-lead-routing, auto-supply-replenishment, commission, contract-renewal,
contracts, dashboards, deal-desk-copilot, demos, devices, document-management, enrichment,
equipment, financial, fleet, gdpr, import, integrations, inventory, invoices, leads,
maintenance, managed-services, manufacturer-integrations, meter-readings, mobile, mobile-field,
onboarding, parts-orders, predictive-dispatch, pricing, product-accessories, product-models,
professional-services, projects, purchase-orders, rbac, remote-monitoring, root-admin, seo,
service-analysis, service-analytics, service-tickets, software-products, subscriptions, supplies,
technician-management, templates, user, warehouse-operations.
Each edge fn is substantive (uses `normalizePath` or a safe `pathParts[0]`-as-resource parse,
hits real tables); prod already calls these edge fns directly, so proxying only aligns dev.

**INVESTIGATE (6):**
- `admin` — Express wraps `enforceIpWhitelist` + `requireMfaForAdmins`; verify the edge enforces the same gate + `/tenant-stats` parity (security-sensitive).
- `catalog` — `proxy.ts` (~line 254) still names it in the "NOT safe to proxy yet" tracked exceptions; multipart CSV import (`/models/import`) parity must be confirmed.
- `crm` — edge returns `mockStats`/`mockProgress` for goals/progress; port real data before proxying.
- `dashboard` — edge (138L) is a stub with hardcoded modules/card-config and DIFFERENT endpoints than the Express `/metrics`,`/recent-tickets`; data-contract review needed.
- `database-updater` — a DDL/schema-ops tool; confirm edge safety before exposing.
- `quickbooks` — edge lacks the OAuth `/callback` the Express serves; callback host/token-storage divergence.

**KEEP-EXPRESS (2):** `deal-stages` (edge 45L hardcoded stub, no POST), `performance`
(edge 82L hardcoded-metrics stub) — port real CRUD into the edge fn before it can win.

**RETIRE-EXPRESS (2):** `audit-logs` (edge header: "Replaces routes-audit-logs.ts"),
`content-gap-analysis` (edge header: "Replaces content-gap-analysis-routes.ts + service") —
delete the superseded thin Express handler after confirming no other caller.

## Execution log

- **Iteration 1:** Created this tracker (SUPA-000 ✅). Flagged SUPA-001/003/040/041
  as blocked-on-user. Launched read-only triage of SUPA-010 (45 missing-edge) and
  SUPA-020 (59 divergent).
- **Iteration 2:** SUPA-005 ✅ (journal guard wired into CI). Completed both read-only
  classifications: SUPA-010 ✅ (3 ALIAS / 37 PORT / 5 DEAD) and SUPA-020 ✅
  (49 PROXY / 6 INVESTIGATE / 2 KEEP-EXPRESS / 2 RETIRE-EXPRESS), tables above. These
  unblock SUPA-011 (aliases), SUPA-012..017 (ports/dead), SUPA-021..024 (convergence).
  SUPA-011 and SUPA-021's PROXY bucket are now mechanically actionable (add crmProxies
  entries) and are the cheapest next wins; the INVESTIGATE/stub domains are flagged.
