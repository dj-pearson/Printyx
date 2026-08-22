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

| Middleware            | Import From                             | Use Case                                  |
| --------------------- | --------------------------------------- | ----------------------------------------- |
| `requireAuth`         | `./replitAuth` or `./auth-setup`        | Standard (JWT + session fallback)         |
| `requireSupabaseAuth` | `./middleware/supabase-auth`            | Strict JWT only                           |
| `protectedRoute`      | `./middleware/supabase-auth`            | JWT + Auth + Tenant context (recommended) |
| `platformAdminRoute`  | `./middleware/supabase-auth`            | Platform admin only                       |
| `requirePermission`   | `./middleware/enhanced-rbac-middleware` | RBAC checks                               |

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

**Canonical CRM object model:** the CRM is mid-migration with duplicate models per entity. The canonical table for each entity (contact = `companyContacts`, company/account = `business_records`, pipeline = `deals` + `pipelineStages`/`pipelineTemplates`) and the deprecated duplicates + migration path are recorded in `docs/crm-canonical-model.md` (CRMX-002). Deprecated tables carry `@deprecated` banners. Bind new CRM work to the canonical tables only.

**Workflow automation runtime (CRMX-008):** the real execution engine lives in `server/services/workflow-execution-service.ts` (durable step executor) + `server/services/workflow-runtime.ts` (dispatch/enroll/sweeper), over the 15-table `shared/workflow-automation-schema.ts`. The registered router is `server/routes/workflow-automation-routes.ts` (mounted at `/api` by `routes-registry.ts`); the top-level `server/routes-workflow-automation.ts` was **unregistered dead mock** and PROD-008b deleted it, so `routes/workflow-automation-routes.ts` is now the only workflow router in the tree. To fire automation from any code path, call `dispatchWorkflowEvent(tenantId, eventName, payload, { dedupeKey })` — the single trigger seam — wrapped in try/catch so it never breaks the primary op. Event names wired: `record.created`/`record.updated` (routes-business-records), `deal.stage_changed` (routes-deals PUT); `form.submitted` plugs in at CRMX-011. Executions are durable (DB-persisted, `wait_delay`/approval PAUSE with `resume_at`/`context._runtime` cursor, resumed by the boot-started sweeper — no in-process `setTimeout`) and idempotent (atomic `queued|paused→running` claim + `workflow_executions.dedupe_key` unique index, migration 0025). Kill switch = `workflows.status !== 'active'` (enrollment skips) + per-execution `POST /api/executions/:id/cancel`.

## Database

### Migration Workflow

1. Edit schema in `shared/`
2. `npm run db:generate` → creates SQL in `drizzle/migrations/`
3. Review the SQL
4. `npm run db:migrate` (acquires `__migration_lock`, auto-expires after 5min)
5. Commit schema + migration file together

**Journal integrity (SUPA-005):** drizzle's migrator only applies migrations listed in `drizzle/migrations/meta/_journal.json`. A `*.sql` file with no journal entry is silently NEVER applied → schema drift. `npm run check:migrations` (CI guard) fails when any migration file is unjournaled, two files share a 4-digit prefix, or journal `idx` is non-contiguous. Always add migrations via `db:generate` (which updates the journal) — never hand-drop a `.sql` into `drizzle/migrations/`.

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

| Task             | Where                                                    |
| ---------------- | -------------------------------------------------------- |
| Add API endpoint | `server/routes-*.ts` + register in `server/routes.ts`    |
| Add page         | `client/src/pages/*.tsx` + route in `client/src/App.tsx` |
| Add schema       | `shared/schema.ts` or new `shared/*-schema.ts`           |
| User/tenant ID   | `getUserId` / `getTenantId` from `../utils/auth-helpers` |
| RBAC             | `server/middleware/enhanced-rbac-middleware.ts`          |
| Query scoping    | `server/middleware/hierarchical-query-builder.ts`        |

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

### Edge path normalization (prod-only 404s) — READ BEFORE TOUCHING ANY EDGE FN

An edge handler NEVER sees its own name in the path. The Coolify dispatcher
(`supabase/functions/server.ts`) resolves the function from URL segment 0 and then
**strips it** (`stripSegments = 1`; it rewrites to `'/' + pathParts.slice(1).join('/')`)
before invoking the handler. So `functions.printyx.net/seo/settings` arrives as
`/settings`.

Therefore **`const resource = url.pathname.split('/').filter(Boolean)[1]` is a bug.**
It reads `undefined`, every `resource === '...'` guard is false, and the function 404s
on EVERY route. Always use the idempotent helper instead — it strips an OPTIONAL
leading prefix, so routing is identical whether the segment is present or already gone:

