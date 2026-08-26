# Rebuilding the database from scratch

**PA-032.** How to bring up a Printyx database with no prior state — a new environment, a
restore target, or a disaster recovery drill.

`npm run db:migrate` is the only sanctioned way to do this. It was not, until 2026-08-26:
migration `0000` failed on foreign keys whose column types could not match their targets, and
because the migrator wraps the run in one transaction, it rolled back and created **nothing**.
Provisioning happened instead through `create-all-tables-from-drizzle.sh`, which ran
`drizzle-kit push` straight at the production container. That script is gone. `db:push` writes
whatever the schema currently says with no record of what changed, which is how the 107-table
drift COP-M00 had to reconcile got there in the first place.

---

## The drill

```bash
# 1. An empty database.
createdb printyx

# 2. Apply every migration in journal order.
DATABASE_URL=postgres://…/printyx npm run db:migrate

# 3. Confirm.
DATABASE_URL=postgres://…/printyx npm run db:migrate:status
```

Expect 43 migrations and 668 tables. `db:migrate` takes an advisory lock (`__migration_lock`,
auto-expiring after 5 minutes), so two of these cannot run at once.

Prefer a **direct** Postgres URL. `DATABASE_URL_MIGRATE` or `DIRECT_DATABASE_URL` override
`DATABASE_URL` for this command precisely because poolers (the `:5433` PgBouncer endpoint) reset
connections during DDL-heavy sessions.

### Then make it usable

The migrations create structure and no rows. A database with no tenant cannot be signed into.

```bash
psql "$DATABASE_URL" -c "insert into tenants (name, slug) values ('Acme Copiers','acme');"
psql "$DATABASE_URL" -c "insert into users (tenant_id, email, first_name, last_name)
  values ((select id from tenants where slug='acme'),'you@example.com','Your','Name');"

DEMO_USER=you@example.com npm run db:migrate  # no-op, confirms the ledger
DEMO_USER=you@example.com npm run seed:demo   # optional: demo fixtures
npm run seed:rbac                             # roles and permissions
```

Two things the seeder will not tell you. It refuses to run twice for the same tenant
("Demo data already exists"). And its ids are tenant-independent (`stage-demo-001`) under
`onConflictDoNothing`, so seeding a **second** tenant into the same database reports success and
writes nothing — use a fresh database per seeded tenant.

### Verify before declaring the drill passed

```bash
npm run check:migrations                     # journal, prefixes, head snapshot
DATABASE_URL=… npm run check:stage-resolution # every deal resolves to one canonical stage
```

`check:stage-resolution` exits **2** when it cannot connect, so a failed drill never looks like a
passed one.

---

## Restoring from a backup instead

`npm run db:restore` is the path when you have a dump; it asks for confirmation twice against
production and honours `RESTORE_TARGET_DB`. Backups land in GCS as
`printyx-backup-YYYY-MM-DD-HHmmss.sql.gz` (daily 7d / weekly 4w / monthly 12m), written by the
`k8s/base/cronjob-backup.yaml` CronJob at 02:00 UTC.

A restore reproduces the database as it was, drift included. The migration path reproduces the
database the code expects. When they disagree, the disagreement is the finding.

---

## What was wrong, and why it is worth knowing

Thirty statements across four migrations could never execute. They are corrected in place rather
than in a follow-up, because a migration that has never run anywhere has no history to preserve —
the drizzle migrator skips by `created_at` against `folderMillis`, never by content hash, so
editing an applied migration cannot cause a re-run on an existing database.

- **`0000` (15).** Foreign keys between columns whose types could not match: `uuid` columns
  pointing at the `varchar` `tenants.id`/`users.id` across `api_keys`, `api_key_usage_logs`,
  `api_key_rotations` and the four `sso_*` tables, plus two in the other direction
  (`customer_maintenance_appointments.portal_user_id`,
  `technician_availability_slots.appointment_id` against `uuid` primary keys). Postgres rejects
  these outright, so none of the constraints has ever existed in any environment. The schema
  files were wrong, not the migration; both are corrected, and `0059_pa032_fk_column_types.sql`
  brings an existing database to the same shape.
- **`0001` (4).** `SET DATA TYPE serial` — `serial` is not a type, it is shorthand for an integer
  plus a sequence — and a `tenant_id` to `integer` cast with no `USING`. Both also contradicted
  the schema, which has those columns as `uuid`. Removed. Separately, an enum rewrite failed
  because column **defaults** keep depending on the enum after the column is switched to text;
  drizzle-kit does not emit the `DROP DEFAULT`s that makes `DROP TYPE` possible.
- **`0002` (10).** The same enum-default problem twice more, a `jsonb` to `text[]` cast with no
  `USING` (and its `DROP DEFAULT` emitted _after_ the cast rather than before), an `id` to `uuid`
  cast contradicting the schema, and two `DROP TYPE`s for enums the schema still uses.
- **`0043` (1).** A unique index on `proposal_templates.template_type`, a column that does not
  exist on a database built from these migrations. `proposal_templates` is declared **twice** with
  different shapes — `shared/quote-proposal-schema.ts` has `template_type`,
  `shared/schema.ts` has `category` — and the migrations build the second. Now guarded on the
  column, matching that file's own drift tolerance.

Two contradictions surfaced that this work did **not** resolve, because they are schema decisions
rather than migration repairs:

- `alert_severity` and `alert_status` are each declared twice with different members
  (`shared/team-alerts-schema.ts` vs `shared/intelligent-alerts-schema.ts`; the barrel skips the
  first). `alert_instances` defaults to `'warning'`/`'active'`, which are not members of the enums
  the migrations create, so those two defaults are dropped and not restored. Both columns are
  `NOT NULL`, so an insert omitting them now fails rather than storing a value outside the enum.
- `proposal_templates`, above.
