# Sunset Route Inventory — Phase 6 US-028 Pre-flight

**Status:** initial classification · **Last updated:** 2026-04-24 · **Parent:** `tasks/prd-migration-sunset.md`

This document enumerates every Express file under `server/` and classifies it by migration status. Per the sunset PRD §2.3, producing this inventory is a **mandatory pre-flight** before any deletion. The first pass below is grep-assisted; a final per-file confirmation round must happen before each delete PR.

## Headline numbers

| Category | Count |
|---|---|
| `server/routes/*.ts` | 51 |
| `server/routes-*.ts` (root) | 155 |
| `server/services/*.ts` | 97 |
| **Total Express source files** | **303** |
| Edge functions deployed | 205 |

## Classification buckets

- **A — Migrated and safe to delete** after a 48h soak and route-registry unregistration. Edge function exists + ported by a named PRD + session-confirmed working.
- **B — Partially migrated.** Some endpoints ported, others pending. Don't delete yet; wait for followup PRDs.
- **C — Blocker.** Frontend references exist but edge function does not. Must port (or confirm frontend drop) before sunset.
- **D — Orphan candidate.** No frontend references; file may be stub / feature flag never shipped. Confirm with grep before deleting.

---

## A — Migrated (safe to delete pending soak)

Grouped by phase. Every domain here has a named PRD, an edge function, and a session-status entry confirming it works.

### Phase 2 — Outreach + reconciles
- [ ] `server/routes/apollo-routes.ts` → `supabase/functions/apollo/` (US-008)
- [ ] `server/apollo-client.ts` → merged into `apollo/` (US-008)
- [ ] `server/apollo-storage.ts` → merged into `apollo/` (US-008)
- [ ] `server/routes/knowledge-base-routes.ts` → `supabase/functions/knowledge-base/` (US-010)
- [ ] `server/routes/knowledge-base-admin-routes.ts` → `supabase/functions/knowledge-base/` (US-010)
- [ ] `server/services/knowledge-base-service.ts` → merged into `knowledge-base/` (US-010)
- [ ] `server/routes/performance-routes.ts` → `supabase/functions/performance/` (US-011)

### Phase 3 — Core CRM (US-012 through US-015)
- [ ] `server/routes/lead-scoring-routes.ts` → `supabase/functions/lead-scoring/`
- [ ] `server/routes/lead-intelligence-routes.ts` → `supabase/functions/lead-scoring/`
- [ ] `server/services/lead-intelligence-service.ts`
- [ ] `server/routes-lead-assignment.ts` → `supabase/functions/lead-assignment/`
- [ ] `server/routes-auto-lead-routing.ts` → `supabase/functions/lead-assignment/`
- [ ] `server/services/auto-lead-routing-service.ts`
- [ ] `server/routes/customer-success-routes.ts` → `supabase/functions/customer-success/`
- [ ] `server/routes-customer-success.ts`
- [ ] `server/routes-platform-customer-success.ts`
- [ ] `server/routes/email-marketing-routes.ts` → `supabase/functions/email-marketing/`
- [ ] `server/routes/content-gap-analysis-routes.ts` → `supabase/functions/content-gap-analysis/`
- [ ] `server/services/content-gap-analysis-service.ts`

Note: several auxiliary edge functions from Phase 3 (`assign-lead`, `auto-lead-routing`, `lead-assignment-history`, etc.) were consolidated into the canonical ones. They can stay deployed for now; their source Express files are the delete targets here.