```typescript
import { normalizePath } from '../_shared/path.ts';
const { parts } = normalizePath(url.pathname, 'seo'); // parts[0] = resource
```

**This is invisible in dev.** If the prefix is not in `crmProxies`, Express serves it
locally and the edge function is never exercised — the outage is prod-only. ALL 169 edge functions are now migrated (2026-07-17); `npm run check:edge-paths` enforces it at 0. seo and deal-desk were each 404ing on EVERY endpoint before that sweep. The impact claim is statically derived — the mechanism is proven but nothing was executed against a deploy, so confirm with one curl per prefix before treating it as an incident writeup.

GPT-5 endpoints (AI-001): `/api/ai/gpt5/*` is served by `supabase/functions/ai-gpt5/` — a `server.ts` alias (`functionName === 'ai' && subPath[0] === 'gpt5'`) plus a `crmProxies` entry `'/api/ai/gpt5': { fn: 'ai-gpt5', pathPrefix: '/gpt5' }`. Only that sub-path is proxied; the rest of `/api/ai` stays on Express and has no frontend caller. Prompt text, model configs and the response parser are duplicated in `_shared/gpt5-prompts.ts` (+ `_shared/crisis-response.ts`) and locked to `server/services/gpt5-service.ts` by `server/tests/unit/gpt5-prompts-parity.test.ts`. The edge fn needs `OPENAI_API_KEY` in the edge environment or every endpoint 500s. Two traps this closed: the Responses API `output` is an ARRAY (`response.output?.content` is always undefined — use `extractResponseText`, since the raw REST payload carries no `output_text`), and `check:routes` classifies per DOMAIN, so a multi-segment proxy prefix only counts when EVERY live frontend path under that domain sits inside it — `route-parity.mjs` now enforces that rather than whitelisting.

