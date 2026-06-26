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

Accounts payable/receivable (EDGE-005a): the canonical tables are `accounts_payable` + `accounts_receivable` (shared/schema.ts, migration 0000) — their columns match the AccountsPayable.tsx / AccountsReceivable.tsx form fields exactly. The `account-payable`/`account-receivable` edge fns serve the FLAT URL shape the frontend calls (GET/POST `/`, GET/PUT/PATCH/DELETE `/:id`, plus `/summary`) and RETURN CAMELCASE rows (the pages read camelCase keys directly off the spread — snake renders blank). Prod resolves the plural `accounts-{payable,receivable}` segment via a `server.ts` route override → singular `account-*` dir; dev mirrors it through `crmProxies`. Earlier versions wrongly queried a phantom `bills` table (AP) and the E-Automate `invoices` table (AR) with nested URLs the frontend never called.

Quote math (QUOTE-016): `proposal_line_items.discount` is a DOLLAR amount off the whole line; `total_price` is stored NET of it, so the quote subtotal is automatically net and the quote-level discount applies after. Canonical formulas live in `shared/quote-math.ts` (replicated inline in the Deno proposals fn — keep in sync, locked by `server/tests/unit/quote-math.test.ts`). Guardrails evaluate the EFFECTIVE discount (`effectiveDiscountPct`: line + quote discounts over gross). Any discount requires `proposals.discount_reason` (+`_note`, migration 0019); the proposals edge fn POST/PATCH retry without those two columns on PGRST204 until the migration is applied. Server max-discount policy: `company_pricing_settings.max_discount_percentage` (0/absent = not enforced); min-margin policy: `pricing_settings.require_approval_below_margin` (defaults 15).

Recurring lines (QUOTE-017): every money field on a recurring line (`is_recurring=true`) is a PER PERIOD amount; `recurring_frequency` ∈ monthly|quarterly|annually (missing reads as monthly), `recurring_duration` = period count, NULL/0 = ongoing (one-time lines store NULL frequency/duration — the edge fn normalizes this). The quote-level discount applies to the ONE-TIME bucket only (`oneTimeBucketTotals` / `recurringTotalsByFrequency` in `shared/quote-math.ts`); the QUOTE-006 guardrail margin and `proposals.subtotal`/`total_amount`/`total_dealer_cost` stay COMBINED across both buckets (one period of each recurring line) so low margin can't hide in recurring lines. `_pdf.ts` renders a separate "Recurring Charges" section + split totals when any recurring line exists; otherwise the classic single-table layout is unchanged.

Quote wizard (QUOTE-019): `QuoteWizardProgress` step headers are clickable in both directions — ALL prerequisite validation lives in `QuoteBuilder.goToStep` (customer unlocks Products+, ≥1 line unlocks Pricing/Review; invalid jumps toast the missing prerequisite; leaving step 0 fires `ensureDraft`). Guardrail math (overallMargin/effectiveDiscount/belowMinMargin/overMaxDiscount) is computed ONCE in the QuoteBuilder body and shared by the send gate, the sticky summary bar (Products+Pricing steps), the Review banner, and the draft-save warning toast — don't re-derive it inline. Cost-derived numbers in always-visible UI are gated by `pricingVisibility.showMargin` (not `showDealerCost`, which gates the Manager Quote block).

QUALITY-002 typecheck ratchet: the canonical error count is whatever `node scripts/check-types.mjs` reports — it counts `: error TS\d+` regex MATCHES, NOT lines, because `--pretty false` suppresses tsc's "Found N errors" summary. `grep -c ": error TS"` undercounts (multi-match lines) and drifts the baseline; always measure batches with the script, not raw grep. Two build caveats: (1) `npm run build` is currently pre-existing-broken in this env — `@sentry/react` is declared in package.json but NOT in node_modules, so Rollup can't resolve its import in `client/src/main.tsx` (the entry) and the vite build dies before bundling anything; type-only changes are verified via tsc/ratchet instead. (2) High-leverage burn-down pattern: when many TS7006 implicit-any callback params cluster in one file, the data source is usually an untyped `apiRequest()` useQuery — type the derived `useMemo`/array with the file's EXISTING domain interface (e.g. `useMemo<EquipmentHealth[]>`) and the type flows through every `.find/.reduce/.filter/.map` callback at once, zero runtime change. NOTE: `server/routes-predictive-service-dispatch.ts` (~69 errors) references PHANTOM tables (`serviceCallsEnhanced`, `equipmentMetrics`, `technicianResourcesEnhanced`) that exist in NO schema/migration — those endpoints already 500 at runtime; a real fix needs new schema tables + migration, not just imports (deferred).

