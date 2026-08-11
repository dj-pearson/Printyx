# COP-M00 — Why `db:generate` over-emits, and how to fix it safely

**Prepared 2026-08-11.** The diagnosis and the CI guard are committed. The reconciliation itself
needs database introspection, which the session that found this had no access to. Do not attempt
the shortcut described in "The trap" below.

---

## The symptom

Add one nullable column to a table, run the sanctioned `npm run db:generate`, and you get a
**2,281-line migration containing 141 statements** — almost none of them yours. It is written as
`0040_<name>.sql`, which collides with the existing `0040_auto_orders.sql` and fails
`npm run check:migrations`.

So no story that needs a schema change can ship. That is what makes this a blocker rather than a
papercut: it gates COP-M04, COP-M05, and through them the entire Phase 3 copier wedge
(COP-B04 Opportunity Radar, COP-B05 Fleet Assessment, COP-B06 installed-base quoting), plus
COP-B03, COP-B13, COP-B14, COP-M06, COP-B09, COP-B10 and COP-I06.

---

## Root cause: the snapshot chain, not the journal

`drizzle/migrations/meta/` holds **15 snapshots** — the highest is `0018_snapshot.json` — against
**40 journal entries** (idx 0–39, highest tag `0056_email_sequence_enrollments`).

drizzle-kit diffs your schema against the snapshot of the **last journal entry**. That snapshot
does not exist, so it silently falls back to the newest one it can find (0018) and re-emits every
change made since.

Missing snapshot idx: `10–13` and `19–39`.

**The journal itself is healthy.** All 40 files are journaled, prefixes are unique, idx is
contiguous — `check:migrations` passed throughout. This is a different defect from SUPA-005, whose
guard checks the journal and could never have caught it. The guard has now been extended
(check `(e)`), as a ratchet against the known gap of 25.

### A second, related defect

drizzle-kit names a new migration from the **journal length** (40 → `0040_*`), while files on disk
run up to `0056`. So a freshly generated file always collides. Note that the file numbering is
**deliberately** non-contiguous — SUPA-002 renumbered 21 orphans to `0036`–`0056` so their `when`
values sort _after_ everything already applied, because drizzle's migrator applies a migration only
when `lastDbMigration.created_at < migration.folderMillis`. **Do not "tidy" the numbering.** It is
load-bearing.

---

## What the drift actually contains

This is the part that decides the fix. The 141 statements are **not** all
already-applied noise:

| Category                                          | Count   | Meaning                                                                                                                     |
| ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Tables created by migrations `0036`–`0056`        | ~11     | Journaled but, per the SUPA-002 runbook, **not yet applied** to the database. `db:migrate` will apply them by content hash. |
| Tables in `shared/*` with **no migration at all** | **107** | True un-migrated drift. Almost certainly created by `db:push` (dev-only) straight against the database.                     |
| Columns with no migration                         | 1       | `blog_agent_settings.pipeline_stages_config`                                                                                |

The 107 by domain:

| Domain                                                               | Count  | Examples                                                                             |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `blog_*`                                                             | 71     | `blog_aeo_scores`, `blog_api_keys`, `blog_experiments`, `blog_qa_reports`            |
| `truck_*`                                                            | 4      | `truck_inventory`, `truck_stock_settings`                                            |
| `chatbot_*`, `email_autopilot_*`, `renewal_*`, `voice_*`             | 3 each | `renewal_auto_quotes`, `voice_ticket_closes`                                         |
| `booking_*`, `daily_*`, `machine_*`, `meter_*`, `qbr_*`, `service_*` | 2 each | `booking_pages`, `qbr_reports`                                                       |
| singletons                                                           | 9      | `customer_churn_scores`, `equipment_failure_predictions`, `contract_pnl_settings`, … |

Several of these back shipped features — `renewal_auto_quotes` is US-SUPER-010, `booking_pages`
is the booking work, `equipment_failure_predictions` is predictive service.

---

## The trap

The tempting fix is to generate once, take the snapshot drizzle-kit produces (which encodes the
**current schema**), install it as `meta/0039_snapshot.json`, and enjoy a clean `db:generate`
forever after.

**Do not do this.** It would silently absorb all 107 unmigrated tables into "already known", so
they would never receive a migration. The drift would be permanent and invisible, and any fresh
environment built from migrations alone would be missing 107 tables.

The snapshot may only be advanced to a state the migrations actually produce.

---

## The fix

### Step 0 — Back up. Non-negotiable.

```bash
npm run db:backup
```

### Step 1 — Introspect. The next step branches on this.

```sql
-- Which of the 107 already exist? (build the array from the inventory above)
SELECT unnest(ARRAY['renewal_auto_quotes','booking_pages','truck_inventory', /* … */]) AS expected
EXCEPT
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Rows returned = genuinely absent.

-- What does drizzle believe is applied?
SELECT count(*), max(created_at) FROM drizzle.__drizzle_migrations;
```

### Step 2 — Apply the 21 pending journaled migrations first

They are already journaled and every statement is guarded (`IF NOT EXISTS`), per the SUPA-002
runbook. This is prerequisite: reconciling drift on top of an out-of-date database conflates two
problems.

```bash
npm run db:migrate:status   # confirm which are pending
npm run db:migrate
```

### Step 3 — Produce ONE reconciliation migration for the 107

```bash
DATABASE_URL=… npm run db:generate
```

Then, before committing:

1. **Rename** the generated file to the next free prefix — `0057_…`, not the `0040_…` drizzle
   picks — and update its `tag` in `meta/_journal.json` to match. The migrator resolves files by
   `${entry.tag}.sql`, and tracks applied state by **sha256 of file content**, so renaming is safe
   as long as the SQL is untouched.
2. **Make every statement idempotent.** drizzle-kit emits bare `CREATE TABLE`. Convert to
   `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. Without
   this, Step 4 cannot be safe in environments where some tables already exist.
3. **Review it against Step 1's output.** Tables that already exist must be no-ops; tables that do
   not must be created.

### Step 4 — Baseline environments that already have the objects

```bash
npm run db:migrate:baseline
```

This stamps the migration as applied **without executing it**. SUPA-002 fixed two real bugs in
this path — it used to write to an unqualified `__drizzle_migrations` (resolving to `public.*`,
which drizzle never reads) and stamped `created_at = Date.now()`, which would permanently skip
every later migration. Both are fixed; verify you are on that version.

### Step 5 — Prove it

The pass/fail test, and the reason this is worth doing:

```bash
# With NO schema change:
DATABASE_URL=… npm run db:generate
# MUST produce an empty migration.

# Then add one nullable column and re-run:
# MUST produce a migration containing only that column.
```

Then drop `SNAPSHOT_GAP_BASELINE` to `0` in `scripts/check-migration-journal.mjs` to lock it in.

---

## What is already committed

- `scripts/check-migration-journal.mjs` gained check `(e)`: every journal entry must have a
  snapshot. It is a **ratchet** at the current gap of 25, not a hard gate — failing outright would
  break CI on a pre-existing condition. It fails only if the gap widens.
- This document.

No schema or migration files were changed. The generated drift migration was inspected and
discarded; the tree is exactly as it was.