### Phase 4 — Operations (US-016 through US-019)
- [ ] `server/routes/field-service-routes.ts` → `supabase/functions/field-service/`
- [ ] `server/routes/gps-tracking-routes.ts` → `supabase/functions/field-service/`
- [ ] `server/routes/geofence-alerts-routes.ts` → `supabase/functions/field-service/`
- [ ] `server/routes/mileage-routes.ts` → `supabase/functions/field-service/`
- [ ] `server/routes/route-optimization-routes.ts` → `supabase/functions/field-service/`
- [ ] `server/services/route-optimization-service.ts`
- [ ] `server/services/mileage-service.ts`
- [ ] `server/services/geofence-alerts-service.ts`
- [ ] `server/routes/lease-routes.ts` → `supabase/functions/leases/`
- [ ] `server/routes/manufacturer-order-routes.ts` → `supabase/functions/manufacturer-orders/`
- [ ] `server/services/manufacturer-integration-service.ts`
- [ ] `server/routes/task-routes.ts` → `supabase/functions/tasks/`
- [ ] `server/routes/team-collaboration-routes.ts` → `supabase/functions/teams/`
- [ ] `server/services/team-collaboration-service.ts`
- [ ] `server/services/team-alert-service.ts`
- [ ] `server/services/task-scheduling-service.ts`
- [ ] `server/routes-tasks.ts`
- [ ] `server/routes-enhanced-tasks.ts`
- [ ] `server/routes/signature-routes.ts` → `supabase/functions/signatures/`
- [ ] `server/routes-esignature.ts`

### Phase 5 US-020 — AI features
- [ ] `server/routes/ai-documentation-routes.ts` → `supabase/functions/ai-documentation/`
- [ ] `server/routes/ai-employee-routes.ts` → `supabase/functions/ai-employee/`
- [ ] `server/routes/ai-search-knowledge-routes.ts` → `supabase/functions/ai-search/`
- [ ] `server/routes/ai-routes-simple.ts` → merged into `ai-employee/`
- [ ] `server/services/ai-documentation-service.ts`
- [ ] `server/services/ai-employee-service.ts`
- [ ] `server/services/ai-search-knowledge-service.ts`
- [ ] `server/services/claude-ai-service.ts` → replaced by `_shared/anthropic.ts`

### Phase 5 US-021 — Auth security
- [ ] `server/routes/api-key-routes.ts` → `supabase/functions/api-keys/`
- [ ] `server/routes/mfa-routes.ts` → `supabase/functions/mfa/`
- [ ] `server/routes/sso-routes.ts` → `supabase/functions/sso/`
- [ ] `server/services/api-key-service.ts`
- [ ] `server/services/mfa-otp-service.ts`
- [ ] `server/services/sms-service.ts` → replaced by `mfa/_twilio.ts`
- [ ] `server/services/sso-service.ts`

### Phase 5 US-022 — Scheduling
- [ ] `server/routes/calendar-routes.ts` → `supabase/functions/meetings/`
- [ ] `server/routes/meeting-scheduling-routes.ts` → `supabase/functions/meetings/`
- [ ] `server/routes/advanced-scheduling-routes.ts` → `supabase/functions/meetings/`
- [ ] `server/routes/meeting-transcription-routes.ts` → `supabase/functions/meeting-transcription/`
- [ ] `server/services/calendar-service.ts`
- [ ] `server/services/meeting-scheduling-service.ts`
- [ ] `server/services/meeting-transcription-service.ts`
- [ ] `server/services/advanced-scheduling-service.ts`
- [ ] `server/services/constraint-solver.ts`
- [ ] `server/services/dynamic-rescheduling-service.ts`

### Phase 6 US-024 — Admin slice (this session, partial)
- [ ] `server/routes-audit-logs.ts` → `supabase/functions/audit-logs/`
- [ ] `server/services/audit-log-service.ts` (verify — may still be called by other services)
- [ ] `server/routes-feature-flags.ts` → `supabase/functions/feature-flags/`
- [ ] `server/services/feature-flags-service.ts`
- [ ] `server/routes-settings.ts` → `supabase/functions/user-settings/`
- [ ] `server/routes/chrome-extension-routes.ts` → `supabase/functions/chrome-extension/`

### Phase 6 US-025 — Content engagement (this session)
- [ ] `server/routes/article-bookmarks-routes.ts` → `supabase/functions/knowledge-base/handlers/bookmarks.ts`
- [ ] `server/routes/article-ratings-routes.ts` → `supabase/functions/knowledge-base/handlers/ratings.ts`
- [ ] `server/routes/reading-history-routes.ts` → `supabase/functions/knowledge-base/handlers/reading-history.ts`

