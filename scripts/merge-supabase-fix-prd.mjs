#!/usr/bin/env node
// merge-supabase-fix-prd.mjs
//
// Appends the "Supabase transition remediation" stories (SUPA-###) into the
// root prd.json. These capture the findings from the post-Neon→Supabase
// deep-dive: production moved to Supabase Edge Functions + self-hosted Postgres,
// but the migration journal, the route/edge parity, and several data contracts
// never fully made the transition — leaving many pages broken.
//
// Re-runnable: preserves `passes: true` on any SUPA-* story already in prd.json,
// then removes prior SUPA-* entries and re-appends the fresh set. Safe to run
// after editing this file.
//
// Usage: node scripts/merge-supabase-fix-prd.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const prdPath = resolve(repoRoot, 'prd.json');
const prd = JSON.parse(readFileSync(prdPath, 'utf8'));

// The 45 domains the frontend calls but that have NO edge function -> hard 404
// in production. Source: docs/route-ownership-baseline.json (missingEdge) as of
// the deep-dive audit + `node scripts/check-route-ownership.mjs`.
const MISSING_EDGE = [
  'accessories', 'ai', 'ai-analytics', 'approvals', 'assignment-groups',
  'business-process', 'chatbot', 'churn-risk', 'content', 'contract-pnl',
  'contract-tiered-rates', 'daily-briefing', 'documents', 'email-autopilot',
  'email-parser', 'equipment-disposal', 'erp-integration', 'financial-forecasting',
  'incident-response', 'lead-intelligence', 'lease-payments', 'meter-reads',
  'pipeline-forecast', 'platform', 'portal-service', 'predictive-analytics',
  'predictive-failure', 'qbr', 'quote-templates', 'record-layout-config',
  'renewal-autoquote', 'sales-forecasts', 'sales-performance', 'salesforce',
  'security-compliance', 'service', 'system-monitoring', 'task-workflows',
  'technician-sessions', 'toner-replenish', 'truck-stock', 'voice-agent',
  'voice-ticket-close', 'white-label', 'workflow-automation',
];

// The 59 domains where BOTH an Express route and an edge fn exist but are not
// proxied together -> dev and prod can silently diverge (wrong shape / blank /
// phantom columns). Source: docs/route-ownership-baseline.json (bothDivergent).
const BOTH_DIVERGENT = [
  'admin', 'audit-logs', 'auto-lead-routing', 'auto-supply-replenishment',
  'catalog', 'commission', 'content-gap-analysis', 'contract-renewal',
  'contracts', 'crm', 'dashboard', 'dashboards', 'database-updater',
  'deal-desk-copilot', 'deal-stages', 'demos', 'devices', 'document-management',
  'enrichment', 'equipment', 'financial', 'fleet', 'gdpr', 'import',
  'integrations', 'inventory', 'invoices', 'leads', 'maintenance',
  'managed-services', 'manufacturer-integrations', 'meter-readings', 'mobile',
  'mobile-field', 'onboarding', 'parts-orders', 'performance',
  'predictive-dispatch', 'pricing', 'product-accessories', 'product-models',
  'professional-services', 'projects', 'purchase-orders', 'quickbooks', 'rbac',
  'remote-monitoring', 'root-admin', 'seo', 'service-analysis',
  'service-analytics', 'service-tickets', 'software-products', 'subscriptions',
  'supplies', 'technician-management', 'templates', 'user', 'warehouse-operations',
];

const CHECK = 'Typecheck passes: npm run check';
const ROUTES = 'Route-ownership guard passes and its baseline is ratcheted DOWN: node scripts/check-route-ownership.mjs --update-baseline, review the git diff';

