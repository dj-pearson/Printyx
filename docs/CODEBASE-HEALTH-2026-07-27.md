# Codebase Health Deep Dive — 2026-07-27

Ground-truth audit of what works and what does not, run against `claude/codebase-audit-bugs-80fkiv`
(merge base `2bb88df`). Every claim below is labelled **VERIFIED** (I ran it) or **HEURISTIC**
(a tool reported it and I did not confirm each instance).

## Where the previous page-by-page report went

It was never committed. `npm run audit:pages` (`scripts/page-error-audit.ts`) and the whole
`scripts/audit/*` suite write to `./audit-reports/`, which is **gitignored** (`.gitignore:124`).
The report lived only on the machine that produced it.

Worse, the suite could not have run from a clean clone at all: `scripts/audit/lib/report-generator.ts`
was **missing from git** — never added in any commit — and 5 of the 7 audit scripts import it.
Every one of them died with `ERR_MODULE_NOT_FOUND`. That module is restored in this commit, and
the audit suite runs again.

**Root cause, and it is worth fixing properly:** `.gitignore` line 68 was a bare `report*`. A
gitignore pattern with no slash matches **any path segment at any depth**, so `report*` silently
ignored `scripts/audit/lib/report-generator.ts`. Someone wrote the module, ran `git add`, git
skipped it without complaint, and the whole audit suite shipped broken.

The same landmine had already been hit repeatedly — the rule carried **21 negation lines**
(`!server/domains/reporting.ts`, `!drizzle/reports/**`, `!server/routes-reports.ts`, …) papering
over collateral damage. This commit anchors the pattern to `/report*` (root only) and deletes all
21 negations. Verified against every file in the repo: exactly one path changes state
(`report-generator.ts` becomes tracked) and **nothing becomes newly ignored**.

The durable, committed equivalents of a page-by-page report are:

| Artifact                                              | What it tracks                                            |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `prd.json` (660 stories)                              | The real backlog. `passes: false` = open.                 |
| `docs/route-divergence.json`                          | Express↔edge parity worklist (heuristic)                 |
| `docs/nav-targets-baseline.json`                      | Nav targets that land on the 404 page                     |
| `docs/typecheck-baseline.json` / `lint-baseline.json` | Ratchets                                                  |
| `system-check-report.json`                            | Stale — paths are `C:\Users\pears\...` from a Windows run |

## Headline: the app builds and ships; the breakage is environmental and prod-only

The most useful finding is that **the codebase is in better shape than the docs claim**, and the
things that are genuinely broken are concentrated in three places: the dev environment, the
migration journal, and Express-only endpoints that 404 in production.

## What works — VERIFIED

| Check                                       | Result                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `npm run build`                             | ✅ Passes, 1m 2s, full bundle emitted                               |
| `node scripts/check-types.mjs`              | ✅ Holds at baseline — 1083 errors, no regression                   |
| `node scripts/check-lint.mjs`               | ✅ Holds at baseline — 11994 problems (10650 errors, 1344 warnings) |
| `npm run test`                              | ✅ 1346 tests passing                                               |
| `npm run check:nav`                         | ✅ No new broken nav targets (42 known, 321 routes)                 |
| `npm run check:edge-paths`                  | ✅ 169/169 edge functions normalized, 0 offenders                   |
| `npm run check:proxy-overrides`             | ✅ All 6 object-form proxies have a `server.ts` override            |
| `npm run check:datadumps` / `check:rootsql` | ✅ Clean                                                            |

**Correction to `CLAUDE.md`:** it states `npm run build` is "pre-existing-broken in this env"
because `@sentry/react` is declared but absent from `node_modules`. That is not a repo defect —
it was a **failed install**. Installed under Node 20, `@sentry/react` is present and the build
succeeds. The QUALITY-002 note that type-only changes "cannot be build-verified" no longer holds.

Typecheck is also far better than documented: `QUALITY-002` describes 6176 errors and `CLAUDE.md`
quotes a 3577 baseline. The actual current baseline is **1083**.

## What is broken — VERIFIED

### 1. Node 20 is mandatory and nothing says so at failure time — BLOCKER for onboarding

`package.json` pins `engines.node: "20.x"` and `.npmrc` sets `engine-strict=true`. On Node 22
`npm install` **fails outright** (`EBADENGINE`/`notsup`), leaving `node_modules` empty. Every
downstream command then fails in a misleading way: `tsc` reports only 2 tsconfig deprecation
errors (it bails before typechecking), and `vitest` is simply absent.

This is very likely the root of "a lot is broken" — a half-installed tree makes a healthy repo
look catastrophic. Fix: use Node 20 (`nvm use 20`).

### 2. Migration journal drift — highest-risk item

`npm run check:migrations` **FAILS with 25 problems**:

- **21 migration files have no journal entry** (`0012_auto_orders` … `0028_email_sequence_enrollments`,
  plus `0008_client_enrollment_tokens`, `0009_monitoring_clients_customer_id`, `0010_client_commands`,
  `0011_device_alerts`). Drizzle's migrator only applies journalled files, so **these have never run**.
- **4 duplicate prefixes**: `0008`, `0009`, `0010`, `0011` each have two different files.

40 migration files on disk vs **19 journal entries**. The live database therefore does not match
`shared/`. This is the most plausible cause of runtime 500s, `PGRST204` "column not found" errors,
and blank pages that look like frontend bugs but are missing columns. It is tracked as `SUPA-002`/
`SUPA-003` and is the thing I would fix first.