### Phase 6 US-023 — Reports (director only; 9 personas pending)
- [ ] `server/routes/director-reports-api.ts` → `supabase/functions/persona-reports/handlers/director.ts`
- [ ] `server/services/director-reporting-service.ts` → `drizzle/reports/director.sql`

### Phase 5/6 — Shared pieces
- [ ] `server/services/email-service.ts` → replaced by `_shared/sendgrid.ts` (Phase 3)
- [ ] `server/services/pdf-generation-service.ts` → replaced by `leases/_pdf.ts` + future pdf-lib work
- [ ] `server/services/document-generation-service.ts` → depends on `pdf-generation-service`
- [ ] `server/services/document-ocr-ai-service.ts` → reused pattern, needs confirmation

**Category A subtotal:** ~60 files confirmed migratable. The long PR 1 cleanup.

---

## B — Partially migrated (hold off)

### Reports (US-023 — director ported, 9 personas + engine pending)
- `server/routes/executive-reports-api.ts` + `executive-reporting-service.ts`
- `server/routes/sales-reports-api.ts` + `sales-reporting-service.ts`
- `server/routes/sales-manager-reports-api.ts` + `sales-manager-reporting-service.ts`
- `server/routes/sales-supervisor-reports-api.ts` + `sales-supervisor-reporting-service.ts`
- `server/routes/service-reports-api.ts` + `service-reporting-service.ts`
- `server/routes/service-manager-reports-api.ts` + `service-manager-reporting-service.ts`
- `server/routes/service-supervisor-reports-api.ts` + `service-supervisor-reporting-service.ts`
- `server/routes/team-reports-api.ts` + `team-reporting-service.ts`
- `server/routes/warehouse-reports-api.ts` + `warehouse-reporting-service.ts`
- `server/routes/reporting-api.ts` — the generic engine (definitions/run/schedule)
- `server/routes-reporting.ts`
- `server/routes-reporting-architecture.ts`
- `server/routes-reporting-definitions.ts`
- `server/routes-reports.ts`
- `server/routes-custom-reports.ts`
- `server/routes-scheduled-reports.ts`

**Blocker for sunset.** Tracked in `tasks/followup-reports-migration.md`.

### Admin (US-024 — ~10% done, large surface untouched)
- `server/routes/admin-seed-routes.ts` (1,552 lines — RBAC + seed mixed)
- `server/routes-admin-stats.ts`
- `server/routes-admin-subscriptions.ts`
- `server/routes-admin-workflows.ts`
- `server/routes-root-admin.ts`
- `server/routes-enhanced-rbac.ts` (866 lines)
- `server/routes-session-management.ts`
- `server/routes-tenant-onboarding.ts`
- `server/routes-onboarding.ts`
- `server/routes-white-label.ts`
- `server/routes-trial.ts`
- `server/services/tenant-onboarding-service.ts`
- `server/services/trial-management-service.ts`
- `server/services/user-lifecycle-service.ts`
- `server/services/white-label-service.ts`

**Blocker for sunset.** PRD calls for `docs/admin-parity.md` audit before any of these are touched.

### Billing (not fully ported this migration)
- `server/routes/advanced-billing-routes.ts`
- `server/routes/automated-billing-routes.ts`
- `server/routes-billing-core.ts`
- `server/routes/billing.ts`
- `server/services/advanced-billing-service.ts`
- `server/services/automated-billing-service.ts`
- `server/services/billing-analytics-service.ts`
- `server/services/billing-engine-service.ts`
- `server/services/subscription-service.ts`
- `server/services/subscription-jobs.ts`
- `server/services/stripe-service.ts`

**Status uncertain.** The Phase 2 billing-reconcile PRD exists (`tasks/prd-migration-billing-reconcile.md`); check whether it was executed. The existing `supabase/functions/billing/` edge function covers SOME of this. Full audit needed.

---

## C — Likely blockers (frontend calls, no edge function)

Requires per-file frontend grep to confirm. Initial suspects:

