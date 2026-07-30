# Production Gap Deep Dive — 2026-07-30

What actually stands between the current tree and production. Every claim is labelled
**VERIFIED** (I ran it, output quoted) or **STATIC** (derived from tooling without touching a
deploy). Run on branch `claude/production-gaps-deep-dive-g5c6kf`, merge base `21a8146`.

This supersedes the health section of `docs/CODEBASE-HEALTH-2026-07-27.md` where they disagree —
three of that document's findings have since been fixed, and repeating them would send someone
to fix what is already done.

## The environment trap comes first, because it invalidates everything else

`package.json` pins `engines.node: "20.x"` and `.npmrc` sets `engine-strict=true`. This container
shipped **Node 22.22.2** with a completely **empty `node_modules`**. Under that combination
`npm install` fails outright and every downstream command lies:

- `tsc` reports only 2 tsconfig deprecation errors — it bails before typechecking
- `vitest` is absent entirely
- the app appears catastrophically broken

Installed under `/opt/node20` (v20.20.2), `npm install` exited **0** and `npm run build` **passed**.

**If someone reports "everything is broken," check `node -v` before believing any of it.** Tracked
as `PROD-001`.

## What is green — VERIFIED

| Check                           | Result                                                                |
| ------------------------------- | --------------------------------------------------------------------- |
| `npm install` (Node 20)         | ✅ exit 0                                                             |
| `npm run build`                 | ✅ exit 0                                                             |
| `node scripts/check-types.mjs`  | ✅ Holds at baseline — **1067** errors, no regression                 |
| `npm run check:migrations`      | ✅ **40 files / 40 journal entries** — all journaled, prefixes unique |
| `npm run check:routes`          | ✅ No new ambiguous or missing-edge routes                            |
| `npm run check:nav`             | ✅ No new broken nav targets (42 known, 321 routes)                   |
| `npm run check:edge-paths`      | ✅ 176 migrated, **0** offenders                                      |
| `npm run check:proxy-overrides` | ✅ All 8 object-form proxies have a `server.ts` override              |
| `npm run check:datadumps`       | ✅ No table dumps tracked in git                                      |
| `npm run check:rootsql`         | ✅ No root-level `*.sql`                                              |
| `npm run check:deno-schemas`    | ✅ 106 files under `shared/`, no Node-only imports                    |

### Three findings from 2026-07-27 are now fixed — do not re-fix them

1. **Migration journal drift is resolved.** That audit found 21 unjournaled files and 4 duplicate
   prefixes (40 files vs 19 journal entries). `check:migrations` now passes at **40/40**, and
   `SUPA-005` wired it into CI. `SUPA-002` is closed.
2. **The three prod-404 domains it named are ported.** `ai-employees`, `web-forms` and
   `email-sequences` edge functions all exist; `check:routes` is green. `EDGE-019` is closed.
3. **Task Workflows is ported.** `supabase/functions/task-workflows/` exists. `EDGE-024` is closed.

`SUPA-003` deliberately stays **open**: the journal is reconciled, but whether the live database
has had those 21 files _applied_ is unverified — `check:drift` exits with `DATABASE_URL is not set`.

## The core production gap: 28 domains that work in dev and 404 in prod — MECHANISM VERIFIED

> **Updated later the same day.** The count is **28**, not 29, and the premise is no longer
> assumed. `client/src/lib/config.ts` `getApiUrl()` rewrites `/api/x` →
> `https://functions.printyx.net/x` whenever `import.meta.env.PROD`, with **no Express fallback
> anywhere in the path** — so an Express-only domain genuinely hard-404s in production.
>
> One flagged domain was a **false positive**: `quote-templates` used an API-shaped string as a
> TanStack Query *cache key* while its `queryFn` read `localStorage` and never touched the
> network. Fixed at the source (renamed to `local:quote-templates`) and removed from the
> baseline. I scanned the other 28 for the same no-network pattern — it was the only one.
>
> Two of the remaining 28 differ in kind: `predictive-analytics` and `technician-sessions` use
> the *default* `queryFn` (which fetches the queryKey as a URL) and have **no Express handler
> either**, so they are broken in **dev as well as prod**. `technician-sessions` also drives
> check-in mutations, so that technician workflow is non-functional everywhere. Neither has a
> backing table, so both need a schema decision rather than a port.
>
> **Measured effort:** PROD-012's four handlers alone are **3,950 lines** of Express
> (`voice-ticket-close` 860, `voice-agent` 825, `chatbot` 1200, `email-autopilot` 1065) across
> 4–9 endpoints each. The full port is roughly **20,000 lines** to re-express as Deno edge
> functions *with field-by-field shape parity*. This is multi-session work, and rushing it is
> actively harmful — the pages fall back to mock data with `|| [...]`, so a shape mismatch
> renders fabricated numbers, which is worse than the 404 it replaces.

