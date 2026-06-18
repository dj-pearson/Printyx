# CLAUDE.md

Guidance for Claude Code working in this repository.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Wouter + TanStack Query + Tailwind + shadcn/ui
- **Backend**: Node.js + Express + TypeScript (tsx)
- **Database**: Self-hosted Supabase Postgres (`209.145.59.219:5433`) + Drizzle ORM
- **Auth**: Supabase GoTrue (JWT) with session fallback
- **Edge Functions**: Supabase (`supabase/functions/`)

## Directory Structure

```
client/src/{components,pages,hooks,lib}     # Frontend
server/{routes-*.ts,middleware,services}    # Backend (109 route files)
shared/{schema.ts,*-schema.ts}              # Drizzle schemas (43 files)
supabase/functions/                         # Edge Functions
drizzle/migrations/                         # Versioned SQL migrations
tests/                                      # Playwright E2E
```

**Path aliases**: `@/*` → `client/src/*` · `@shared/*` → `shared/*` · `@assets/*` → `attached_assets/*`

## Commands

```bash
# Dev / Build
npm run dev              # Backend (tsx) + frontend (Vite HMR)
npm run build            # Frontend production build
npm run build:fullstack  # Frontend + esbuild server bundle
npm run check            # tsc --noEmit
npm run lint             # ESLint
npm run format:write     # Apply Prettier

# Test
npm run test             # Vitest unit
npm run test:integration # server/tests/integration/
npm run test:e2e         # Playwright (all browsers)
npm run test:all         # unit + e2e

# Database
npm run db:generate      # Generate migration SQL
npm run db:migrate       # Apply pending migrations (locked)
npm run db:migrate:status
npm run db:push          # Direct push — DEV ONLY, never production
npm run db:backup        # Backup both DBs + retention
npm run db:restore       # Interactive restore

# Seed
npm run seed:rbac | seed:reports | seed:kpis | seed:plans
npm run stripe:setup[:live]
```

## Critical Patterns

### Multi-Tenant Isolation (SECURITY CRITICAL)

- 4-tier hierarchy: Platform → Company → Regional → Location
- 8-level roles: Platform Admin (8) → Guest (1)
- Tenant resolution: `x-tenant-id` header → JWT `app_metadata.tenantId` → Session
- **Every query MUST filter by `tenantId`** — missing filters are security vulnerabilities.

```typescript
// CORRECT
await db.query.customers.findMany({ where: eq(customers.tenantId, tenantId) });

// WRONG — leaks across tenants
await db.query.customers.findMany();
```

### Authentication Middleware

**Never define `requireAuth` locally.** Import from centralized locations.

| Middleware | Import From | Use Case |
|---|---|---|
| `requireAuth` | `./replitAuth` or `./auth-setup` | Standard (JWT + session fallback) |
| `requireSupabaseAuth` | `./middleware/supabase-auth` | Strict JWT only |
| `protectedRoute` | `./middleware/supabase-auth` | JWT + Auth + Tenant context (recommended) |
| `platformAdminRoute` | `./middleware/supabase-auth` | Platform admin only |
| `requirePermission` | `./middleware/enhanced-rbac-middleware` | RBAC checks |

```typescript
import { requireAuth } from '../replitAuth';
import { getUserId, getTenantId } from '../utils/auth-helpers';

app.get('/api/resource', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await db.query.table.findMany({ where: eq(table.tenantId, tenantId) });
});
```

**Auth helpers** (`utils/auth-helpers`): `getUserId`, `getTenantId`, `isAuthenticated`, `isPlatformAdmin`.

### RBAC Permissions

Format: `<module>.<resource>.<action>_<scope>` — e.g. `sales.lead.view_own`, `sales.quote.approve_standard`.

```typescript
app.get('/leads', requirePermission(['sales.lead.view_own', 'sales.lead.view_team']), handler);
```

### Unified Business Records

Leads and customers share `business_records`. Status field determines state. Lead-to-customer conversion = status update (preserves history).

## Database

### Migration Workflow

1. Edit schema in `shared/`
2. `npm run db:generate` → creates SQL in `drizzle/migrations/`
3. Review the SQL
4. `npm run db:migrate` (acquires `__migration_lock`, auto-expires after 5min)
5. Commit schema + migration file together