Signatures consolidation (EDGE-005e): the frontend now calls the consolidated `/api/signatures/{requests,templates,analytics}` shape (was three flat `/api/signature-*` prefixes that 404'd in prod — no such function dirs). The `signatures/` dispatcher strips an OPTIONAL leading `signature-` from the first path segment, so BOTH `requests` and legacy `signature-requests` resolve (mobile/older callers keep working). Why a refactor and NOT the EDGE-005a server.ts plural→singular alias: server.ts STRIPS the matched fn-name segment before calling the handler, but the signatures dispatcher keys off that segment (the sub-resource) — a plain alias would erase the discriminator. `handlers/analytics.ts` derives REAL aggregates from `signature_requests` (totalContractValue=0 — no contract-value column; byDocumentType groups by `provider` — no document_type column). `handlers/templates.ts` returns `[]` — there is NO `signature_templates` table in any schema/migration (only requests/signers/documents exist). `/send` + `/:id/remind` are STUBS (audit log + status/timestamp bump; no provider envelope/email — DocuSign/Adobe/HelloSign wiring is a deferred PRD). GOTCHA: `ESignatureIntegration.tsx` was built against a MOCK camelCase shape (`requestedDate`/`documentName`/`customerName`/`remindersSent`) that does NOT match the real snake_case `signature_requests` columns — its request list/detail won't render correctly against live data; that data-contract rewrite is a separate story.

Line item order (QUOTE-020): the `lineItems` ARRAY ORDER is the source of truth — `buildQuoteData` persists it as `line_number` (index+1) and every read path (edge fn GET, both PDFs, share page) orders by `line_number`; PricingCalculator maps the array as-is. Drag-reorder in `LineItemManager` moves whole parent groups (sublines follow), rebuilds the array as [parent, ...sublines] blocks + orphan sublines at the end, renumbers 1..n, and hands it up via `onReorderItems`; autosave picks it up because the QUOTE-018 effect watches `lineItems`. Drag starts only from the GripVertical handle (rows are full of inputs) and is disabled in the group-by-type view (a local, non-persisted Switch that clusters by PARENT productType with per-group subtotals). Gotcha: sublines reference their parent by PRODUCT id (`parentLineId === parent.productId`), not the row id — any parent/subline matching must use productId.

Alias-target edge fns (EDGE-005f): three frontend prefixes whose URL segment differs from the edge-function DIR name are resolved the EDGE-005a way — a `server.ts` route override (prod) PLUS a `crmProxies` entry (dev), so both land the same handler path. (1) `/api/deployment/{readiness,metrics}` → `deployment-readiness/` fn (override `deployment`→`deployment-readiness`); the fn now returns the exact `ReadinessCheck[]` / `DeploymentMetrics` shapes `DeploymentReadiness.tsx` types (derived from live tenant signals), not the legacy `{ready,checks}` object — returning the WRONG shape is worse than a 404 because the page does `readinessChecks || mockChecks` and would `.filter` a truthy object. (2) `/api/integration-hub/dashboard` → `integrations/` fn `/dashboard` branch (override `integration-hub`→`integrations`); detect it via `normalizePath` BEFORE the `!segment1` GET-list branch or that branch swallows it. The integrations fn still indexes `pathParts[1]` (NOT migrated to normalizePath in EDGE-002m) so its OTHER routes are off-by-one under server.ts strip — out of scope, but don't copy that pattern. (3) `/api/public/calculator/*` is the UNAUTHENTICATED marketing calculator → new `public-calculator/` fn (override fires only when `functionName==='public' && subPath[0]==='calculator'`, proxy uses `{fn:'public-calculator',pathPrefix:'/calculator'}` to re-add the segment the mount strips). Auth-bypass reality: `config.toml verify_jwt=false` is for the NATIVE Supabase runtime only — the Coolify `server.ts` dispatcher ignores config.toml and enforces auth PER-HANDLER, so "public" just means the handler never calls `auth.getUser` (same as the `signup` fn). Its pure calc engine is duplicated at `supabase/functions/_shared/print-cost-calculator.ts` (near-verbatim copy of `server/services/print-cost-calculator-service.ts` — keep in sync). Email nurture rows are recorded (`email_sequence_tracking` status='pending') but the provider SEND is stubbed (no email infra in the edge fn). GOTCHA: the `deno check` getUser(jwt) `string|null` vs `string|undefined` TS2345 is a pre-existing pattern across ~40 edge fns (`createSupabaseClient` uses `req.headers.get('Authorization')!`); fix the files you touch by extracting jwt as `... : undefined` not `: null`. `deno lint`'s `no-explicit-any` is unenforced here (no `deno.json` anywhere, not in CI) and the whole edge codebase uses `any` on untyped supabase rows — match that style. The QUALITY-002 typecheck baseline drifts UP from main merges (PR #184 pushed clean main to 3910 vs a 3840 baseline); reconcile it when a story's own tree adds 0 tsc errors, documenting the upstream cause — don't try to "fix" 70 unrelated pre-existing errors.
