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

QUALITY-002 typecheck ratchet: the canonical error count is whatever `node scripts/check-types.mjs` reports — it counts `: error TS\d+` regex MATCHES, NOT lines, because `--pretty false` suppresses tsc's "Found N errors" summary. `grep -c ": error TS"` undercounts (multi-match lines) and drifts the baseline; always measure batches with the script, not raw grep. Two build caveats: (1) `npm run build` is currently pre-existing-broken in this env — `@sentry/react` is declared in package.json but NOT in node_modules, so Rollup can't resolve its import in `client/src/main.tsx` (the entry) and the vite build dies before bundling anything; type-only changes are verified via tsc/ratchet instead. (2) High-leverage burn-down pattern: when many TS7006 implicit-any callback params cluster in one file, the data source is usually an untyped `apiRequest()` useQuery — type the derived `useMemo`/array with the file's EXISTING domain interface (e.g. `useMemo<EquipmentHealth[]>`) and the type flows through every `.find/.reduce/.filter/.map` callback at once, zero runtime change. NOTE: `server/routes-predictive-service-dispatch.ts` (~69 errors) references PHANTOM tables (`serviceCallsEnhanced`, `equipmentMetrics`, `technicianResourcesEnhanced`) that exist in NO schema/migration — those endpoints already 500 at runtime; a real fix needs new schema tables + migration, not just imports (deferred). (3) PHANTOM-SHAPE PAGES (BATCH 7, VendorManagement.tsx, 54 errs->0): a dense TS2339+TS2322 cluster on a CRUD page is often the page reading/writing field names that DON'T EXIST on the real Drizzle table — built against an old/mock shape. The tell: errors say "Property X does not exist on type {id; ...realcols}". These are LATENT RUNTIME BUGS (blank list cells, create POSTs the DB silently drops), so the fix is to re-bind every field to the REAL columns (confirm via shared/schema.ts + migration 0000 DDL + the storage method the /api route actually calls) and DELETE features with no backing column (VendorManagement's "preferred" had no column — removed it, not faked it). Two recurring sub-fixes: derive the form type from `insertXSchema.omit({tenantId:true})` (not bare `z.infer` that keeps server-injected cols / re-omits already-omitted createdAt/updatedAt -> TS2322 "never"), and add `value={field.value ?? ''}` to every Input/Textarea bound to a NULLABLE varchar (string|null is not a valid HTML value — this clears most of the TS2322s). (4) PHANTOM-SHAPE PAGES (BATCH 8, MeterReadings.tsx, 41 errs->0): same pattern, plus a normalization-layer tell. The page's useQuery `queryFn` already had a `.map((row:any)=>({...row, blackMeter: row.black_meter ...}))` normalizer inventing camelCase keys (blackMeter/colorMeter) that DON'T exist on the real Drizzle type — but the Express GET returns raw `SELECT *` snake_case rows, so against live data the page renders BLANK. Fix = make the normalizer emit the REAL camelCase column names (`bw_meter_reading`->`bwMeterReading`, `color_meter_reading`->`colorMeterReading`) and re-point every read/form field to them. Two extras beyond BATCH 7: (a) when the form omits BOTH `tenantId` AND `createdBy` (both server-injected, both NOT NULL), `insertXSchema.omit({tenantId:true,createdBy:true})` — a bare `.extend()` keeps them required and every defaultValues/field errors; (b) a phantom FK with no backing column (equipment has `locationDescription` free-text, NO `locationId`/locations FK) — don't fake a join; derive the filter options from the distinct free-text values present on the list (`Array.from(new Set(equipment.map(e=>e.locationDescription)))`), keeping the feature against real data. Server debt found but deferred: the POST route's `insertMeterReadingSchema.parse` requires `createdBy` it never injects (500s) — frontend posting correct column names is still a strict improvement. (5) UNTYPED-useQuery DATA-CONTRACT PAGE (BATCH 9, PlatformAnalytics.tsx, 32 errs->0): a TS2339-on-`{}` cluster (+ TS7006 on chart `.map` params) where `useQuery({queryKey})` passes NO generic, so `data` is `{}` and every `data?.foo` read errors. Distinct from BATCH 7/8 phantom-CRUD: this page reads FLAT keys (`revenueMetrics?.mrr`, `growthTrends?.revenueData`) with `|| mock` fallbacks on every field, but the `platform-analytics` edge fn returns a NESTED `{metrics,counts}` shape — so the reads resolve to undefined and the page silently shows MOCK data. Fix = type-only: add flat OPTIONAL interfaces matching the keys the page reads + chart-row types, apply `useQuery<T>(...)`; the fallback arrays and `.map` params then infer. Do NOT rewrite the flat<-nested contract here — that's a separate story (same gap EDGE-004 flagged for PlatformCustomerSuccess.tsx). General rule for these: when a page reads off an untyped useQuery, type the QUERY (one generic) rather than casting each read; the mock-fallback pattern means a flat-optional interface is both faithful to current runtime and zero-change. (6) PHANTOM-SHAPE PAGES (BATCH 10, Vendors.tsx, 30 errs->0): IDENTICAL to BATCH 7 — there are TWO vendor CRUD pages (VendorManagement.tsx fixed in B7, Vendors.tsx here) both built against the same phantom shape (vendorNumber/companyName/displayName/contactPerson/address/country/currency/vendorType/category/status/preferred + a banking section bankName/accountHolder/routingNumber/bankAccountNumber) absent from the real `vendors` table (real cols vendorName/primaryContactName/addressLine1/2/city/state/zipCode/phone/fax/email/website/paymentTerms/taxId/accountNumber/creditLimit/isActive/vendorNotes). Same fix recipe verbatim: form schema = `insertVendorSchema.omit({tenantId:true})`; `useQuery<Vendor[]>` (clears the TS18046 `vendors` is unknown that also blocks `.filter`); re-bind every field + card to real columns; `value={field.value ?? ''}` on nullable inputs; DELETE no-column features (here: vendorNumber/displayName/vendorType/currency/category, the Preferred Star toggle + its Star/StarOff lucide imports, the whole banking section), status-string select -> isActive boolean Switch, add a vendorNotes Textarea. LESSON: when you fix a phantom-shape page, grep for SIBLING pages on the same table (`grep -rl vendorNumber client/src`) — duplicate CRUD pages built off the same mock shape travel in pairs. (7) PHANTOM-SHAPE PAGES (BATCH 11, EnhancedProductAccessories.tsx, 35 errs->0): SAME pattern on the product_accessories CRUD page. The add/edit form bound 4 phantom fields (partNumber/weight/dimensions/warrantyPeriod) absent from the real `product_accessories` table (shared/schema.ts:2932; real cols accessoryCode/accessoryName/accessoryType/category/manufacturer/description + 3 pricing tiers + isActive/availableForAll/salesRepCredit/funding/lease), and the model-compatibility dialog read model.modelName/model.productType off `product_models` (real cols productName/category — NO modelName/productType). /api/product-accessories reads/writes the real Drizzle tables, so create POSTed dropped columns + compat dialog rendered blank model names (latent runtime bugs). Recipe verbatim: form schema = `insertProductAccessorySchema.omit({tenantId:true})` -> `AccessoryFormData` (the bare `InsertProductAccessory` kept server-injected tenantId, so defaultValues TS2353'd AND the zodResolver `Control<...>` generic mismatched at EVERY FormField — ~13 cascading TS2322 that all cleared from the ONE omit, not per-field fixes); `CompatibilityPayload = Omit<InsertAccessoryModelCompatibility,'tenantId'>` for the link-model mutation (cleared TS2345); useForm<AccessoryFormData>+zodResolver(accessoryFormSchema); mutation/onSubmit param types -> AccessoryFormData; REMOVED the 4 phantom FormFields; model.modelName->productName, dropped phantom productType (already fell back to model.category); `value={field.value ?? ''}` on every nullable Input/Textarea/Select; narrowed the manufacturer/accessoryType filter arrays with `.filter((m): m is string => Boolean(m))` (`filter(Boolean)` does NOT narrow string|null -> SelectItem value TS2322). Baseline 3638->3603 (-35). NEW TAKEAWAY beyond B7/10: a big chunk of the error count on these form pages is the resolver `Control<...>` cascade — one wrong useForm<T> generic detonates a TS2322 at every FormField, so the `.omit({tenantId:true})` form-schema fix is worth far more than its line count suggests. Product CRUD pages (vendors x2, meter readings, accessories) were ALL built against stale mock shapes — grep the real table columns FIRST. (8) UNTYPED-useQuery (BATCH 12, RemoteMonitoring.tsx, 26 errs->0): same as BATCH 9 — two `useQuery({queryKey})` calls (fleet-overview, sensor-data) with no generic typed `data` as `{}`, so every nested read (`.summary.*`, `.statusDistribution`, `.performanceTrends.weekly*`, `.topPerformers`, `.attentionRequired`, `.historicalData.*`, `.predictions.*`) was TS2339, plus 2 TS7006 on the `weeklyUptime.map((uptime,index))` chart-data params. Fix = add `FleetOverview`/`SensorData` interfaces matching the keys read and apply `useQuery<T>`; the chart `.map` params infer from `number[]`. Type-only, the `fleetOverview && /sensorData &&` guards already null-tolerate. Baseline 3603->3577.

Signatures consolidation (EDGE-005e): the frontend now calls the consolidated `/api/signatures/{requests,templates,analytics}` shape (was three flat `/api/signature-*` prefixes that 404'd in prod — no such function dirs). The `signatures/` dispatcher strips an OPTIONAL leading `signature-` from the first path segment, so BOTH `requests` and legacy `signature-requests` resolve (mobile/older callers keep working). Why a refactor and NOT the EDGE-005a server.ts plural→singular alias: server.ts STRIPS the matched fn-name segment before calling the handler, but the signatures dispatcher keys off that segment (the sub-resource) — a plain alias would erase the discriminator. `handlers/analytics.ts` derives REAL aggregates from `signature_requests` (totalContractValue=0 — no contract-value column; byDocumentType groups by `provider` — no document_type column). `handlers/templates.ts` returns `[]` — there is NO `signature_templates` table in any schema/migration (only requests/signers/documents exist). `/send` + `/:id/remind` are STUBS (audit log + status/timestamp bump; no provider envelope/email — DocuSign/Adobe/HelloSign wiring is a deferred PRD). GOTCHA: `ESignatureIntegration.tsx` was built against a MOCK camelCase shape (`requestedDate`/`documentName`/`customerName`/`remindersSent`) that does NOT match the real snake_case `signature_requests` columns — its request list/detail won't render correctly against live data; that data-contract rewrite is a separate story.

Line item order (QUOTE-020): the `lineItems` ARRAY ORDER is the source of truth — `buildQuoteData` persists it as `line_number` (index+1) and every read path (edge fn GET, both PDFs, share page) orders by `line_number`; PricingCalculator maps the array as-is. Drag-reorder in `LineItemManager` moves whole parent groups (sublines follow), rebuilds the array as [parent, ...sublines] blocks + orphan sublines at the end, renumbers 1..n, and hands it up via `onReorderItems`; autosave picks it up because the QUOTE-018 effect watches `lineItems`. Drag starts only from the GripVertical handle (rows are full of inputs) and is disabled in the group-by-type view (a local, non-persisted Switch that clusters by PARENT productType with per-group subtotals). Gotcha: sublines reference their parent by PRODUCT id (`parentLineId === parent.productId`), not the row id — any parent/subline matching must use productId.

Alias-target edge fns (EDGE-005f): three frontend prefixes whose URL segment differs from the edge-function DIR name are resolved the EDGE-005a way — a `server.ts` route override (prod) PLUS a `crmProxies` entry (dev), so both land the same handler path. (1) `/api/deployment/{readiness,metrics}` → `deployment-readiness/` fn (override `deployment`→`deployment-readiness`); the fn now returns the exact `ReadinessCheck[]` / `DeploymentMetrics` shapes `DeploymentReadiness.tsx` types (derived from live tenant signals), not the legacy `{ready,checks}` object — returning the WRONG shape is worse than a 404 because the page does `readinessChecks || mockChecks` and would `.filter` a truthy object. (2) `/api/integration-hub/dashboard` → `integrations/` fn `/dashboard` branch (override `integration-hub`→`integrations`); detect it via `normalizePath` BEFORE the `!segment1` GET-list branch or that branch swallows it. The integrations fn still indexes `pathParts[1]` (NOT migrated to normalizePath in EDGE-002m) so its OTHER routes are off-by-one under server.ts strip — out of scope, but don't copy that pattern. (3) `/api/public/calculator/*` is the UNAUTHENTICATED marketing calculator → new `public-calculator/` fn (override fires only when `functionName==='public' && subPath[0]==='calculator'`, proxy uses `{fn:'public-calculator',pathPrefix:'/calculator'}` to re-add the segment the mount strips). Auth-bypass reality: `config.toml verify_jwt=false` is for the NATIVE Supabase runtime only — the Coolify `server.ts` dispatcher ignores config.toml and enforces auth PER-HANDLER, so "public" just means the handler never calls `auth.getUser` (same as the `signup` fn). Its pure calc engine is duplicated at `supabase/functions/_shared/print-cost-calculator.ts` (near-verbatim copy of `server/services/print-cost-calculator-service.ts` — keep in sync). Email nurture rows are recorded (`email_sequence_tracking` status='pending') but the provider SEND is stubbed (no email infra in the edge fn). GOTCHA: the `deno check` getUser(jwt) `string|null` vs `string|undefined` TS2345 is a pre-existing pattern across ~40 edge fns (`createSupabaseClient` uses `req.headers.get('Authorization')!`); fix the files you touch by extracting jwt as `... : undefined` not `: null`. `deno lint`'s `no-explicit-any` is unenforced here (no `deno.json` anywhere, not in CI) and the whole edge codebase uses `any` on untyped supabase rows — match that style. The QUALITY-002 typecheck baseline drifts UP from main merges (PR #184 pushed clean main to 3910 vs a 3840 baseline); reconcile it when a story's own tree adds 0 tsc errors, documenting the upstream cause — don't try to "fix" 70 unrelated pre-existing errors.

Platform-admin CRM edge fns (EDGE-004): `/api/platform-{crm,deals,activities,analytics,cs}` are the root-admin platform CRM pages. Only `platform-deals` + `platform-crm` had edge fns before; `platform-activities`/`platform-analytics`/`platform-cs` were Express-only and 404'd in prod. NEW fns mirror the siblings: gate on root admin (`role level >= 7 OR roles.can_access_all_tenants`) via the service-role client, `normalizePath(pathname, '<fn>')`, query the canonical `platform_*` tables in `shared/platform-crm-schema.ts` (NOT `shared/schema.ts`). DECISION RULE for these: dir name == URL prefix segment, so a PLAIN `crmProxies` entry is enough — NO `server.ts` override needed (unlike EDGE-005a/005f where the dir name differed). Two shape rules: (1) COMPUTED analytics endpoints (revenue-metrics/conversion-metrics/pipeline-metrics/performance-metrics/growth-trends/health-trends) must return the EXACT camelCase keys the page reads (`revenueData`,`funnelData`,`distributionData`,`sourceData`,`metrics.{mrr,arr,...}`) — the pages fall back to MOCK data with `|| [...]` so a wrong shape silently shows fake numbers; (2) list endpoints return raw snake_case rows like the `platform-crm` sibling. GOTCHA — the legacy Express handlers referenced PHANTOM columns that don't exist in the schema and would 500 at runtime: `platform_activity_reports.report_date`/`rep_id`/`rep_name`/`calls_logged`/`emails_sent`/`leads_generated` (real cols are `period_start`/`user_id`/`total_calls`/`total_emails`/`meetings_held`/`demos_completed`/`new_deals`/`deals_won`/`total_arr_booked`); `platform_business_records.last_mrr_change` (absent → expansion MRR is always 0); `platform_cohort_analysis.period_type`/`customers_at_start`/`revenue_at_start` (real cols are `cohort_period`/`initial_size`/`initial_mrr`/`current_size`/`retention_rate`); `platform_churn_predictions.churn_risk_level`/`estimated_revenue_impact` (real: `churn_risk`/`estimated_arr`). The edge fns adapt to the REAL columns (an improvement, per the schema-audit AC). SEPARATE-STORY DEBT: `PlatformCustomerSuccess.tsx` types `TenantHealth` (healthGrade/companyName/mrr/daysUntilRenewal/csmId) against a MOCK shape that does NOT match the real `platform_health_scores` columns (overall_score/health_status/...) — the endpoints now RESOLVE (200 instead of prod 404) but the page's field-by-field render is a data-contract rewrite out of scope. Deleted the four `routes-platform-{business-records,activities,analytics,customer-success}.ts` (kept `routes-platform-deals.ts`); deleting the phantom-col files DROPPED the tsc ratchet 3910→3795 (−115) — tighten the baseline. `requireRootAdmin` is exported from `routes-root-admin.ts` (kept) and was the only cross-import.

Plural-prefix→singular-fn alias (EDGE-005a): `/api/accounts-{payable,receivable}` (plural, flat) → `account-{payable,receivable}/` fn dirs (singular). DECISION RULE — when the frontend uses a FLAT prefix (list at `/`, item at `/:id`) and the edge fn dir name only differs by spelling, use a PLAIN proxy entry + server.ts override and make the HANDLER flat (normalizePath, id at `parts[0]`). Do NOT use a `pathPrefix` alias to re-add a nested segment like `/bills`: pathPrefix is dev-only, but prod hits `functions.printyx.net/<prefix>` directly and server.ts strips the function-name segment, so the handler sees a flat path with nothing to inject — pathPrefix would 404 in prod. BIGGER LESSON FROM THIS STORY: these two edge fns were querying ENTIRELY WRONG TABLES (account-payable→`bills`, account-receivable→`invoices`/`payments`) — the canonical tables are `accounts_payable`/`accounts_receivable` (shared/schema.ts), which the legacy Express handler in `server/routes-products-crud.ts` (via `storage.getAccountsPayable/Receivable`) already used. ALWAYS confirm which table the canonical Drizzle schema + legacy Express storage method use before trusting an existing edge fn's `.from('...')`. Edge-fn body inserts must map to REAL columns only (build an explicit camel+snake→column object; drop unknown keys) or PostgREST throws PGRST204; watch NOT NULL columns the form omits — `accounts_receivable.invoice_type` is NOT NULL so default it ('standard'), and both AP/AR `balance_amount` is NOT NULL so default to total−paid. The `check:routes` ratchet baseline is `docs/route-ownership-baseline.json`: after folding a domain, run `node scripts/check-route-ownership.mjs --update-baseline` and review the git diff — it will also absorb unrelated upstream drift (e.g. US-SUPER-008's `deal-desk-copilot` reclassified missingEdge→bothDivergent), so document any non-story domains it moves.