`db:push` is dev-only. For an existing DB without migrations: generate baseline, then `npm run db:migrate:baseline` (marks applied without executing).

### Backups

`pg_dump` + gzip → GCS. Naming: `printyx-backup-YYYY-MM-DD-HHmmss.sql.gz`. Retention: daily 7d / weekly 4w / monthly 12m. K8s CronJob (`k8s/base/cronjob-backup.yaml`) runs daily 02:00 UTC.

Restore requires interactive confirmation (double for production). Set `RESTORE_TARGET_DB` to redirect target.

Env: `BACKUP_GCS_BUCKET` (default `printyx-backups`), `GOOGLE_APPLICATION_CREDENTIALS`.

## API Conventions

### Versioning

URL prefix: `/api/v1/leads`. Header alternative: `X-API-Version: v1` or `Accept-Version: v1`. Resolution: URL > X-API-Version > Accept-Version > default v1. All responses set `X-API-Version`. Deprecated versions add `Deprecation` and `Sunset` headers. `GET /api/versions` lists supported versions.

### REST

```
GET    /api/[resource]      # List (paginated)
GET    /api/[resource]/:id
POST   /api/[resource]
PUT    /api/[resource]/:id  # Full update
PATCH  /api/[resource]/:id  # Partial
DELETE /api/[resource]/:id
```

### Error Format

```json
{ "message": "...", "code": "ERROR_CODE", "details": {}, "requestId": "uuid" }
```

### New Route File

1. Create `server/routes-[feature].ts`, register in `server/routes.ts`
2. Apply `requireAuth` (or stronger), `requireTenant`, `requirePermission`
3. Validate input with Zod

## Frontend

- shadcn/ui from `client/src/components/ui/`
- Mobile-first: sm(640) md(768) lg(1024) xl(1280); touch targets ≥48px; mobile components in `client/src/components/mobile/`
- Server state: TanStack Query · Forms: React Hook Form + Zod · Local: useState/useReducer · Real-time: `useWebSocket`
- Key hooks: `useAuth`, `usePaginatedQuery`, `useOptimisticMutations`, `useWebSocket`

## Supabase

- API: `https://api.printyx.net` · Edge Functions: `https://functions.printyx.net` · DB pooler: `209.145.59.219:5433`
- Required env: `DATABASE_URL`, `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=false`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Quick Reference

| Task | Where |
|---|---|
| Add API endpoint | `server/routes-*.ts` + register in `server/routes.ts` |
| Add page | `client/src/pages/*.tsx` + route in `client/src/App.tsx` |
| Add schema | `shared/schema.ts` or new `shared/*-schema.ts` |
| User/tenant ID | `getUserId` / `getTenantId` from `../utils/auth-helpers` |
| RBAC | `server/middleware/enhanced-rbac-middleware.ts` |
| Query scoping | `server/middleware/hierarchical-query-builder.ts` |

### Route parity / edge migration (EDGE-0xx)
`npm run audit:routes` (`scripts/audit-route-parity.mjs`) is the re-runnable source of truth for where every `/api/*` route is served. It regex-scans four sources (frontend `/api/*` calls in `client/src`, edge fn dirs in `supabase/functions`, Express `app.METHOD/use('/api/x')` regs in `server/**`, and the `crmProxies` map in `server/middleware/edge-function-proxy.ts`) and writes `docs/route-parity-matrix.md` + `docs/route-divergence.json` (the latter is loaded at startup by the dev-only `route-divergence-detector.ts`). Classes: `missing-edge` = frontend calls it but no edge fn → **PROD BLOCKER** (prod hits `functions.printyx.net` directly via `getApiUrl`; dev silently falls back to Express, masking it); `both-divergent` = Express+edge exist, not proxied → dev≠prod; `proxied`/`edge-only` = aligned. The audit runs as a **non-blocking** (`continue-on-error`) report step in the `quality` CI job. EDGE-013..017 all consume this matrix.