const stories = [
  // ─────────────────────────────────────────────────────────────────────────
  // EPIC 0 — Tracking
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'SUPA-000',
    category: 'audit-routing',
    title: 'EPIC: Post-Neon→Supabase site remediation (tracking)',
    description:
      'As the team, we need a single tracking story for the remediation of breakage introduced when production moved from Neon Postgres + Express to self-hosted Supabase (Edge Functions + Postgres pooler + GoTrue), so the SUPA-### work stream is coordinated and its exit criteria are explicit.',
    acceptanceCriteria: [
      'Root cause is understood and documented: prod has NO Express server — the static frontend calls functions.printyx.net/<fn>/* directly (client/src/lib/queryClient.ts → getApiUrl; dispatcher supabase/functions/server.ts). server/routes-*.ts is dev-only. Any unported endpoint 404s in prod.',
      'Three breakage classes are tracked to closure: (1) orphaned DB migrations → missing schema (SUPA-001..005), (2) missing/divergent edge functions → prod 404 or dev/prod drift (SUPA-010..024), (3) pages built against mock shapes → silent blank/fake data (SUPA-030..031), plus (4) env/auth/connection integrity (SUPA-040..041).',
      'A short living doc (docs/supabase-remediation.md) links every SUPA-### story to its status and owner.',
      'EXIT: check-route-ownership baseline has 0 missingEdge and 0 bothDivergent that are genuinely broken; db:migrate:status shows the live DB fully migrated; no page renders mock/blank due to a contract mismatch.',
    ],
    notes:
      'Umbrella for the deep-dive findings. Suggested execution order: SUPA-040/041 (unblock connectivity+auth) → SUPA-001..005 (schema) → SUPA-010..017 (prod 404s) → SUPA-020..024 (divergence) → SUPA-030..031 (contracts). Severity: P0.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EPIC 1 — Database / migration reconciliation  (root cause #1, highest impact)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'SUPA-001',
    category: 'audit-database',
    title: 'Establish ground-truth of the live Supabase schema (introspection)',
    description:
      'As a developer, I need an authoritative snapshot of what tables/columns actually exist in the self-hosted Supabase Postgres, so migration reconciliation (SUPA-002/003) is driven by facts, not inference. During the audit the live DB could not be introspected locally (pooler returned "Tenant or user not found"; port 5433 rejected SSL).',
    acceptanceCriteria: [
      'A working introspection connection is established: correct Supavisor username format (role.tenant), correct DB_SSL/DB_SSL_REJECT_UNAUTHORIZED, using DIRECT Postgres (typically 5432) via DATABASE_URL_MIGRATE/DIRECT_DATABASE_URL rather than the 5433 pooler for DDL/introspection.',
      'A checked-in report (scripts/db-schema-snapshot output) lists: public table count, presence of the suspected-missing objects (web_forms, email_sequences, email_sequence_enrollments, custom_field_definitions, workflow_executions, auto_orders) and columns (proposals.discount_reason, proposals.share_token, proposal_line_items discount/net columns), and the full contents of drizzle.__drizzle_migrations.',
      'The report explicitly states, per migration 0008–0028, whether its objects are PRESENT or MISSING in the live DB (accounts for the possibility that some were applied via db:push, bypassing the journal).',
      'Finding is recorded in docs/supabase-remediation.md.',
    ],
    notes:
      'Blocks SUPA-002/003. Evidence from audit: local probe failed with Supavisor "Tenant or user not found" (username not role.tenant) and "server does not support SSL connections" on 5433. server/lib/migrate.ts already supports DATABASE_URL_MIGRATE/DIRECT_DATABASE_URL and warns that poolers reset DDL sessions. Severity: P0.',
  },
  {
    id: 'SUPA-002',
    category: 'audit-database',
    title: 'Reconcile the drizzle migration journal with orphaned migration files',
    description:
      'As a developer, I need drizzle/migrations/meta/_journal.json to reflect ALL migration files on disk, because the journal currently lists only 12 entries (0000–0011, the auto-generated ones) while migrations 0012–0028 and several duplicate-numbered 0008–0011 files were hand-authored and never registered. drizzle\'s native migrator only runs journaled migrations, so `npm run db:migrate` silently applies nothing past 0011.',
    acceptanceCriteria: [
      'Root cause documented: _journal.json has 12 entries ending at 0011_pa026_perf_indexes; on disk there are numbered files through 0028 plus duplicate prefixes (two each of 0008/0009/0010/0011, e.g. 0008_client_enrollment_tokens vs 0008_pretty_rocket_raccoon).',
      'Duplicate-numbered migrations are renumbered to a unique, deterministic order (e.g. the hand-authored 0008–0011 client_enrollment_tokens/monitoring_clients_customer_id/client_commands/device_alerts get fresh sequential numbers after 0028) with no two files sharing a prefix.',
      '_journal.json is rebuilt so every file on disk (0000..N) has a matching entry with the correct tag, idx, and a snapshot in meta/ — verified by drizzle-kit (regenerate cleanly, do not hand-forge hashes where avoidable).',
      'The reconciled journal, when checked with `npm run db:migrate:status`, correctly shows applied vs pending against the SUPA-001 snapshot with no crash.',
      CHECK,
    ],
    notes:
      'This is the single biggest root cause of the "features built but broken" reports and the PGRST204 "retry without column" hacks in CLAUDE.md (0019 discount_reason, proposal line-item cols, tenant metadata, custom fields, workflow idempotency index, web_forms, email_sequence_enrollments). Do NOT apply anything in this story — SUPA-002 only makes the ledger correct; SUPA-003 applies. Severity: P0.',
  },
  {
    id: 'SUPA-003',
    category: 'audit-database',
    title: 'Bring the live Supabase DB fully migrated (baseline vs apply, backed up)',
    description:
      'As an operator, I need the reconciled migrations (SUPA-002) actually reflected in the live DB, applying only what is genuinely missing and baselining what already exists, so the schema matches shared/*-schema.ts without destructive re-creation.',
    acceptanceCriteria: [
      'A fresh backup is taken first: npm run db:backup (verify the dump exists in GCS) — no schema change runs until a backup is confirmed.',
      'Per the SUPA-001 snapshot, each pending migration is classified: ALREADY-APPLIED (objects exist, likely via db:push) → mark applied via `npm run db:migrate:baseline` semantics; NOT-APPLIED → apply via `npm run db:migrate`.',
      'Migrations are applied against DIRECT Postgres (not the 5433 pooler) to avoid DDL session resets; the __migration_lock is acquired/released cleanly.',
      'Post-apply verification: `npm run db:migrate:status` reports 0 pending; SUPA-001 introspection re-run confirms web_forms, email_sequences/email_sequence_enrollments, custom_field_definitions, proposals.discount_reason/share_token, proposal_line_items columns, workflow_executions dedupe index all exist.',
      'Run npm run db:backfill if any applied migration has a paired data backfill.',
      'Rehearse on a staging/restored copy before touching production.',
    ],
    notes:
      'Directly unblocks: /api/web-forms (0027), /api/email-sequences (0028), quote discount/margin math (0014/0018/0019), custom fields (0021/0022), workflow runtime idempotency (0025), CRM notes/associations (0023), pipeline legacy map (0024). Severity: P0. HIGH RISK — staging rehearsal + backup mandatory.',
  },
  {
    id: 'SUPA-004',
    category: 'audit-database',
    title: 'Remove PGRST204 "retry-without-column" fallbacks now that columns exist',
    description:
      'As a developer, I want to delete the defensive "retry the write without column X on PGRST204" branches in the edge functions once SUPA-003 proves the columns exist, so writes stop silently dropping data and the code stops hiding schema drift.',
    acceptanceCriteria: [
      'All PGRST204 / isMissingTableError-style fallbacks introduced to tolerate unapplied migrations are located (e.g. proposals fn discount_reason/_note retry; billing handlers isMissingTableError tolerance for genuinely-migrated tables).',
      'For each, confirm via SUPA-001/003 the target column/table now exists, then remove the fallback so a genuine error surfaces instead of being swallowed.',
      'Fallbacks that guard truly-legacy DRIFT tables (e.g. billing_configurations/billing_cycles/billing_adjustments — raw-SQL-only, in no schema) are LEFT in place and annotated as intentional.',
      'A test or manual check confirms the previously-degraded write path now persists the column.',
      CHECK,
    ],
    notes:
      'Depends on SUPA-003. Cleanup story — reduces the "responds but silently drops fields" class. Severity: P2.',
  },
  {
    id: 'SUPA-005',
    category: 'audit-build-ci',
    title: 'CI guard: fail when a migration file is not registered in the journal',
    description:
      'As the team, I want CI to fail if a drizzle/migrations/*.sql file exists without a matching _journal.json entry (or if two files share a numeric prefix), so the SUPA-002 root cause can never silently recur.',
    acceptanceCriteria: [
      'New script scripts/check-migration-journal.mjs asserts: (a) every numbered *.sql has exactly one _journal.json entry, (b) no two migration files share a 4-digit prefix, (c) journal idx ordering is contiguous.',
      'Wired into the same CI step as check-route-ownership (add an npm script, e.g. audit:migrations) and documented in CLAUDE.md Migration Workflow.',
      'Guard passes on the reconciled tree from SUPA-002.',
      CHECK,
    ],
    notes:
      'Prevention. Severity: P2.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EPIC 2 — Production route parity: MISSING edge functions (prod 404s)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'SUPA-010',
    category: 'route-parity',
    title: 'Triage the 45 missing-edge domains into alias / port / dead',
    description:
      'As a developer, I need every domain the frontend calls that has no edge function classified so the porting work (SUPA-011..017) is scoped and nothing 404s silently in production.',
    acceptanceCriteria: [
      `Classify all 45 missingEdge domains into: ALIAS (an edge fn exists under a different name — add a dispatcher override), PORT (Express handler exists, needs a real edge fn), or DEAD (no backing anywhere — remove the frontend call). Domains: ${MISSING_EDGE.join(', ')}.`,
      'For each domain, record: the frontend call site(s), whether a server/routes-*.ts handler exists, whether an edge fn dir could serve it via alias, and the target bucket.',
      'Likely-ALIAS candidates verified or rejected: documents→document-management/files, meter-reads→meter-readings, accessories→product-accessories, workflow-automation→automation/workflows, platform→platform-* fn, sales-forecasts/pipeline-forecast/financial-forecasting→a forecasting fn if one exists.',
      'Output is a checklist in docs/supabase-remediation.md that drives SUPA-011..017.',
    ],
    notes:
      'The 45 come from docs/route-ownership-baseline.json missingEdge. Severity: P1. Feeds all EPIC-2 stories.',
  },
  {
    id: 'SUPA-011',
    category: 'route-parity',
    title: 'Add dispatcher aliases for missing-edge domains that already exist under another name',
    description:
      'As a developer, I want the cheap wins from SUPA-010: domains whose handler already exists under a different edge-fn dir name resolved via a dispatcher override + dev crmProxies entry, so those pages stop 404ing in prod immediately.',
    acceptanceCriteria: [
      'For each ALIAS-bucket domain from SUPA-010, add a route override in supabase/functions/server.ts (mirroring the existing accounts-payable→account-payable / deployment→deployment-readiness / integration-hub→integrations pattern) AND a matching dev crmProxies entry in server/ so dev and prod resolve identically.',
      'Where the alias maps a sub-resource (like dashboard→dashboard-widgets), key off subPath[0] as the existing code does.',
      'Each aliased endpoint returns the shape the page actually reads (verify one live call per alias, not just a 200).',
      ROUTES,
      CHECK,
    ],
    notes:
      'Depends on SUPA-010. Cheapest 404 fixes. Severity: P1.',
  },
  {
    id: 'SUPA-012',
    category: 'edge-migration',
    title: 'Port missing edge fns: revenue intelligence, forecasting & AI',
    description:
      'As a user of the analytics/forecasting/AI surfaces, I need their endpoints to exist in production so the pages stop 404ing.',
    acceptanceCriteria: [
      'Create edge functions (or fold into an existing sibling) for the PORT-bucket domains in this cluster: ai, ai-analytics, predictive-analytics, predictive-failure, pipeline-forecast, sales-forecasts, sales-performance, financial-forecasting, lead-intelligence, daily-briefing, chatbot, voice-agent, voice-ticket-close, qbr, churn-risk.',
      'Each fn: auth via createSupabaseClient(req)→getUser, tenantId from app_metadata (never query params), service-role client for DB, every query filtered by tenant_id, normalizePath(pathname, "<fn>").',
      'Each fn queries the REAL Drizzle tables/columns (confirm against shared/*-schema.ts + applied migrations) — do NOT reproduce phantom tables (see server/routes-predictive-service-dispatch.ts which references non-existent serviceCallsEnhanced/equipmentMetrics/technicianResourcesEnhanced; those need schema first).',
      'Response shape matches exactly what the page reads (pages fall back to mock data on shape mismatch — a wrong shape silently shows fake numbers).',
      'DEAD domains in this cluster (no backing data) are dropped from the frontend instead of faked, and noted.',
      ROUTES,
      CHECK,
    ],
    notes:
      'Depends on SUPA-010 (and SUPA-003 for any tables). Several of these may require new schema+migration before a real fn is possible — flag those as blocked-on-schema. Severity: P1.',
  },
  {
    id: 'SUPA-013',
    category: 'edge-migration',
    title: 'Port missing edge fns: service, field & equipment',
    description:
      'As a service/field user, I need the service and equipment endpoints available in production.',
    acceptanceCriteria: [
      'Create/alias edge functions for PORT-bucket domains: service, meter-reads, toner-replenish, truck-stock, technician-sessions, equipment-disposal.',
      'Same edge-fn conventions as SUPA-012 (auth, tenant scoping, real tables, exact shape).',
      'Reconcile against existing siblings so there is one canonical fn per resource (e.g. meter-reads vs the existing meter-readings fn — prefer alias over a second fn).',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-010. Severity: P1.',
  },
  {
    id: 'SUPA-014',
    category: 'edge-migration',
    title: 'Port missing edge fns: financial, contracts & leasing',
    description:
      'As a finance/contracts user, I need contract P&L, tiered rates, lease payments, renewal autoquote, and quote templates available in production.',
    acceptanceCriteria: [
      'Create edge functions for PORT-bucket domains: contract-pnl, contract-tiered-rates, lease-payments, renewal-autoquote, quote-templates.',
      'quote-templates must serve the shape the quote wizard/proposal-templates UI reads (cross-check proposal_template_content, migration 0015).',
      'Same edge-fn conventions as SUPA-012; every query tenant-scoped; real columns only.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-010, and SUPA-003 for any newly-migrated columns. Severity: P1.',
  },
  {
    id: 'SUPA-015',
    category: 'edge-migration',
    title: 'Port missing edge fns: platform, security, system & external integrations',
    description:
      'As a platform admin, I need the platform/system/security and external-integration endpoints available in production.',
    acceptanceCriteria: [
      'Create/alias edge functions for PORT-bucket domains: platform, system-monitoring, security-compliance, incident-response, white-label, erp-integration, salesforce, portal-service.',
      'Platform-scoped fns gate on root/platform admin (role level >= 7 OR can_access_all_tenants) via the service-role client, matching the platform-* edge fn siblings.',
      'External-integration fns (salesforce, erp-integration) that require third-party credentials store them via the credential vault (encryptCredential → encrypted_config) and never return decrypted creds.',
      'Same edge-fn conventions as SUPA-012.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-010. Some (salesforce/erp) may be genuinely deferred features — mark DEAD/deferred rather than stub if there is no data model. Severity: P1/P2.',
  },
  {
    id: 'SUPA-016',
    category: 'edge-migration',
    title: 'Port missing edge fns: workflow, approvals, documents & content',
    description:
      'As a user of workflow/approvals/documents/content features, I need their endpoints available in production.',
    acceptanceCriteria: [
      'Create/alias edge functions for PORT-bucket domains: workflow-automation, task-workflows, business-process, approvals, assignment-groups, content, documents, record-layout-config, email-autopilot, email-parser, accessories.',
      'workflow-automation must route to the REAL runtime (server/services/workflow-execution-service.ts + workflow-runtime.ts over shared/workflow-automation-schema.ts / the workflow-automation-routes), NOT the unregistered dead mock server/routes-workflow-automation.ts.',
      'documents/accessories are likely ALIASes (document-management/files, product-accessories) — prefer alias.',
      'Same edge-fn conventions as SUPA-012.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-010. Severity: P1/P2.',
  },
  {
    id: 'SUPA-017',
    category: 'route-parity',
    title: 'Remove DEAD frontend calls with no backing endpoint',
    description:
      'As a developer, I want frontend calls classified DEAD in SUPA-010 (no Express handler, no edge fn, no data model) removed or feature-flagged off, so the UI stops firing requests that can only 404.',
    acceptanceCriteria: [
      'Every DEAD-bucket domain from SUPA-010 has its frontend call site removed or gated behind a clearly-disabled feature flag with a user-visible "coming soon"/empty state (no silent failed fetch).',
      'No remaining apiRequest/useQuery targets a DEAD domain.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-010. Severity: P2.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EPIC 3 — De-duplicate bothDivergent domains (dev-works / prod-breaks)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'SUPA-020',
    category: 'route-parity',
    title: 'Triage the 59 both-divergent domains (proxy vs retire)',
    description:
      'As a developer, I need each domain that has BOTH an Express route and an edge fn (unproxied) classified, because these are the "works in dev, wrong/blank in prod" pages — dev hits Express, prod hits a possibly-divergent edge fn.',
    acceptanceCriteria: [
      `For all 59 bothDivergent domains, record whether the edge fn is the canonical/correct implementation and whether the Express handler diverges (different shape, extra query params, phantom columns). Domains: ${BOTH_DIVERGENT.join(', ')}.`,
      'Each domain classified: PROXY (edge fn is correct → add dev crmProxies entry so dev also hits it, then retire the Express handler) or FIX-THEN-PROXY (edge fn is wrong/incomplete → fix it first).',
      'Watch for the CLAUDE.md pitfall: a query param supported only by Express (e.g. ?codes=) silently breaks in prod — flag any such param divergence.',
      'Output drives SUPA-021..024.',
    ],
    notes: 'From docs/route-ownership-baseline.json bothDivergent. Severity: P1.',
  },
  {
    id: 'SUPA-021',
    category: 'route-parity',
    title: 'Converge divergent domains: financial, billing & contracts',
    description:
      'As a finance user, I want dev and prod to hit the same implementation for financial/billing/contract domains so prod behavior matches dev.',
    acceptanceCriteria: [
      'For this cluster (contracts, contract-renewal, invoices, financial, quickbooks, subscriptions, commission, pricing, purchase-orders, parts-orders): make dev proxy to the canonical edge fn (crmProxies) and retire the duplicate Express handler, OR fix the edge fn first per SUPA-020.',
      'Cross-check the known billing/invoice column reality (invoices: total_amount/amount_paid/balance_due/invoice_status/paid_date — NOT balance/paid/total/tax) so the converged handler uses real columns.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-020. Severity: P1.',
  },
  {
    id: 'SUPA-022',
    category: 'route-parity',
    title: 'Converge divergent domains: CRM, sales & marketing',
    description:
      'As a CRM/sales user, I want dev and prod to hit the same implementation for CRM/sales domains.',
    acceptanceCriteria: [
      'For this cluster (crm, leads, deal-stages, deal-desk-copilot, demos, enrichment, content-gap-analysis, seo, auto-lead-routing): proxy dev→canonical edge fn and retire the Express duplicate, or fix the edge fn first.',
      'Bind to the canonical CRM object model per docs/crm-canonical-model.md (contact=companyContacts, company=business_records, pipeline=deals+pipelineStages) — do not reintroduce deprecated duplicate tables.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-020. Severity: P1.',
  },
  {
    id: 'SUPA-023',
    category: 'route-parity',
    title: 'Converge divergent domains: service, inventory, equipment & field',
    description:
      'As a service/inventory/field user, I want dev and prod to hit the same implementation for these domains.',
    acceptanceCriteria: [
      'For this cluster (service-tickets, service-analysis, service-analytics, maintenance, equipment, devices, fleet, inventory, supplies, auto-supply-replenishment, meter-readings, remote-monitoring, predictive-dispatch, technician-management, manufacturer-integrations, product-accessories, product-models, software-products, catalog, warehouse-operations): proxy dev→canonical edge fn and retire the Express duplicate, or fix the edge fn first.',
      'Note: predictive-dispatch relates to the phantom-table server/routes-predictive-service-dispatch.ts — do not proxy to a 500; fix or defer with a schema note.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-020. Severity: P1.',
  },
  {
    id: 'SUPA-024',
    category: 'route-parity',
    title: 'Converge divergent domains: platform, admin, ops & misc',
    description:
      'As a platform/admin user, I want dev and prod to hit the same implementation for the remaining divergent domains.',
    acceptanceCriteria: [
      'For this cluster (admin, audit-logs, dashboard, dashboards, database-updater, document-management, gdpr, import, integrations, managed-services, mobile, mobile-field, onboarding, performance, professional-services, projects, rbac, root-admin, templates, user): proxy dev→canonical edge fn and retire the Express duplicate, or fix the edge fn first.',
      'rbac/root-admin/user convergence must preserve the platform-admin gating and RBAC permission checks exactly.',
      ROUTES,
      CHECK,
    ],
    notes: 'Depends on SUPA-020. Severity: P1.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EPIC 4 — Data-contract mismatches (200 OK but blank/fake data)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'SUPA-030',
    category: 'data-contract',
    title: 'Audit pages built against mock/placeholder shapes (blank/fake data)',
    description:
      'As a user, I want pages that currently render blank or fake data (because they read a shape the edge fn/table does not return) identified, so they can be fixed. These pass typecheck and return 200 — the route guard cannot catch them.',
    acceptanceCriteria: [
      'Produce a list of data-facing pages whose read keys do not match the edge-fn response / real table columns, using the documented signatures: untyped useQuery({queryKey}) with `|| mockData` fallbacks; queryFn normalizers inventing camelCase keys; CRUD forms binding fields absent from the Drizzle table.',
      'Seed the list with the already-known offenders from CLAUDE.md: PlatformCustomerSuccess.tsx (TenantHealth vs platform_health_scores), ESignatureIntegration.tsx (mock camelCase vs signature_requests), and re-verify the BATCH-fixed pages are actually correct at runtime, not just typecheck-clean.',
      'For each page, record the exact mismatch (page reads X ⇄ fn returns Y ⇄ table column Z) and whether the fix is page-side (rebind) or fn-side (return the right shape).',
      'Output is a prioritized checklist driving SUPA-031.',
    ],
    notes:
      'This class returns 200 so the route-ownership guard misses it entirely. Severity: P2.',
  },
  {
    id: 'SUPA-031',
    category: 'data-contract',
    title: 'Fix the highest-traffic data-contract mismatches',
    description:
      'As a user, I want the top pages from SUPA-030 fixed so they show real data instead of blank/mock.',
    acceptanceCriteria: [
      'For each targeted page: verify the contract end-to-end (page reads ⇄ edge-fn response ⇄ real Drizzle columns from shared/schema.ts + applied migration DDL) and fix the wrong side.',
      'Remove `|| mockData` fallbacks that were masking the mismatch, so a real failure surfaces in loading/error states (TanStack Query) instead of silently showing fake numbers.',
      'Each fixed page verified against LIVE data (not just typecheck) — use the verify/run skill or dev browser.',
      CHECK,
    ],
    notes: 'Depends on SUPA-030. Severity: P2. Iterative — one batch per pass, ratchet the list down.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EPIC 5 — Env / auth / connection integrity  (unblockers)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'SUPA-040',
    category: 'audit-auth',
    title: 'Verify prod frontend auth: baked VITE_ anon key matches live GoTrue',
    description:
      'As a user, I need browser login to work in production, which requires the static bundle to be built with a VITE_SUPABASE_ANON_KEY that the live GoTrue (api.printyx.net) accepts. The server-side .env keys are valid (decoded: iss=supabase, exp 2036) but the prod bundle bakes VITE_ keys at build time (Cloudflare/wrangler), and CLAUDE.md flags the committed anon keys as historically stale.',
    acceptanceCriteria: [
      'Confirm which VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the deployed bundle was built with (wrangler.toml / Cloudflare build env) and that GoTrue /auth/v1/health accepts that anon key (not 401).',
      'If stale, rebuild/redeploy the frontend with the current anon key; update wrangler.toml and .env.example so future builds are correct.',
      'Document the local-dev requirement (export VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY before npm run dev — client crashes at boot without them) and add a boot-time guard/error that names the missing var.',
      'A real browser login against production succeeds end-to-end.',
    ],
    notes:
      'Audit decoded the .env SUPABASE_ANON_KEY/SERVICE_ROLE_KEY as valid (iat 2026-06-10, exp 2036) — so server keys are fine; the open risk is the baked frontend key. Severity: P0 if broad login is failing, else P1.',
  },
  {
    id: 'SUPA-041',
    category: 'config',
    title: 'Document & harden the Supabase Postgres connection (pooler vs direct, SSL)',
    description:
      'As a developer/operator, I need the DB connection story documented and hardened so app runtime, migrations, and local tooling all connect correctly to the self-hosted Supabase Postgres. During the audit the pooler rejected the username ("Tenant or user not found") and port 5433 rejected SSL.',
    acceptanceCriteria: [
      'Document the correct connection matrix: app runtime (pooler 5433, Supavisor username role.tenant, SSL setting), migrations/DDL (DIRECT Postgres via DATABASE_URL_MIGRATE/DIRECT_DATABASE_URL), and local tooling — with the exact DB_SSL / DB_SSL_REJECT_UNAUTHORIZED values per target.',
      'Fix .env.example and CLAUDE.md so DATABASE_URL uses the Supavisor username format and the SSL flags match what the pooler/direct ports actually support.',
      'Verify `npm run db:migrate:status` runs cleanly from a developer machine following the doc (no "Tenant or user not found", no SSL error).',
      'Confirm the app runtime pool (server/db.ts getPgSslConfigFromEnv) uses the right SSL config for the 5433 pooler.',
    ],
    notes:
      'Audit evidence: local probe got Supavisor "Tenant or user not found" (username not role.tenant) on 5433 no-ssl, and "server does not support SSL connections" on 5433 with SSL. This blocks SUPA-001. Severity: P0 for the migration work, P1 otherwise.',
  },
];

// Determine priority base: append after the current max.
const maxPriority = prd.userStories.reduce(
  (m, s) => (typeof s.priority === 'number' && s.priority > m ? s.priority : m),
  0,
);
const PRIORITY_BASE = maxPriority + 1;

// Preserve passes:true across re-runs.
const existingPasses = new Map(
  prd.userStories
    .filter((s) => typeof s.id === 'string' && s.id.startsWith('SUPA-'))
    .map((s) => [s.id, s.passes]),
);

const built = stories.map((s, idx) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  acceptanceCriteria: s.acceptanceCriteria,
  priority: PRIORITY_BASE + idx,
  passes: existingPasses.get(s.id) ?? false,
  notes: s.notes,
  category: s.category,
}));

// Remove any prior SUPA-* stories, then append the fresh set.
const filtered = prd.userStories.filter(
  (s) => !(typeof s.id === 'string' && s.id.startsWith('SUPA-')),
);
prd.userStories = [...filtered, ...built];

writeFileSync(prdPath, JSON.stringify(prd, null, 2) + '\n', 'utf8');

console.log(
  `Merged ${built.length} SUPA-* stories into prd.json (priorities ${PRIORITY_BASE}..${PRIORITY_BASE + built.length - 1}). ` +
    `Preserved passes:true for ${[...existingPasses.values()].filter(Boolean).length} prior SUPA entries.`,
);
console.log(`Total userStories now: ${prd.userStories.length}`);
