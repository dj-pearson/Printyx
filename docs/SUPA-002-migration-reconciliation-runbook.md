# SUPA-002 / SUPA-003 — Migration Journal Reconciliation Runbook

Prepared 2026-07-27. The **repo side is already done and committed**; what remains are the
database-side steps, which need credentials this session does not have. Run them in order.

---

## What was wrong

`drizzle/migrations/` held **40 numbered migration files but only 19 journal entries.**
Drizzle's migrator only ever looks at files listed in `meta/_journal.json`, so **21 migrations
had never been applied and never could be.** Four of them also collided on duplicate 4-digit
prefixes (`0008`–`0011`).

The gap is not a tail — it is a **hole in the middle**. The journal covered `0000`–`0011` and
then jumped straight to `0029`–`0035`. Everything numbered `0012`–`0028` was skipped, while
later migrations were applied on top. Your live schema therefore has the `0029+` changes but is
missing seventeen earlier ones.

### Why simply adding the missing files to the journal would NOT have worked

`drizzle-orm/pg-core/dialect.js` decides what to run with exactly this test:

```js
if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
  /* apply */
}
```

It compares each migration's journal `when` against the **single latest `created_at`** in the
ledger. Migration `0035` is already applied with `when = 1784817477195`. Any entry added with a
smaller `when` — which is what the original numbering implies — would be **permanently skipped,
silently.** The reconciliation had to renumber the orphans so they sort _after_ everything
already applied.

---

## What is already committed (repo side)

1. **All 21 orphans renumbered `0036`–`0056`**, preserving their original relative order, which
   satisfies every dependency (`0036` creates `monitoring_clients`, which `0037`/`0038`
   reference; `0039`/`0040` reference `device_registrations` from `0000`). Pure `git mv` —
   **0 insertions, 0 deletions**, no SQL content was touched.
2. **40 journal entries**, `idx` contiguous `0..39`, `when` strictly increasing, every new entry
   above `0035`'s. `npm run check:migrations` now passes.
3. **Two real bugs fixed in `server/lib/migrate.ts`** that sat directly on this recovery path:
   - `db:migrate:baseline` and `db:migrate:status` used an **unqualified**
     `__drizzle_migrations`, which resolves to `public.*`. Drizzle's migrator reads and writes
     `drizzle.__drizzle_migrations`. Baselining was writing to a table the migrator never
     consults — **it did nothing.**
   - `baseline` stamped `created_at = Date.now()` instead of the journal's `when`. Because of
     the comparison above, that parks a value higher than every `folderMillis` and would
     **permanently skip every future migration.**

### All 21 are safe to re-run