### 3. Three live pages that work in dev and 404 in production

`npm run check:routes` **FAILS** with 3 new missing-edge routes. I confirmed each has an Express
handler, no edge function, and a live routed consumer:

| Endpoint               | Express handler                       | Live consumer                                            |
| ---------------------- | ------------------------------------- | -------------------------------------------------------- |
| `/api/ai-employees`    | `server/routes/ai-employee-routes.ts` | `/ai-employees` → `AIEmployeeDashboard.tsx`              |
| `/api/email-sequences` | `server/routes-email-sequences.ts`    | `pages/marketing/EmailSequencesPage.tsx`                 |
| `/api/web-forms`       | `server/routes-web-forms.ts`          | `pages/marketing/WebFormsPage.tsx`, `WebFormBuilder.tsx` |

Because Express serves dev and production hits the edge function directly, these are invisible
locally and dead in prod — the exact failure mode `CLAUDE.md` warns about.

Also failing: **`/api/custom-fields` has ambiguous ownership** — both an Express handler and an
edge function, with no proxy entry, so dev and prod run different code.

### 4. The test suite conflates three test systems

`npm run test` reports **26 failed files / 10 failed tests**. Almost none are product bugs:

- **Playwright specs run under vitest** — `tests/*.spec.ts` (smoke, critical-flows, quote-flow,
  proposal-flow, page-audit, a11y…) fail with "Playwright Test did not expect test() to be called here".
- **Sub-package tests** — `mobile/`, `printyx-client/` get swept in.
- **No `DATABASE_URL`** — only `.env.development` and `.env.example` exist, no `.env`, so
  `server/db.ts:35` throws and takes down `tenant-isolation`, `tenant-resolution-cr001`,
  `products-crud-rbac`, `rbac-middleware-extended`, `sso-relaystate`, `pricing-input-validation`.

Those security tests are **not verified to pass** — they never ran. Genuine assertion failures are
confined to `server/tests/integration/report-execution.test.ts` (permission check fires before
format validation, so the error is "Missing required permissions" instead of "Unsupported format").

## The `audit:*` suite is noisy — do not act on its raw counts

Now that it runs, it produces alarming numbers that are **mostly false positives**. I verified
each class:

| Audit          | Reported                                               | Reality                                                                                                                                          |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| security       | 1863 critical                                          | 1433 are "route may be missing auth" — flags `middleware/rbac-route-helper.ts`, a helper, not a route. **False positive.**                       |
| edge-functions | 253/253 missing CORS                                   | CORS is centralized in `_shared/cors.ts` + `server.ts`; the detector only looks in-file. **False positive.**                                     |
| api-contracts  | 809 "no backend endpoint"                              | The scanner does not know edge functions exist. `/api/companies` was flagged and has _both_ an Express route and an edge fn. **False positive.** |
| security       | 8 SQL-injection, 7 hardcoded password, 4 hardcoded JWT | **Not triaged — worth a look.**                                                                                                                  |

**Trust the `check:*` ratchets, not the `audit:*` suite.** The ratchets are purpose-built, know
about the proxy map and edge dispatcher, and are CI-wired. The audit suite is a broad heuristic
sweep whose detectors predate the current architecture.

## Backlog state

660 stories: **477 done, 183 open.**

| Area            | Open | Nature                                                      |
| --------------- | ---- | ----------------------------------------------------------- |
| IOS             | 53   | Native iOS app — separate track                             |
| AOS             | 41   | "Agentic OS" — net-new feature work, 0 started              |
| SUPA            | 22   | **Schema/migration/parity — where the real breakage lives** |
| PA              | 21   | Platform audit remediation                                  |
| EDGE            | 16   | Express→edge migration tail                                 |
| CR              | 14   | Code-review backlog                                         |
| CRMX / US-SUPER | 12   | Feature work                                                |
| AUDIT           | 1    | AUDIT-014 nav targets (partially done)                      |

Most of the 183 are **unbuilt features, not regressions**. The genuine "broken" set is concentrated
in SUPA + the route-parity tail.

## Recommended order of work

1. **Pin Node 20 in the dev loop** so nobody debugs a phantom broken tree again.
2. **SUPA-002/003 — reconcile the migration journal.** Nothing else can be trusted while the live
   schema is unknown. Requires a DB backup first.
3. **Fix the 3 prod-404 domains + `/api/custom-fields`** to get `check:routes` green.
4. **Split the test runner** so vitest stops collecting Playwright specs and sub-packages, and
   provide a test `DATABASE_URL` so the tenant-isolation and RBAC tests actually run.
5. **Triage the 8 SQL-injection and 11 hardcoded-secret hits** from the security audit.
6. Then resume the SUPA/EDGE parity tail.

## Reproducing this

```bash
nvm use 20 && npm install

npm run build
node scripts/check-types.mjs
node scripts/check-lint.mjs
npm run test
npm run check:migrations   # currently FAILS — 25 problems
npm run check:routes       # currently FAILS — 4 problems
npm run check:nav && npm run check:edge-paths && npm run check:proxy-overrides

npx tsx scripts/audit/route-overlap-audit.ts   # suite works again; treat output as heuristic
```

`npm run audit:pages` additionally needs a running app at `BASE_URL` plus browser auth; it was not
runnable here (no live DB or current anon key). Its output still lands in gitignored
`audit-reports/` — **commit a summary if you want it to survive.**