Phantom PostgREST columns (COP-M01): edge functions name columns in STRINGS, so a column that does not exist is a runtime 42703 — a 500 the moment the code path runs — invisible to tsc, lint and any test that does not hit a database. `npm run check:phantom-cols` (`scripts/check-phantom-columns.ts`) reads all 671 Drizzle tables and checks every column literal an edge fn hands to PostgREST (`.eq/.order/.or/.select` and INLINE `.insert/.update` object literals) against the table its call chain is on; baseline `docs/phantom-columns-baseline.json` at **384**, do not grow it. Known blind spots, stated so a pass is never read as proof of correctness: payloads built as a named variable (the deals insert was one), runtime-assembled names, camel→snake field maps, the 107 tables in no Drizzle schema, and 15 tables declared twice with different shapes (skipped as ambiguous rather than reported — that is `check:dup-tables`' story). Confirmed true positives worth knowing: `users` has `first_name`/`last_name` and `is_active`, NOT `name`/`full_name`/`status`/`phone`/`job_title`; `roles` has NO `tenant_id`; `audit_logs` has `timestamp`, not `created_at`; `deals` is queried as `deal_value`/`stage`/`value`/`name`/`closed_at` by eight more edge fns (commission, crm-goals, dashboards, pipeline, sales-reports, today-dashboard, user-assignments, pipeline-config). Failure mode to recognise: PostgREST leaves `.data` null on error and this code says `|| 0`, so the symptom is a dashboard of zeroes, not an error.

Do NOT add a `crmProxies` entry for an un-migrated prefix: the proxy forwards the whole
prefix and falls through only on a NETWORK error, never a 404 — so proxying a broken fn
takes it from working-in-dev to 404-in-dev too.

Counting caveat: grepping for `pathParts[1]` alone over-reports ~48x — it is CORRECT in
functions that read `pathParts[0]` as the resource (post-strip) and `[1]` as an id, e.g.
`deals` (`dealId = pathParts[0]`) and `contacts`. The real signature is a function that
reads `[1]` but NEVER `[0]`.

## Pre-Flight & Pitfalls

**Node 20 is mandatory — check this before believing any failure.** `engines.node` is `20.x` and
`.npmrc` sets `engine-strict=true`, so on any other major `npm install` aborts and leaves
`node_modules` **empty**. Everything downstream then fails for reasons that have nothing to do with
the cause: `tsc` bails before typechecking, `vitest` is absent, the app looks broken. `preinstall`
now blocks this (`npm run check:node`), but if you inherit a half-installed tree, `node -v` is the
first thing to check. Use `nvm use 20 && npm install`.

In a sandbox with no `nvm`, look for Node 20 on disk before concluding the suite
is unrunnable: this container ships it at `/opt/node20/bin` with a
`use-node-20` helper on PATH, while the default `node` is 22. Prefixing the PATH
(`export PATH="/opt/node20/bin:$PATH" && npm install`) installs cleanly and makes
`npm run check`, `npm run test`, `check:phantom-cols` and every other
tsx-dependent script work. Several rounds of this repo's history were written
under the belief that they could not be run at all, and a deleted handler's test
stayed red for a whole session because of it.

Before committing: `npm run check && npm run build && npm run format:write && npm run lint`.

Common mistakes:

0. Debugging a phantom broken repo on the wrong Node version (see above)
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

QUALITY-002 typecheck ratchet: the canonical error count is whatever `node scripts/check-types.mjs` reports — it counts `: error TS\d+` regex MATCHES, NOT lines, because `--pretty false` suppresses tsc's "Found N errors" summary. `grep -c ": error TS"` undercounts (multi-match lines) and drifts the baseline; always measure batches with the script, not raw grep. Two build caveats: (1) CORRECTED 2026-07-30 (PROD-001): `npm run build` is **NOT** broken — it passes in 1m with the full bundle emitted, and type-only changes CAN be build-verified. The earlier "`@sentry/react` missing from node_modules" note was a **failed install**, not a repo defect: `engines.node` is `20.x` with `engine-strict=true` in `.npmrc`, so on any other Node major `npm install` aborts and leaves node_modules EMPTY. Under Node 20 the dependency is present and the build succeeds. The baseline quoted below also drifted — the real count is now **1067**, not 3577. If a command fails inexplicably, run `npm run check:node` FIRST; `preinstall` now enforces this and `scripts/check-types.mjs` refuses to compare a count when tsc never actually typechecked (it used to report "errors DECREASED" and exit 0 on an empty tree, which would have silently retired the ratchet). (2) High-leverage burn-down pattern: when many TS7006 implicit-any callback params cluster in one file, the data source is usually an untyped `apiRequest()` useQuery — type the derived `useMemo`/array with the file's EXISTING domain interface (e.g. `useMemo<EquipmentHealth[]>`) and the type flows through every `.find/.reduce/.filter/.map` callback at once, zero runtime change. NOTE: `server/routes-predictive-service-dispatch.ts` (~69 errors) references PHANTOM tables (`serviceCallsEnhanced`, `equipmentMetrics`, `technicianResourcesEnhanced`) that exist in NO schema/migration — those endpoints already 500 at runtime; a real fix needs new schema tables + migration, not just imports (deferred). (3) PHANTOM-SHAPE PAGES (BATCH 7, VendorManagement.tsx, 54 errs->0): a dense TS2339+TS2322 cluster on a CRUD page is often the page reading/writing field names that DON'T EXIST on the real Drizzle table — built against an old/mock shape. The tell: errors say "Property X does not exist on type {id; ...realcols}". These are LATENT RUNTIME BUGS (blank list cells, create POSTs the DB silently drops), so the fix is to re-bind every field to the REAL columns (confirm via shared/schema.ts + migration 0000 DDL + the storage method the /api route actually calls) and DELETE features with no backing column (VendorManagement's "preferred" had no column — removed it, not faked it). Two recurring sub-fixes: derive the form type from `insertXSchema.omit({tenantId:true})` (not bare `z.infer` that keeps server-injected cols / re-omits already-omitted createdAt/updatedAt -> TS2322 "never"), and add `value={field.value ?? ''}` to every Input/Textarea bound to a NULLABLE varchar (string|null is not a valid HTML value — this clears most of the TS2322s). (4) PHANTOM-SHAPE PAGES (BATCH 8, MeterReadings.tsx, 41 errs->0): same pattern, plus a normalization-layer tell. The page's useQuery `queryFn` already had a `.map((row:any)=>({...row, blackMeter: row.black_meter ...}))` normalizer inventing camelCase keys (blackMeter/colorMeter) that DON'T exist on the real Drizzle type — but the Express GET returns raw `SELECT *` snake_case rows, so against live data the page renders BLANK. Fix = make the normalizer emit the REAL camelCase column names (`bw_meter_reading`->`bwMeterReading`, `color_meter_reading`->`colorMeterReading`) and re-point every read/form field to them. Two extras beyond BATCH 7: (a) when the form omits BOTH `tenantId` AND `createdBy` (both server-injected, both NOT NULL), `insertXSchema.omit({tenantId:true,createdBy:true})` — a bare `.extend()` keeps them required and every defaultValues/field errors; (b) a phantom FK with no backing column (equipment has `locationDescription` free-text, NO `locationId`/locations FK) — don't fake a join; derive the filter options from the distinct free-text values present on the list (`Array.from(new Set(equipment.map(e=>e.locationDescription)))`), keeping the feature against real data. Server debt found but deferred: the POST route's `insertMeterReadingSchema.parse` requires `createdBy` it never injects (500s) — frontend posting correct column names is still a strict improvement. (5) UNTYPED-useQuery DATA-CONTRACT PAGE (BATCH 9, PlatformAnalytics.tsx, 32 errs->0): a TS2339-on-`{}` cluster (+ TS7006 on chart `.map` params) where `useQuery({queryKey})` passes NO generic, so `data` is `{}` and every `data?.foo` read errors. Distinct from BATCH 7/8 phantom-CRUD: this page reads FLAT keys (`revenueMetrics?.mrr`, `growthTrends?.revenueData`) with `|| mock` fallbacks on every field, but the `platform-analytics` edge fn returns a NESTED `{metrics,counts}` shape — so the reads resolve to undefined and the page silently shows MOCK data. Fix = type-only: add flat OPTIONAL interfaces matching the keys the page reads + chart-row types, apply `useQuery<T>(...)`; the fallback arrays and `.map` params then infer. Do NOT rewrite the flat<-nested contract here — that's a separate story (same gap EDGE-004 flagged for PlatformCustomerSuccess.tsx). General rule for these: when a page reads off an untyped useQuery, type the QUERY (one generic) rather than casting each read; the mock-fallback pattern means a flat-optional interface is both faithful to current runtime and zero-change. (6) PHANTOM-SHAPE PAGES (BATCH 10, Vendors.tsx, 30 errs->0): IDENTICAL to BATCH 7 — there are TWO vendor CRUD pages (VendorManagement.tsx fixed in B7, Vendors.tsx here) both built against the same phantom shape (vendorNumber/companyName/displayName/contactPerson/address/country/currency/vendorType/category/status/preferred + a banking section bankName/accountHolder/routingNumber/bankAccountNumber) absent from the real `vendors` table (real cols vendorName/primaryContactName/addressLine1/2/city/state/zipCode/phone/fax/email/website/paymentTerms/taxId/accountNumber/creditLimit/isActive/vendorNotes). Same fix recipe verbatim: form schema = `insertVendorSchema.omit({tenantId:true})`; `useQuery<Vendor[]>` (clears the TS18046 `vendors` is unknown that also blocks `.filter`); re-bind every field + card to real columns; `value={field.value ?? ''}` on nullable inputs; DELETE no-column features (here: vendorNumber/displayName/vendorType/currency/category, the Preferred Star toggle + its Star/StarOff lucide imports, the whole banking section), status-string select -> isActive boolean Switch, add a vendorNotes Textarea. LESSON: when you fix a phantom-shape page, grep for SIBLING pages on the same table (`grep -rl vendorNumber client/src`) — duplicate CRUD pages built off the same mock shape travel in pairs. (7) PHANTOM-SHAPE PAGES (BATCH 11, EnhancedProductAccessories.tsx, 35 errs->0): SAME pattern on the product_accessories CRUD page. The add/edit form bound 4 phantom fields (partNumber/weight/dimensions/warrantyPeriod) absent from the real `product_accessories` table (shared/schema.ts:2932; real cols accessoryCode/accessoryName/accessoryType/category/manufacturer/description + 3 pricing tiers + isActive/availableForAll/salesRepCredit/funding/lease), and the model-compatibility dialog read model.modelName/model.productType off `product_models` (real cols productName/category — NO modelName/productType). /api/product-accessories reads/writes the real Drizzle tables, so create POSTed dropped columns + compat dialog rendered blank model names (latent runtime bugs). Recipe verbatim: form schema = `insertProductAccessorySchema.omit({tenantId:true})` -> `AccessoryFormData` (the bare `InsertProductAccessory` kept server-injected tenantId, so defaultValues TS2353'd AND the zodResolver `Control<...>` generic mismatched at EVERY FormField — ~13 cascading TS2322 that all cleared from the ONE omit, not per-field fixes); `CompatibilityPayload = Omit<InsertAccessoryModelCompatibility,'tenantId'>` for the link-model mutation (cleared TS2345); useForm<AccessoryFormData>+zodResolver(accessoryFormSchema); mutation/onSubmit param types -> AccessoryFormData; REMOVED the 4 phantom FormFields; model.modelName->productName, dropped phantom productType (already fell back to model.category); `value={field.value ?? ''}` on every nullable Input/Textarea/Select; narrowed the manufacturer/accessoryType filter arrays with `.filter((m): m is string => Boolean(m))` (`filter(Boolean)` does NOT narrow string|null -> SelectItem value TS2322). Baseline 3638->3603 (-35). NEW TAKEAWAY beyond B7/10: a big chunk of the error count on these form pages is the resolver `Control<...>` cascade — one wrong useForm<T> generic detonates a TS2322 at every FormField, so the `.omit({tenantId:true})` form-schema fix is worth far more than its line count suggests. Product CRUD pages (vendors x2, meter readings, accessories) were ALL built against stale mock shapes — grep the real table columns FIRST. (8) UNTYPED-useQuery (BATCH 12, RemoteMonitoring.tsx, 26 errs->0): same as BATCH 9 — two `useQuery({queryKey})` calls (fleet-overview, sensor-data) with no generic typed `data` as `{}`, so every nested read (`.summary.*`, `.statusDistribution`, `.performanceTrends.weekly*`, `.topPerformers`, `.attentionRequired`, `.historicalData.*`, `.predictions.*`) was TS2339, plus 2 TS7006 on the `weeklyUptime.map((uptime,index))` chart-data params. Fix = add `FleetOverview`/`SensorData` interfaces matching the keys read and apply `useQuery<T>`; the chart `.map` params infer from `number[]`. Type-only, the `fleetOverview && /sensorData &&` guards already null-tolerate. Baseline 3603->3577.