### Likely called by frontend, no obvious edge function
- `server/routes-business-records.ts` — business records CRUD
- `server/routes-customers.ts`
- `server/routes-contacts.ts`
- `server/routes-companies.ts`
- `server/routes-deals.ts` + `routes-deals-management.ts` + `routes-deal-tags.ts`
- `server/routes-opportunities.ts`
- `server/routes-products-crud.ts`
- `server/routes-catalog.ts` + `routes-catalog-csv.ts`
- `server/routes-documents.ts`
- `server/routes-notifications.ts`
- `server/routes-user-profile.ts`
- `server/routes-auth-core.ts` — auth endpoints (login/logout/session)
- `server/routes-csv-import.ts`
- `server/routes-export.ts`
- `server/routes-mobile.ts` + `routes-mobile-api.ts` + `routes-mobile-technician.ts`

These appear to be basic CRUD surfaces. Supabase-JS auto-generates PostgREST for tables — it's plausible they're NOT needed as edge functions and the frontend talks directly to `/rest/v1/*`. Verify with frontend grep before classifying.

### Likely webhooks (silent — no frontend caller)
- `server/routes-csp-report.ts` — CSP violation reports
- `server/routes-gdpr.ts` + `routes-gdpr-core.ts`
- `server/routes-breach-detection.ts`
- `server/routes-data-enrichment.ts`

Webhook paths need explicit enumeration; they bypass the frontend grep.

---

## D — Orphan candidates (awaiting confirmation)

Files that look like they were written but never fully wired. Per PRD §2.3, expect 50-80 orphans. Candidates (grep-verify each):

- `server/routes-modular-dashboard-broken.ts` — filename self-identifies
- `server/routes-misc-stubs.ts` — stubs
- `server/routes-pagination.ts` — cross-cutting helper, not a domain
- `server/routes-integrations-real.ts` vs `routes-integrations.ts` — duplicate?
- `server/routes-platform-activities.ts`, `platform-analytics.ts`, `platform-business-records.ts`, `platform-deals.ts` — platform-admin variants, status unclear
- `server/routes-incident-response.ts` + `services/incident-response-service.ts`
- `server/routes-dod-enforcement.ts`
- `server/routes-google-indexing.ts` + `services/google-indexing-service.ts`
- `server/routes-seo.ts` + `routes-seo-core.ts` + `services/seo-service.ts`
- `server/routes-social-media.ts`
- `server/routes-software-products.ts`
- `server/routes-print-cost-calculator.ts` + `services/print-cost-calculator-service.ts`
- `server/routes-demo-scheduling.ts`
- `server/routes-sample-data.ts`
- `server/routes-signup-crm.ts`
- `server/routes-today-dashboard.ts`
- `server/routes-validate.ts`
- `server/routes-accessibility.ts`
- `server/routes-erp-integration.ts`
- `server/routes-quickbooks-integration.ts` (verify; may be active)
- `server/routes-salesforce-integration.ts` (verify)
- `server/routes-contract-alerts.ts` + `contract-renewal.ts`
- `server/routes-equipment-disposal.ts` + `equipment-lifecycle-state-machine.ts` + `equipment-qr.ts`
- `server/routes-integration-hub.ts`
- `server/routes-intelligent-alerts.ts` + `services/intelligent-alerts-service.ts`
- `server/routes-manufacturer-integration.ts`
- `server/routes-oid-mappings.ts`
- `server/routes-operations-extended.ts`
- `server/routes-predictive-analytics.ts` + `routes-predictive-maintenance-hub.ts` + `routes-predictive-service-dispatch.ts` + `services/predictive-service-dispatch-service.ts`
- `server/routes-preventive-maintenance.ts` + `routes-proactive-maintenance.ts`
- `server/routes-pricing.ts` + `routes-product-pricing.ts` + `routes-product-models.ts` + `services/pricing-service.ts` + `services/product-pricing-service.ts`
- `server/routes-purchase-orders.ts`
- `server/routes-record-layout.ts`
- `server/routes-remote-monitoring.ts` + `routes-device-monitoring.ts`
- `server/routes-renewal-management.ts`
- `server/routes-sales-forecasting.ts` + `financial-forecasting.ts`
- `server/routes-sales-handoff.ts` + `routes-sales-rep-assignments.ts` + `routes-territory-management.ts`
- `server/routes-saved-views.ts`
- `server/routes-security-compliance.ts` + `routes-security-dashboard.ts` + `services/threat-detection-service.ts`
- `server/routes-service-analysis.ts` + `routes-service-dispatch.ts` + `services/predictive-service-dispatch-service.ts`
- `server/routes-technician-management.ts`
- `server/routes-templates.ts`
- `server/routes-universal-search.ts`
- `server/routes-warehouse.ts` + `routes-warehouse-fpy.ts`
- `server/routes-workflow-automation.ts` + `routes-workflow-mobile.ts` + `services/workflow-event-service.ts` + `services/workflow-execution-service.ts` + `services/workflow-triggers.ts`
- `server/routes-bulk-operations.ts` + `routes-crm-bulk.ts`
- `server/routes-dashboard-customization.ts` + `routes-dashboard-layouts.ts` + `routes-dashboards-core.ts` + `routes-modular-dashboard.ts`
- `server/routes-disposable-emails.ts` + `services/disposable-email-service.ts`
- `server/routes-email-parser.ts` + `services/email-monitor-service.ts` + `services/ai-email-parser-service.ts`
- `server/routes-enhanced-service.ts`
- `server/routes-mobile-logs.ts`
- `server/routes-customer-numbers.ts` + `company-ids.ts`
- `server/routes-customer-portal.ts` + `services/customer-portal-service.ts`
- `server/routes-ai-analytics.ts` + `routes-ai-gpt5.ts` + `services/gpt5-service.ts`