Express serves dev; production hits the edge function directly. A domain with an Express handler
and no edge function is therefore **invisible locally and dead in production**. Derived from
`scripts/lib/route-parity.mjs`, counting only callers reachable from `App.tsx`/`main.tsx`:

**29 live prod 404s across 30 pages.** 26 have an Express handler to port from; **3 have no handler
on either side** (dead in dev _and_ prod) and need an implement-or-delete decision first:
`predictive-analytics`, `quote-templates`, `technician-sessions`.

| Batch      | Area                            | Domains                                                                                                               |
| ---------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `PROD-010` | AI, analytics, predictive       | ai, ai-analytics, predictive-analytics⁰, predictive-failure, business-process, daily-briefing, churn-risk, qbr        |
| `PROD-011` | Service, field, inventory       | service (2 pages), meter-reads, technician-sessions⁰, truck-stock, toner-replenish, portal-service, incident-response |
| `PROD-012` | Voice, chat, email automation   | voice-agent, voice-ticket-close, chatbot, email-autopilot                                                             |
| `PROD-013` | Quote, document, content        | accessories, quote-templates⁰, documents, content, renewal-autoquote, contract-tiered-rates                           |
| `PROD-014` | Platform, integration, security | erp-integration, security-compliance, white-label, workflow-automation (2 pages)                                      |

⁰ = no Express handler either.

**Porting is not route creation.** Per `CLAUDE.md`: use `normalizePath(url.pathname, '<fn>')`
because an edge handler never sees its own name in the path; filter every query by `tenant_id`; and
match the shape the page actually reads. **A wrong shape is worse than a 404** — these pages fall
back to mock data with `|| [...]`, so a mismatched response silently renders fabricated numbers
instead of failing loudly.

## 70 domains where dev and prod run different code — STATIC

`both-divergent` = an Express handler _and_ an edge function exist with no proxy-map entry, so the
same URL executes different code in dev and prod. A change verified locally can behave differently
in production, and nothing surfaces the divergence until a user hits it.

The count moved 59 → 69 → 70 through **detection fixes**, not regressions (`EDGE-020` taught the
tool to see Router-declared routes). These were always divergent; the tool could not see them.

Highest-risk members touch money and customer data: `invoices`, `contracts`, `financial`,
`chart-of-accounts`, `journal-entries`, `leases`, `subscriptions`, `pricing`, `commission`,
`leads`, `crm`. Tracked as `PROD-008`; `SUPA-021..024` already cover part of this set.

## The test suite cannot be trusted yet — VERIFIED

`npm run test` started at **26 failed files / 10 failed tests** of 95 files / 1423 tests. Almost
none were product bugs. Four distinct causes, and the worst one was not in vitest at all.

1. **16 files were a runner-ownership bug — FIXED (`PROD-002`).** `vitest.config.ts` declared no
   `include`/`exclude`, so its default glob swept up 10 Playwright specs under `tests/` (dying with
   "Playwright Test did not expect test() to be called here") and 6 sub-package files under
   `mobile/` and `printyx-client/`. Split by **extension**, not directory — `tests/` legitimately
   holds both, since `tests/blog-e2e-smoke.test.ts` is a passing vitest test sitting beside the
   specs. Now `*.test.ts` → vitest, `*.spec.ts` → Playwright, mutually exclusive.
   **Result: 26 → 10 failing files, 0 regressions** (all 69 previously-passing files still pass).

2. **The entire E2E suite collected ZERO tests — FIXED (`PROD-002`).** `npm run test:e2e` reported
   `Total: 0 tests in 0 files`. Playwright aborts the whole run on any collection error, and there
   were two: `tests/address-books.spec.ts:18` used `__dirname`, which does not exist because
   `package.json` sets `"type": "module"`; and Playwright's default `testMatch` also matched
   `*.test.ts`, so it loaded the vitest file and crashed on
   `Cannot redefine property: Symbol($$jest-matchers-object)` — vitest's `expect` colliding with
   Playwright's. Pinning `testMatch` to `*.spec.ts` and switching to `fileURLToPath(import.meta.url)`
   fixed both. **Result: 0 → 882 tests in 10 files.** Every claim that E2E coverage existed was
   false; nothing was running.

3. **7 tests never run at all** — not 6. `server/db.ts:35` throws
   `Database configuration incomplete` at _import_, and the repo ships only `.env.development` and
   `.env.example` — no `.env`. These fail at **collection**, so not one assertion executes:
   `tenant-isolation`, `tenant-resolution-cr001`, `products-crud-rbac`, `rbac-middleware-extended`,
   `sso-relaystate`, `pricing-input-validation`, and `voice-audio-host-allowlist`.

   `CLAUDE.md` calls the `tenantId` filter **SECURITY CRITICAL** and says a missing filter is a
   vulnerability. **The test proving that boundary holds has never run.** That is a production gap
   on its own, not just a test-hygiene issue. → `PROD-003`