Signatures consolidation (EDGE-005e): the frontend now calls the consolidated `/api/signatures/{requests,templates,analytics}` shape (was three flat `/api/signature-*` prefixes that 404'd in prod — no such function dirs). The `signatures/` dispatcher strips an OPTIONAL leading `signature-` from the first path segment, so BOTH `requests` and legacy `signature-requests` resolve (mobile/older callers keep working). Why a refactor and NOT the EDGE-005a server.ts plural→singular alias: server.ts STRIPS the matched fn-name segment before calling the handler, but the signatures dispatcher keys off that segment (the sub-resource) — a plain alias would erase the discriminator. `handlers/analytics.ts` derives REAL aggregates from `signature_requests` (totalContractValue=0 — no contract-value column; byDocumentType groups by `provider` — no document_type column). `handlers/templates.ts` returns `[]` — there is NO `signature_templates` table in any schema/migration (only requests/signers/documents exist). `/send` + `/:id/remind` are STUBS (audit log + status/timestamp bump; no provider envelope/email — DocuSign/Adobe/HelloSign wiring is a deferred PRD). GOTCHA: `ESignatureIntegration.tsx` was built against a MOCK camelCase shape (`requestedDate`/`documentName`/`customerName`/`remindersSent`) that does NOT match the real snake_case `signature_requests` columns — its request list/detail won't render correctly against live data; that data-contract rewrite is a separate story.

Line item order (QUOTE-020): the `lineItems` ARRAY ORDER is the source of truth — `buildQuoteData` persists it as `line_number` (index+1) and every read path (edge fn GET, both PDFs, share page) orders by `line_number`; PricingCalculator maps the array as-is. Drag-reorder in `LineItemManager` moves whole parent groups (sublines follow), rebuilds the array as [parent, ...sublines] blocks + orphan sublines at the end, renumbers 1..n, and hands it up via `onReorderItems`; autosave picks it up because the QUOTE-018 effect watches `lineItems`. Drag starts only from the GripVertical handle (rows are full of inputs) and is disabled in the group-by-type view (a local, non-persisted Switch that clusters by PARENT productType with per-group subtotals). Gotcha: sublines reference their parent by PRODUCT id (`parentLineId === parent.productId`), not the row id — any parent/subline matching must use productId.

Alias-target edge fns (EDGE-005f): three frontend prefixes whose URL segment differs from the edge-function DIR name are resolved the EDGE-005a way — a `server.ts` route override (prod) PLUS a `crmProxies` entry (dev), so both land the same handler path. (1) `/api/deployment/{readiness,metrics}` → `deployment-readiness/` fn (override `deployment`→`deployment-readiness`); the fn now returns the exact `ReadinessCheck[]` / `DeploymentMetrics` shapes `DeploymentReadiness.tsx` types (derived from live tenant signals), not the legacy `{ready,checks}` object — returning the WRONG shape is worse than a 404 because the page does `readinessChecks || mockChecks` and would `.filter` a truthy object. (2) `/api/integration-hub/dashboard` → `integrations/` fn `/dashboard` branch (override `integration-hub`→`integrations`); detect it via `normalizePath` BEFORE the `!segment1` GET-list branch or that branch swallows it. (CORRECTED 2026-07-17: the integrations fn HAS since been migrated to normalizePath under PA-024 — it no longer indexes `pathParts[1]` off the raw split. But the pattern it was fixed for is WIDESPREAD and is the single biggest known prod-only defect class in the edge tree — see "Edge path normalization" below.) (3) `/api/public/calculator/*` is the UNAUTHENTICATED marketing calculator → new `public-calculator/` fn (override fires only when `functionName==='public' && subPath[0]==='calculator'`, proxy uses `{fn:'public-calculator',pathPrefix:'/calculator'}` to re-add the segment the mount strips). Auth-bypass reality: `config.toml verify_jwt=false` is for the NATIVE Supabase runtime only — the Coolify `server.ts` dispatcher ignores config.toml and enforces auth PER-HANDLER, so "public" just means the handler never calls `auth.getUser` (same as the `signup` fn). Its pure calc engine is duplicated at `supabase/functions/_shared/print-cost-calculator.ts` (near-verbatim copy of `server/services/print-cost-calculator-service.ts` — keep in sync). Email nurture rows are recorded (`email_sequence_tracking` status='pending') but the provider SEND is stubbed (no email infra in the edge fn). GOTCHA: the `deno check` getUser(jwt) `string|null` vs `string|undefined` TS2345 is a pre-existing pattern across ~40 edge fns (`createSupabaseClient` uses `req.headers.get('Authorization')!`); fix the files you touch by extracting jwt as `... : undefined` not `: null`. `deno lint`'s `no-explicit-any` is unenforced here (no `deno.json` anywhere, not in CI) and the whole edge codebase uses `any` on untyped supabase rows — match that style. The QUALITY-002 typecheck baseline drifts UP from main merges (PR #184 pushed clean main to 3910 vs a 3840 baseline); reconcile it when a story's own tree adds 0 tsc errors, documenting the upstream cause — don't try to "fix" 70 unrelated pre-existing errors.

Platform-admin CRM edge fns (EDGE-004): `/api/platform-{crm,deals,activities,analytics,cs}` are the root-admin platform CRM pages. Only `platform-deals` + `platform-crm` had edge fns before; `platform-activities`/`platform-analytics`/`platform-cs` were Express-only and 404'd in prod. NEW fns mirror the siblings: gate on root admin (`role level >= 7 OR roles.can_access_all_tenants`) via the service-role client, `normalizePath(pathname, '<fn>')`, query the canonical `platform_*` tables in `shared/platform-crm-schema.ts` (NOT `shared/schema.ts`). DECISION RULE for these: dir name == URL prefix segment, so a PLAIN `crmProxies` entry is enough — NO `server.ts` override needed (unlike EDGE-005a/005f where the dir name differed). Two shape rules: (1) COMPUTED analytics endpoints (revenue-metrics/conversion-metrics/pipeline-metrics/performance-metrics/growth-trends/health-trends) must return the EXACT camelCase keys the page reads (`revenueData`,`funnelData`,`distributionData`,`sourceData`,`metrics.{mrr,arr,...}`) — the pages fall back to MOCK data with `|| [...]` so a wrong shape silently shows fake numbers; (2) list endpoints return raw snake_case rows like the `platform-crm` sibling. GOTCHA — the legacy Express handlers referenced PHANTOM columns that don't exist in the schema and would 500 at runtime: `platform_activity_reports.report_date`/`rep_id`/`rep_name`/`calls_logged`/`emails_sent`/`leads_generated` (real cols are `period_start`/`user_id`/`total_calls`/`total_emails`/`meetings_held`/`demos_completed`/`new_deals`/`deals_won`/`total_arr_booked`); `platform_business_records.last_mrr_change` (absent → expansion MRR is always 0); `platform_cohort_analysis.period_type`/`customers_at_start`/`revenue_at_start` (real cols are `cohort_period`/`initial_size`/`initial_mrr`/`current_size`/`retention_rate`); `platform_churn_predictions.churn_risk_level`/`estimated_revenue_impact` (real: `churn_risk`/`estimated_arr`). The edge fns adapt to the REAL columns (an improvement, per the schema-audit AC). SEPARATE-STORY DEBT: `PlatformCustomerSuccess.tsx` types `TenantHealth` (healthGrade/companyName/mrr/daysUntilRenewal/csmId) against a MOCK shape that does NOT match the real `platform_health_scores` columns (overall_score/health_status/...) — the endpoints now RESOLVE (200 instead of prod 404) but the page's field-by-field render is a data-contract rewrite out of scope. Deleted the four `routes-platform-{business-records,activities,analytics,customer-success}.ts` (kept `routes-platform-deals.ts`); deleting the phantom-col files DROPPED the tsc ratchet 3910→3795 (−115) — tighten the baseline. `requireRootAdmin` is exported from `routes-root-admin.ts` (kept) and was the only cross-import.

Plural-prefix→singular-fn alias (EDGE-005a): `/api/accounts-{payable,receivable}` (plural, flat) → `account-{payable,receivable}/` fn dirs (singular). DECISION RULE — when the frontend uses a FLAT prefix (list at `/`, item at `/:id`) and the edge fn dir name only differs by spelling, use a PLAIN proxy entry + server.ts override and make the HANDLER flat (normalizePath, id at `parts[0]`). Do NOT use a `pathPrefix` alias to re-add a nested segment like `/bills`: pathPrefix is dev-only, but prod hits `functions.printyx.net/<prefix>` directly and server.ts strips the function-name segment, so the handler sees a flat path with nothing to inject — pathPrefix would 404 in prod. BIGGER LESSON FROM THIS STORY: these two edge fns were querying ENTIRELY WRONG TABLES (account-payable→`bills`, account-receivable→`invoices`/`payments`) — the canonical tables are `accounts_payable`/`accounts_receivable` (shared/schema.ts), which the legacy Express handler in `server/routes-products-crud.ts` (via `storage.getAccountsPayable/Receivable`) already used. ALWAYS confirm which table the canonical Drizzle schema + legacy Express storage method use before trusting an existing edge fn's `.from('...')`. Edge-fn body inserts must map to REAL columns only (build an explicit camel+snake→column object; drop unknown keys) or PostgREST throws PGRST204; watch NOT NULL columns the form omits — `accounts_receivable.invoice_type` is NOT NULL so default it ('standard'), and both AP/AR `balance_amount` is NOT NULL so default to total−paid. The `check:routes` ratchet baseline is `docs/route-ownership-baseline.json`: after folding a domain, run `node scripts/check-route-ownership.mjs --update-baseline` and review the git diff — it will also absorb unrelated upstream drift (e.g. US-SUPER-008's `deal-desk-copilot` reclassified missingEdge→bothDivergent), so document any non-story domains it moves.