Every DDL statement in all 21 files is guarded (`CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). I checked statement-by-statement with
comments stripped: **no bare `CREATE TABLE`, no bare `CREATE INDEX`, no bare `ADD COLUMN`, no
`ADD CONSTRAINT`, no `CREATE TYPE`.** So if some objects were already created by hand or via
`db:push`, re-applying is a no-op rather than an error.

All 11 tables they create are backed by real Drizzle schema in `shared/` — none are dead code:

| Table                                                               | Schema file                                 |
| ------------------------------------------------------------------- | ------------------------------------------- |
| `monitoring_clients`, `client_enrollment_tokens`, `client_commands` | `shared/client-monitor-schema.ts`           |
| `device_alerts`, `device_supply_orders`                             | `shared/manufacturer-integration-schema.ts` |
| `custom_field_definitions`                                          | `shared/custom-fields-schema.ts`            |
| `crm_notes`, `crm_associations`                                     | `shared/crm-associations-schema.ts`         |
| `web_forms`, `web_form_submissions`                                 | `shared/web-forms-schema.ts`                |
| `email_sequence_enrollments`                                        | `shared/email-sequence-schema.ts`           |

Corroborating evidence that these really are unapplied: `CLAUDE.md` documents that the proposals
edge function "retries without those two columns on PGRST204 until the migration is applied" —
those columns are added by `0047_proposal_discount_reason`, one of the orphans. Likewise
`web_forms` (`0055`) and `email_sequence_enrollments` (`0056`) are two of the three domains that
also lack an edge function.

---

## Step 0 — Back up first. Non-negotiable.

```bash
npm run db:backup
```

Confirm the dump exists and is non-trivial in size before continuing. Everything below is
reversible only from this backup.

---

## Step 1 — Introspect. Do not skip; the next step branches on the result.

Connect with `psql "$DATABASE_URL"` and run:

```sql
-- 1a. Which ledger tables exist? Reveals whether the buggy baseline ever wrote to public.*
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = '__drizzle_migrations';

-- 1b. THE decisive number: what drizzle believes is applied.
SELECT count(*) AS rows, max(created_at) AS max_created_at
FROM drizzle.__drizzle_migrations;

-- 1c. Which of the 11 tables the orphans create already exist?
SELECT unnest(ARRAY[
  'monitoring_clients','client_enrollment_tokens','client_commands','device_alerts',
  'device_supply_orders','custom_field_definitions','crm_notes','crm_associations',
  'web_forms','web_form_submissions','email_sequence_enrollments'
]) AS expected_table
EXCEPT
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Rows returned = tables that do NOT yet exist.

-- 1d. Which of the columns the orphans add are already present?
SELECT probe.tbl, probe.col,
       (c.column_name IS NOT NULL) AS present
FROM (VALUES
  ('monitoring_clients','customer_id'),
  ('device_registrations','customer_id'),
  ('device_alerts','triggered_order_id'),
  ('blog_agent_settings','revision_retention_days'),
  ('product_models','new_dealer_cost'),
  ('proposal_line_items','notes'),
  ('proposal_line_items','product_code'),
  ('proposal_line_items','discount'),
  ('proposals','total_dealer_cost'),
  ('proposals','share_token'),
  ('proposals','discount_reason'),
  ('proposal_templates','template_content'),
  ('company_branding_profiles','settings'),
  ('tenants','metadata'),
  ('users','metadata'),
  ('deals','custom_fields'),
  ('business_records','custom_fields'),
  ('company_contacts','custom_fields'),
  ('pipeline_stages','legacy_stage_id'),
  ('workflow_executions','dedupe_key'),
  ('workflow_executions','resume_at')
) AS probe(tbl,col)
LEFT JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name=probe.tbl AND c.column_name=probe.col
ORDER BY present, probe.tbl, probe.col;
```

**Send me the output of 1a–1d and I will tell you exactly which branch you are on.**

---

## Step 2 — Pick the branch based on Step 1

### Branch A — `drizzle.__drizzle_migrations` exists and `max_created_at = 1784817477195`

The expected, healthy case: migrations through `0035` are recorded. The 21 new entries all carry
a larger `when`, so they apply cleanly.

```bash
npm run db:migrate:status     # sanity check — now reads the correct table
npm run db:migrate
```

### Branch B — the table is missing, or `rows = 0`

`lastDbMigration` is undefined, so drizzle would try to apply **everything from `0000`**,
including the 617 KB `0000_fuzzy_blizzard.sql`, against a populated database. **Do not run
`db:migrate`.** Baseline first so the already-applied history is recorded, then migrate:

```bash
npm run db:migrate:baseline   # now writes to drizzle.* with correct created_at values
npm run db:migrate:status     # verify 40 rows
```

Note the baseline marks _all 40_ as applied without executing them — correct only if Step 1
showed the objects already exist. If 1c/1d show them missing, tell me and we will baseline
through `0035` only and let `0036`+ run for real.

### Branch C — `max_created_at` is a wall-clock-recent value (≈ `Date.now()`)

The old buggy `baseline` was run at some point. That value exceeds every `folderMillis`, so
**`db:migrate` will silently do nothing forever.** Send me the exact number before touching
anything — the fix is to correct the ledger rows, not to re-run the migrations.

---

## Step 3 — Verify

```bash
npm run db:migrate:status                     # expect 40 applied
npm run check:migrations                      # expect green (already green in-repo)
npx tsx scripts/check-schema-drift.ts --live-sql
```

Then re-run Step 1's queries 1c and 1d — every table should exist and every column should read
`present = true`.

---

## Step 4 — Follow-on work this unblocks

- **SUPA-004** — remove the PGRST204 "retry without column" fallbacks in the proposals edge
  function once `0047` is confirmed applied.
- **The three prod-404 domains** — `web_forms` and `email_sequence_enrollments` now have their
  tables; they still need edge functions (`/api/web-forms`, `/api/email-sequences`), as does
  `/api/ai-employees`. See `docs/CODEBASE-HEALTH-2026-07-27.md`.
- **PA-032 / DR readiness** — with a contiguous journal, a fresh database is now provisionable
  from versioned migrations alone. Worth proving on a scratch database.