Removing a page (EDGE-005g): a page is wired in THREE places — a `React.lazy()` const + a `<Route>` in `client/src/App.tsx`, and a per-path permission/`minLevel` gate in `client/src/lib/navigation-permissions.ts`. Touch all three (a missing sidebar link means the page was direct-URL-only / orphaned). "Dead code" is asymmetric: a stub can have callers but a dead backend (customer-access), or a (logging-only) backend but zero callers (bug-reports — `error-boundary.tsx`'s `handleReportBug` only logs locally, never POSTed). Inventory BOTH directions before deciding delete-page vs delete-route. `server/routes-misc-stubs.ts` still holds the `service-analytics` placeholder router (live callers: `ServiceHub.tsx`, `role-dashboard-config.ts`); the `customer-access`/`bug-reports` routers were deleted. Stale generated artifacts (`edge-function-audit.json`, `system-check-report.json`, `tools/data-transformation-report.json`, `tests/frontend-schema-fix-report.json`) still name deleted pages — they're reports, not code, and don't affect builds/grep-for-imports checks.

SQL functions & migration application (EDGE-007a): raw PL/pgSQL lives in TWO sibling dirs — `drizzle/functions/` holds the IN-USE `db.rpc()` targets (`dashboard_widget_data`, `lead_assignment_*`, `lead_scoring_*`, `pipeline_*`, `sales_pipeline_*`), and `drizzle/reports/` held only the persona-report functions (deleted as orphans in EDGE-007a; the canonical `reports/handlers/reporting-engine.ts` does inline JS aggregation, not rpc). Migration application is SPLIT: `npm run db:migrate` (`server/lib/migrate.ts`) runs drizzle's journal-based `migrate()` over only the drizzle-kit-generated tags in `drizzle/migrations/meta/_journal.json` (currently 0000..0009). The numbered HAND-AUTHORED files (`0008_client_enrollment_tokens.sql`, `0010_client_commands.sql`, … `0020_drop_orphaned_report_functions.sql`) are NOT in the journal and are applied manually/out-of-band — so DDL on objects that aren't in the Drizzle schema (drop a function, raw index) goes in a hand-written numbered `.sql`, not a generated migration. Keep DROPs idempotent (`IF EXISTS`).

`deals` schema is DRIFTED across three sources — confirm before touching deals/EDGE-005b: the migrated `deals` table + Drizzle schema object + `server/routes-deals.ts` (via `storage`) all use `title`/`amount`/`stage_id`/`owner_id`/`status`. But `server/routes-deals-management.ts` (the handler that currently serves `/api/deals-management/deals` in dev) AND the `deals` EDGE function reference DIFFERENT, partly-phantom vocabularies — routes-deals-management uses `deals.value`/`deals.stage`/`deals.assignedToId` (tsc-baseline errors), and the edge fn inserts/updates `deal_name`/`deal_value`/`stage`/`business_record_id` (NOT real columns; `deal_name`/`deal_value` actually belong to `platform_deals`/`forecast_pipeline_items`). The frontend `crm-object-registry.ts` deals config reads `value`/`stage`/`assignedToName`/`customerName`. So the `deals` edge fn POST/PATCH/search likely write phantom columns and the prod column set can't be confirmed without DB introspection (`\d deals`). EDGE-005b (deals-management → /api/deals) is therefore blocked on resolving this drift, not just a URL-prefix rename.

Accounts payable/receivable (EDGE-005a, DONE): the frontend (`AccountsPayable.tsx`/`AccountsReceivable.tsx`) speaks FLAT CRUD over the real `accounts_payable`/`accounts_receivable` tables (`shared/schema.ts:6356`). The old SINGULAR edge fns `account-{payable,receivable}` were dead drift — they served an orphaned bills/aging/collections sub-ledger over tables (`bills`, `bill_line_items`, `bill_payments`, `ar_reminders`, `ar_write_offs`, `payments`) that exist in NO Drizzle schema, with nested `/bills/:id`+`/summary` URLs and ZERO frontend callers — so they were deleted. The replacements are PLURAL-named dirs `supabase/functions/accounts-{payable,receivable}/` (GET list, GET /:id, POST, PATCH+PUT, DELETE via normalizePath). KEY LESSON: the edge fn DIR NAME must equal the frontend prefix exactly — prod hits `functions.printyx.net/accounts-payable` directly (`getApiUrl` strips `/api/`) and `server.ts` resolves the first path segment to a dir by exact name, so a singular dir 404s in prod no matter what the dev proxy does. SECOND LESSON: these fns return camelCase rows (a `toCamel` helper) because the prior Express path returned Drizzle camelCase objects and the page reads `.totalAmount`/`.balanceAmount.toString()` directly — raw supabase-js snake_case would crash the render (a reusable pattern: when porting a Drizzle/Express route the frontend reads field-by-field, camelize the edge response). AR drift: `invoice_type` is NOT NULL with no DB default and the form never sends it → defaulted to `'invoice'`; the form also sends phantom `referenceNumber`/`priority` (no such columns) → dropped by the column-whitelist `mapBodyToColumns`. Express (`routes-products-crud.ts`) only ever served GET(list)+POST for these prefixes, so the page's edit/delete were broken before this port.

Platform-admin edge fns (EDGE-004, DONE): the four `/api/platform-{crm,activities,analytics,cs}` prefixes are now edge functions in `supabase/functions/` + entries in `crmProxies`; the old `routes-platform-{business-records,activities,customer-success,analytics}.ts` were deleted (`platform-deals` stays Express-served in dev). Their tables live in `shared/platform-crm-schema.ts` (re-exported via `schema.ts`) — USE THAT for snake_case columns, it's the only source of truth. The DELETED `routes-platform-analytics.ts` referenced many NON-EXISTENT columns (`platform_activity_reports` has `user_id`/`total_calls`/`meetings_held`/`total_arr_booked`, NOT `rep_id`/`leads_generated`/`revenue_generated`; `platform_cohort_analysis` uses `cohort_date`/`initial_size`/`initial_mrr`, NOT `cohort_start_date`/`customers_at_start`; `platform_sales_goals` uses `target_value`/`current_value`/`assigned_to_user_id`, NOT `rep_id`/`revenue_target`) — the edge port remaps these (`// Drift:` comments). All four edge fns gate on `roleLevel >= 7 || roles.can_access_all_tenants` and use `createSupabaseServiceClient()` service-role bypass (no per-fn RLS). NOTE: `/api/platform-crm` is an UMBRELLA — only `/business-records/*` was ever served; the frontend's `/platform-crm/{assignment-rules,territories,managers,scoring-models,scoring-rules}` calls (PlatformAssignmentRules/Territories/LeadScoring pages) 404 on BOTH backends (unbuilt features, out of scope). VERIFICATION: Deno IS installed (`deno 2.8.2`, `~/.deno/bin`) — `deno check supabase/functions/<fn>/index.ts` typechecks edge fns (esm.sh + `_shared/*` imports resolve) and is the best in-sandbox gate for Deno (edge fns aren't in `npm run check`/eslint/prettier). The repo does NOT gate on deno check, so fix the `getUser(jwt)` overload with `jwt = ... ? slice(7) : undefined`. GOTCHA: `npm run build:fullstack` is ALREADY broken on the clean tree (`routes-registry.ts:130` imports missing `./domains/reporting`) — canonical pre-flight is `npm run build` (frontend). `routes-registry.ts` (not `routes.ts`) mounts the platform routers.

## Feature Modules

### Address Book Manager (ABK-###)
Multi-vendor MFP address book import/edit/export. Source PRD: `tasks/prd-address-book-manager.md`.
- Schema: `shared/address-book-schema.ts` · Types: `shared/address-book-types.ts`
- Edge function: `supabase/functions/address-books/index.ts`
- Credential vault (AES-256-GCM): `server/services/address-book/credential-vault.ts` (env: `ADDRESS_BOOK_MASTER_KEY`)

### Platform Admin Blog System (US-BLOG-###)
Fully autonomous content marketing platform for Printyx's marketing site. Source PRD: `blog-system-prd.json`. Merge tool: `scripts/merge-blog-prd.mjs`.

**Layout:**
- `shared/blog-schema.ts` — 15 Drizzle tables; re-exported from `shared/schema.ts`
- `supabase/functions/_shared/blog/` — adapters + helpers shared across edge functions
  - `audit-log.ts` — `writeAuditLog(admin, withRequestContext(req, entry))` — every mutating blog endpoint MUST use this
  - `safety/kill-switch.ts` — `assertAgentsActive(admin, tenantId, agentKind)` — every agent entry point MUST call this before any work
  - `cms/` — `CmsAdapter` contract + WordPress + Ghost adapters + registry
  - `keyword/` — `KeywordAdapter` contract + DataForSEO adapter + registry
- `supabase/functions/_shared/credential-vault.ts` — Deno Web Crypto AES-256-GCM. Env: `PRINTYX_CREDENTIAL_VAULT_KEY` (or legacy `ADDRESS_BOOK_MASTER_KEY`). Used by every edge function that persists a third-party credential.
- `supabase/functions/blog-*/` — one directory per edge function: `blog-agents` (kill switch), `blog-brand-voices`, `blog-style-guides`, `blog-cms-targets`, `blog-keyword-targets`, `blog-audit-log`, `blog-onboarding`
- `client/src/pages/platform-admin/blog/` — admin UI pages
- `client/src/components/blog/` — `BlogShell` (sub-nav), `BlogSettingsNav` (settings sub-nav), `BlogOnboardingChecklist`, `BlogSectionPlaceholder`
- `client/src/lib/blog/` — frontend helpers (`brand-voice-prompt.ts`)

**Routes:** `/platform-admin/blog` — gated to platform admin via `ProtectedRoute platformOnly` and sidebar `platformOnly: true`. Sub-routes: `/ideas`, `/briefs`, `/posts`, `/distribution`, `/analytics`, `/refresh`, `/settings/*`. Settings hub has 6 sub-pages: agents, brand-voices, style-guides, cms-targets, keyword-targets, audit-log.

**v1 adapters:** WordPress + Ghost (CMS), DataForSEO (keyword), X/Twitter + LinkedIn (social, not yet wired). Phase 2: Webflow, Ahrefs, SEMrush, Meta, TikTok, Pinterest, Reddit, HN/Medium/Substack.

**Autonomy:** Full closed loop with auto-refresh agent (US-BLOG-066) gated behind kill switch (US-BLOG-086). Per scope decision 5D: auto-refresh defaults to fully autonomous (no human review); the per-tenant `auto_refresh_requires_review` flag flips to require review.

**Permissions:** `blog.post.{view,edit,publish,delete}`, `blog.{brand_voice,style_guide}.edit`, `blog.distribution.publish`, `blog.analytics.view`, `blog.refresh.manage`, `blog.agent.toggle`. Granted by default to PLATFORM_ADMIN (all 10) and COMPANY_ADMIN (editorial subset; no destructive or kill-switch perms).

**Patterns established for new blog edge functions:**
1. Auth: `createSupabaseClient(req)` → `auth.getUser(jwt)`. Permission gate via the role-string + `app_metadata.permissions[]` hybrid (e.g., `'blog.brand_voice.edit'`).
2. Tenant: read from `app_metadata.tenantId` with fallbacks; never trust query params.
3. DB writes: use `createSupabaseServiceClient()` (bypasses RLS). Filter every query by `tenant_id`.
4. Audit: every mutating action calls `writeAuditLog(admin, withRequestContext(req, entry))`. Don't insert directly into `blog_audit_log`.
5. Soft delete: set `deleted_at`; filter reads with `.is('deleted_at', null)`.
6. Default-row uniqueness: atomically clear other defaults in the same edge function call.
7. Encrypted creds: `encryptCredential(plaintext)` → `encrypted_config` jsonb on the row. Never return decrypted creds; return `*_set: boolean` markers instead.
8. Audit log is append-only at the DB layer (`drizzle/rls/blog.sql` drops UPDATE/DELETE policies on `blog_audit_log`).

## Pre-Flight & Pitfalls

Before committing: `npm run check && npm run build && npm run format:write && npm run lint`.

Common mistakes:
1. Missing `tenantId` filter (security)
2. Skipping Zod validation
3. Defining `requireAuth` locally instead of importing
4. Using `db:push` against production
5. Using `any` instead of fixing types
6. Missing TanStack Query loading/error states

Local dev browser login: export `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (from the server-side `.env` values) before `npm run dev` — the client crashes at boot without them. The dev CSP allows api/functions.printyx.net (server/index.ts). The anon keys currently in `.env`/`.env.example`/`wrangler.toml` are rotated/stale (GoTrue `/auth/v1/health` returns 401 with them); browser login needs a current anon key. Demo creds: `DEMO_USER`/`DEMO_PASSWORD` in `.env`.

Frontend endpoints must exist on BOTH backends: Express `server/routes-*.ts` serves dev, but prod hits the edge function directly — a query param (e.g. `?codes=`) supported only by Express silently breaks in production.

Billing edge fn (EDGE-002a): `/api/billing` is in `crmProxies`, so dev forwards the whole prefix to `supabase/functions/billing/` — full frontend parity lives there (`handlers/` per resource). The canonical billing schema audit is the header of `billing/handlers/_context.ts`: `billing_configurations`/`billing_cycles`/`billing_adjustments` are DRIFT tables (in no Drizzle schema/migration — raw-SQL-only legacy); handlers tolerate a missing relation (GET→`[]`, write→503) via `isMissingTableError`. The real `invoices` columns are `total_amount`/`amount_paid`/`balance_due`/`invoice_status`/`paid_date` — the legacy consolidated Express router referenced phantom cols (`balance`/`paid`/`total`/`tax`). `external_customer_id` doubles as the service-ticket id (`?ticketId=` filter). GET `/billing/invoices` returns `{ data, total }` — frontend consumers must use `extractRecords` (AdvancedBillingEngine crashed on `.map` before). Authenticated binary downloads use `client/src/lib/invoice-pdf.ts` (mirrors `quote-pdf.ts`); plain `fetch` has no Bearer header and 401s on edge functions. Cross-fn import `../email-marketing/_sendgrid.ts` is the accepted idiom (proposals fn does it). Stripe's live webhook URL is `/api/webhooks/stripe`, NOT under `/api/billing`.

Quote math (QUOTE-016): `proposal_line_items.discount` is a DOLLAR amount off the whole line; `total_price` is stored NET of it, so the quote subtotal is automatically net and the quote-level discount applies after. Canonical formulas live in `shared/quote-math.ts` (replicated inline in the Deno proposals fn — keep in sync, locked by `server/tests/unit/quote-math.test.ts`). Guardrails evaluate the EFFECTIVE discount (`effectiveDiscountPct`: line + quote discounts over gross). Any discount requires `proposals.discount_reason` (+`_note`, migration 0019); the proposals edge fn POST/PATCH retry without those two columns on PGRST204 until the migration is applied. Server max-discount policy: `company_pricing_settings.max_discount_percentage` (0/absent = not enforced); min-margin policy: `pricing_settings.require_approval_below_margin` (defaults 15).

Recurring lines (QUOTE-017): every money field on a recurring line (`is_recurring=true`) is a PER PERIOD amount; `recurring_frequency` ∈ monthly|quarterly|annually (missing reads as monthly), `recurring_duration` = period count, NULL/0 = ongoing (one-time lines store NULL frequency/duration — the edge fn normalizes this). The quote-level discount applies to the ONE-TIME bucket only (`oneTimeBucketTotals` / `recurringTotalsByFrequency` in `shared/quote-math.ts`); the QUOTE-006 guardrail margin and `proposals.subtotal`/`total_amount`/`total_dealer_cost` stay COMBINED across both buckets (one period of each recurring line) so low margin can't hide in recurring lines. `_pdf.ts` renders a separate "Recurring Charges" section + split totals when any recurring line exists; otherwise the classic single-table layout is unchanged.

Quote wizard (QUOTE-019): `QuoteWizardProgress` step headers are clickable in both directions — ALL prerequisite validation lives in `QuoteBuilder.goToStep` (customer unlocks Products+, ≥1 line unlocks Pricing/Review; invalid jumps toast the missing prerequisite; leaving step 0 fires `ensureDraft`). Guardrail math (overallMargin/effectiveDiscount/belowMinMargin/overMaxDiscount) is computed ONCE in the QuoteBuilder body and shared by the send gate, the sticky summary bar (Products+Pricing steps), the Review banner, and the draft-save warning toast — don't re-derive it inline. Cost-derived numbers in always-visible UI are gated by `pricingVisibility.showMargin` (not `showDealerCost`, which gates the Manager Quote block).

Line item order (QUOTE-020): the `lineItems` ARRAY ORDER is the source of truth — `buildQuoteData` persists it as `line_number` (index+1) and every read path (edge fn GET, both PDFs, share page) orders by `line_number`; PricingCalculator maps the array as-is. Drag-reorder in `LineItemManager` moves whole parent groups (sublines follow), rebuilds the array as [parent, ...sublines] blocks + orphan sublines at the end, renumbers 1..n, and hands it up via `onReorderItems`; autosave picks it up because the QUOTE-018 effect watches `lineItems`. Drag starts only from the GripVertical handle (rows are full of inputs) and is disabled in the group-by-type view (a local, non-persisted Switch that clusters by PARENT productType with per-group subtotals). Gotcha: sublines reference their parent by PRODUCT id (`parentLineId === parent.productId`), not the row id — any parent/subline matching must use productId.

Quote/proposal E2E (PROP-010): the full regression is `tests/proposal-flow.spec.ts` (quote builder legs → templates → branding → generate → share → public/accept), companion to `tests/quote-flow.spec.ts`. Two reusable conventions worth copying for any Playwright spec here: (1) GRACEFUL SKIP — a `test.beforeAll` probes `baseURL` (`request.get`, 5s timeout) and a per-`describe` `test.beforeEach` calls `test.skip(!serverReachable, …)`, so the suite no-ops when no dev server is up instead of failing (this is why `npm run test:e2e` can stay green without a running stack). (2) CUSTOMER-SAFE GUARD — `installCustomerSafeGuard(page)` registers a `page.on('response')` listener that scans `/proposals/public/<token>` JSON + customer `/export/pdf` 200s and pushes a violation if the body contains `"unit_cost"`/`"total_dealer_cost"`/`"margin"`/`"dealer_cost"`; assert `getViolations()` toEqual `[]`. It's a negative assertion — silent with empty seed data, loud on a real leak. KEY GOTCHA: `tests/` is NOT in `tsconfig.json` `include` (only client/src, shared, server) AND is eslint-ignored — so specs never affect `npm run check`/`npm run lint`; validate a spec compiles with `npx playwright test --list <file>` (lists tests without running them). `npm run check` carries a large pre-existing tsc baseline (thousands of errors in server/+shared/), so "check passes" for a tests/docs-only change means "zero NEW errors" — confirm none of the reported errors name your files. Canonical arch doc: `docs/quote-module-architecture.md` (v2 flow diagram at top).

Proposal rich text (PROP-009): `client/src/components/proposal-builder/RichTextEditor.tsx` is TipTap/ProseMirror now (no more `document.execCommand`). The shared extension schema lives in `rich-text-extensions.ts` (a React-free module so the editor and `server/tests/unit/rich-text-roundtrip.test.ts` build the SAME schema). Merge tokens are a custom inline-atom `MergeToken` Node that serializes to `<span data-merge-token="{{token}}">{{token}}</span>` — the inner text is the literal token, so `sanitizeRichHtml` (DOMPurify allows span/class/data-*) keeps it and the merge engine's `/\{\{\s*[\w.]+\s*\}\}/g` regex (`supabase/functions/_shared/proposal-merge.ts`) resolves it with NO engine change. onUpdate emits `sanitizeRichHtml(getHTML())` and normalizes the empty doc to `''`. TipTap gotchas: `@tiptap/*` is declared in package.json but may not be in node_modules (`npm i --legacy-peer-deps @tiptap/extension-{underline,text-style,color,text-align,highlight}@3.22.5`, pin to match `@tiptap/react`); **`@tiptap/extension-text-style@3.22.5` bundles `TextStyle`+`Color`+`BackgroundColor`+`FontSize`** (named exports, no separate color/highlight pkg needed); **StarterKit v3 bundles Link + Underline** (configure via `link`/`underline` options — don't double-register). Round-trip tests need a DOM: add file-level `// @vitest-environment jsdom` (vitest default env is `node`) and assert SEMANTIC preservation + second-pass idempotency, not byte-equality (TipTap re-normalizes HTML). eslint/prettier ignore `client/src/components/**` and `server/tests/**` — rely on `npm run check` + build + vitest, not lint, for those.