<!-- SELVEDGE:START -->
## Pearson Media — shared context

*Managed from the vault. Edit `14 - Resources/Shared CLAUDE Block.md` in the vault; direct edits between these markers are overwritten once a sync exists. Everything outside them is yours and is never touched.*

**The memory vault.** Portfolio-wide memory lives in the **Hermes** vault at `<your-home>\Documents\Hermes` (`C:\Users\dpearson\Documents\Hermes` on this machine; remote: https://github.com/dj-pearson/Hermes). It holds the profile, the map of all ten projects, and cross-project knowledge. Read `VAULT-INDEX.md` there when a task needs context beyond this repo. This repo's own `CLAUDE.md`, `~/.claude` memory, and skills remain authoritative for work inside it — the vault supplements them, never replaces them.

**Name the project.** Pearson Media runs ten projects on a shared stack. Never say "the app," "the repo," or "production" without naming which one. A right answer about the wrong project is a wrong answer.

**The shared stack.** React + TypeScript + Vite, Tailwind, shadcn/ui, self-hosted Supabase, Cloudflare Pages, Coolify on Contabo, Stripe. A problem solved in one repo is usually already solved for this one — check the vault before solving it twice.

**Secrets are references, never values.** Never write a password, key, or token value into a note, summary, commit, or setup doc; name where it's stored instead. Loose credential files exist under your `Documents` folder (`C:\Users\dpearson\Documents` on this machine) — never read one into a document.

**Never delete what Claude Code relies on.** Repo `CLAUDE.md` files, `~/.claude/projects/*/memory/`, `.claude/skills/`, settings. Copy from them freely; removing or stubbing them is Dj's call alone.

**Evidence only.** Verify state from the actual file or command before claiming anything is done or in place. If unsure, say so and go find out.

**Write like a person.** Every model was trained on the same corpus, so the default register is recognisable within a sentence and it lands in commits, PR bodies, docs, UI copy and error strings alike. State the point first, then support it. Have an opinion; asked which of two, name one. Use real names and numbers, not categories. Never label your own significance ("important", "crucial", "worth noting", "notably"); if it matters the reader will see it. Banned outright: *delve, dive into, deep dive, unpack, shed light on, pave the way, usher in, tap into, supercharge, unlock, elevate, empower, streamline, curate, showcase, boast, groundbreaking, cutting-edge, transformative, game-changing, innovative, pivotal, invaluable, meticulous, bespoke, vibrant, multifaceted, holistic, testament, tapestry, synergy, cornerstone, treasure trove, plethora, myriad, moreover, furthermore, additionally.* Banned decoratively but fine literally: *navigate, harness, leverage, robust, comprehensive, landscape, realm, journey*; the test is whether a reader could check the claim. Banned phrases: *"In today's…", "It's important/worth noting", "When it comes to", "At its core", "At the end of the day", "This is where X comes in", "Let's break it down", "plays a crucial role", "cannot be overstated", "underscoring the importance of", "highlighting the need for"*, and the whole chat register (*"Great question!", "Absolutely!", "I'd be happy to", "Let me know if you need anything else", "I hope this helps"*). Banned structures, which imitate insight without carrying any: *"not just X, it's Y"*, *"not only X but Y"*, *"this isn't about X, it's about Y"*, *"No X. No Y. Just Z."*, the rule of three that goes abstract on the third item, the rhetorical question as a transition, and closing with a summary of what was just read. **At most one em dash** per piece of writing, never as the default connector; use commas, parentheses and semicolons. Vary sentence and paragraph length deliberately. Uniform 18-word sentences are the signature that survives every word-level edit. Use contractions. Don't restate the question, don't open with a sweeping scene-setter, don't over-format (no emoji as structure, no header on a three-paragraph answer, no table for two rows). The one allowed exception is a **bold lead-in used as a heading** in a reference document like this one; a *run* of "**Bold term:** one sentence" bullets standing in for prose is the tell.

**Plain characters only.** Generated text carries Unicode that renders as ordinary punctuation, as ordinary whitespace, or as nothing at all, and it survives review precisely because it looks correct. **Anything a machine parses is ASCII unless the content requires otherwise**: code, config, JSON, YAML, CSV, SQL, regex, env values, filenames, URLs, commit subjects. Straight quotes `'` `"`, hyphen-minus `-`, three dots for an ellipsis, one ordinary space between words. Never emit curly quotes (U+2018/2019/201C/201D), en/em dashes (U+2013/2014), U+2026 ellipsis, U+2212 minus or U+2032 primes into code; a look-alike character in a PowerShell string or a SQL literal is a runtime failure, which is how `backup-databases.ps1` and `ssl-check.ps1` sat unparseable for months. Never emit a no-break space (U+00A0, and U+202F/2007/2009/2002/2003/3000), which breaks shell word-splitting, `grep` and column parsing while looking exactly like a space, or U+2028/U+2029, which are valid JSON and a syntax error inside a JS string literal. **Never emit an invisible or bidi character anywhere:** U+200B-U+200F, U+2060-U+2064, U+FEFF, U+00AD, U+034F, U+180E, the bidi controls U+202A-U+202E and U+2066-U+2069, and above all the Unicode tag block **U+E0000-U+E007F**, which encodes arbitrary ASCII invisibly and is the usual carrier for text a reviewer cannot see. Avoid homoglyphs (Cyrillic a/e/o/p/c/x, Greek omicron, fullwidth Latin, mathematical alphanumerics for bold): an identifier holding one compares unequal to the identifier it appears to be. Prose may use real typography and real accented names; prose may not carry characters that don't render. The one exception is a deliberate, load-bearing use, which carries a comment saying why. Scan with `rg -n '[\x{00AD}\x{034F}\x{061C}\x{180E}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{2069}\x{FEFF}\x{E0000}-\x{E007F}]'`.

**Terminal output is scrollback, not a report.** Answer first — no "I'll start by", no restating the request, no narrating tool calls the transcript already shows. Don't summarise a diff the reader can see or paste back code you just wrote; one line naming what changed and where, with `file:line` because it's clickable. Length matches the question: a yes/no gets a yes/no plus the clause that makes it trustworthy, and under about six lines there are no headers, bullets or tables. Report actual output, not a paraphrase: quote the failing assertion, say what was skipped, say plainly what's verified and what isn't. No emoji and no status theatre; "246 tests, 246 passing" beats "✅ All tests passing!" and is falsifiable. Don't close with an offer of more help or unrequested next steps: ask a real question, or name the real remaining work. Commits are imperative, what and why, no launch copy. PR bodies say what changed, why, how it was verified, and what's still open.

**UI has a craft floor.** Every model trained on the same SaaS templates, so the *default* frontend output is a recognizable handful of tells — and Tailwind + shadcn/ui puts each of them one autocomplete away. Treat the following as the category's defaults rather than as bans: the brief's own words can earn any of them, but reaching for one on a free axis means you were not deciding. Refuse **purple/blue gradients and gradient text** (emphasis comes from weight and size); **Inter or a system default as the type *choice***; a colored **`border-left`/`border-right` above 1px** on cards, list items, callouts or alerts — the single most recognizable tell; grids of **same-size icon-tile + heading + text cards** as the page structure, and **cards nested in cards**; a **1px border under a wide soft shadow** (declare elevation once — border *or* shadow); **gray text on colored surfaces** (tint secondary text from the surface hue or the foreground); **bounce/elastic easing**; **monospace as a costume** for "technical" rather than for code, data or measurement; and a **tracked uppercase eyebrow over every section**. Keep body measure at 65–75ch, tracking no tighter than -0.04em, and card radii at 12–16px.

**Check UI, don't just intend it.** `npx impeccable detect <path>` runs 60 deterministic anti-pattern rules with no install, no API key and no LLM — it works from any repo, so there is no excuse for asserting a UI is clean. Use the `/impeccable` skill (`audit`, `critique`, `polish`, `colorize`, `typeset`) for the judgement calls it cannot make. Source: [Impeccable](https://github.com/pbakaus/impeccable), Apache 2.0.
<!-- SELVEDGE:END -->