**Many of the above may have been wired to the frontend historically; do not delete without a grep confirmation.**

---

## Confirmed NOT migrating (infrastructure kept)

- `server/health-routes.ts` — replaced by `supabase/functions/health/`
- `server/middleware/supabase-auth.ts` — replaced by `_shared/auth.ts`
- `server/middleware/enhanced-rbac-middleware.ts` — replaced by `_shared/rbac.ts` + per-function `_rbac.ts`

## Shared module import check

Before any deletion, run:

```bash
# Edge functions must not import from server/
grep -rE "from '\.\./\.\./\.\./server" supabase/ && echo "FAIL"

# Shared Drizzle schemas are OK
grep -rE "from '\.\./\.\./\.\./shared" supabase/ | wc -l  # expect > 0
```

Any `FAIL` line = the edge function has a dangling import and the corresponding server file is a blocker.

---

## Recommended deletion plan

Per the sunset PRD §3, 5-PR cadence:

### PR 1 — Low-risk deletions (this session's scope if time permits)
Only **Category A files that have zero frontend references**. That's a subset of A — a file may be migrated AND the frontend may still call the old path. Frontend update required first.

Files that most clearly fit: the Phase 5 auth ports (`api-key-routes`, `mfa-routes`, `sso-routes`) since the frontend routing cleanup (US-029) also needs to happen anyway.

### PR 2 — Category A after frontend update
All Category A files once frontend is calling edge function paths. Needs `client/src/lib/config.ts` review.

### PR 3 — Category D after confirmation
Orphan candidates confirmed dead via grep + 24h error-rate watch.

### PR 4 — Category B once ports land
Reports, admin — after the followup PRDs execute.

### PR 5 — Terminal cleanup
`server/index.ts`, `server/db.ts`, `server/storage.ts`, `server/routes.ts`, Dockerfile, k8s/, package.json trim.

## Gaps in this document

1. Per-file frontend reference grep — not performed. Next step for a maintainer picking this up.
2. `server/routes-registry.ts` barrel decomposition — this registry imports from `server/domains/` which wasn't inspected here; some files listed under D may actually be wired live via a domain barrel.
3. `server/integrations/` (Salesforce, QuickBooks, etc.) — directory exists but not enumerated above. Separate audit needed.
4. `server/database-updater/` — test-data generator. Per cron-realtime PRD, consider converting to pg_cron or deleting.
5. `server/tests/` — Express-era tests. Replaced by Deno tests in each edge function. Delete with PR 5.