4. **Genuine product/environment failures**, now visible instead of buried:
   - `server/tests/integration/report-execution.test.ts:337` expects `"Unsupported format"`,
     receives `"Missing required permissions"` — the permission check fires **before** format
     validation, so a bad format is misreported as an authorization failure. Real API-contract bug.
     `:399` concurrent execution — 10 parallel report executions do not all succeed. → `PROD-004`
   - `server/tests/task-scheduling.test.ts` needs a Claude API key (`Claude API key not
     configured`) — an external-service dependency, not a code defect.
   - `server/tests/api-endpoints.test.ts` used CommonJS `require()` for a `.ts` module, which
     vitest's ESM loader cannot resolve, so `beforeAll` threw and **all 33 tests silently skipped**.
     Converted to dynamic `import()`; they now execute and honestly report that they need a
     database, which puts them in `PROD-003`'s scope rather than hiding them.

**Net after `PROD-002`: 79 files / 69 passing, 10 failing files, 1384 passing tests, 0 regressions.**
Failing *tests* rose 10 → 39 — this is the fix working, not a regression: 33 api-endpoints tests
that were silently skipped now run and correctly report a missing database.

## One security guard is failing right now — VERIFIED

`npm run check:secrets` **FAILS**: 3 HIGH findings, all a Supabase `EXPO_PUBLIC_SUPABASE_ANON_KEY`
JWT committed at `mobile/eas.json` lines **12, 25, 40** (one per build profile). They are in git
history, so **rotation is required** — deleting the lines does not un-publish them. The guard
exists and already fails but does not gate CI, so the finding has simply sat there. → `PROD-005`
(overlaps `PA-014`, which adds `AppConfig.swift` and expiry bounding — close them together).

## Do not act on the `audit:*` suite's raw counts

Re-confirming the 2026-07-27 conclusion: `audit:security` reports 1863 "critical" of which 1433 are
"route may be missing auth" pointing at `middleware/rbac-route-helper.ts` — a helper, not a route.
`audit:edge-functions` reports 253/253 missing CORS; CORS is centralized in `_shared/cors.ts`.
`audit:api-contracts` reports 809 "no backend endpoint" because the scanner does not know edge
functions exist. **Trust the `check:*` ratchets** — they know about the proxy map and the edge
dispatcher and are CI-wired. Still untriaged and worth a look: 8 SQL-injection and 11
hardcoded-secret hits.

## The honesty gate on all of this

Every route finding above is **STATIC**. `CLAUDE.md` is explicit that the mechanism is proven but
nothing has been executed against a deploy, and asks for one curl per prefix before calling any of
it an incident. I could not close that gap here:

- `check:drift` exits with `DATABASE_URL is not set` — no live DB reachable
- `audit:pages` needs a running app, browser auth, and a **current** anon key; `CLAUDE.md` records
  that the committed keys are rotated/stale (GoTrue `/auth/v1/health` returns 401)

Static parity also cannot distinguish "404" from "200 with the wrong shape" — and the wrong shape
is the more dangerous failure. Closing this is `PROD-020`, and it should land early: it either
confirms the 29 or corrects them.

Note also that `audit-reports/` is **gitignored**. An audit that is not summarized into a committed
file does not survive the container.

## Recommended order

1. **`PROD-001`** — pin Node 20, so nobody debugs a phantom broken tree again.
2. **`PROD-002` + `PROD-003`** — make the suite tell the truth, and get the tenant-isolation
   guarantee actually tested. Cheapest large wins in the repo.
3. **`PROD-005`** — rotate and purge the committed anon key; make the guard gate.
4. **`PROD-020`** — confirm the static analysis against a real deploy before spending days porting.
5. **`PROD-006` + `PROD-007`** — retire 10 dead-caller domains and tighten the ratchet, so the
   remaining count is all signal.
6. **`PROD-010`..`PROD-014`** — port the 29 live prod 404s.
7. **`PROD-004`** — fix the report-execution ordering bug.
8. **`PROD-008`** — converge the 70 divergent domains, money and customer data first.
9. **`SUPA-003`** — verify the live DB is fully migrated (needs prod access + a backup first).
10. **`LAUNCH-011` / `LAUNCH-020`** — backup/restore rehearsal and load test before accepting real
    production data.

## Reproducing

```bash
# Node 20 is mandatory — on 22 the install fails and every result below is garbage
export PATH=/opt/node20/bin:$PATH   # or: nvm use 20
node -v                              # must print v20.x
npm install

npm run build
node scripts/check-types.mjs
npm run test
npm run check:migrations && npm run check:routes && npm run check:nav
npm run check:edge-paths && npm run check:proxy-overrides
npm run check:secrets                # currently FAILS — 3 committed JWTs

# enumerate the live prod 404s with their calling pages
node -e "import('./scripts/lib/route-parity.mjs').then(m=>{
  const r=m.computeParity(process.cwd());
  r.rows.filter(x=>x.klass==='missing-edge'&&x.frontendLive)
    .forEach(x=>console.log(x.domain, x.callers.live.length, x.express?'[express]':'[NO HANDLER]'));
});"
```
