# Reconciling `companies` into `business_records` (COP-B00)

## What is actually wrong

`docs/crm-canonical-model.md` settled that `business_records` is the company of
record. Nothing carried it out, so both tables have been filling up in parallel
ever since — and the split is lopsided:

- **53 edge functions read `business_records`.**
- **7 touch `companies`**, and three of those **write** it:
  `business-records`, `companies`, `import`.

The `business-records` function is the one behind the production CRM account
list, and its own header calls itself "a backwards-compatible wrapper that
delegates to the companies table". So an account created through that list lands
where the opportunity radar, churn risk, QBR, contracts, invoices, service,
search, the forecast and 45 other functions never look.

This is not the dev-versus-prod disagreement the story was filed as. It is the
rest of the product not seeing the accounts the CRM creates.

## Why the readers cannot just be repointed

COP-B00's note has the order right: repointing `business-records` at
`business_records` before the rows move makes every account that currently lives
only in `companies` **disappear from the CRM**, with nothing logged. The rows
have to move first.

## The three steps, in order

### 1. Report (no credentials beyond a read-only URL)

```
DATABASE_URL=postgres://... npm run crm:reconcile
DATABASE_URL=postgres://... npm run crm:reconcile -- --tenant <id> --json
```

Prints per-tenant counts and classifies every `companies` row:

| verdict                     | meaning                                                         | what happens                              |
| --------------------------- | --------------------------------------------------------------- | ----------------------------------------- |
| `already-migrated`          | an `id` present in both tables                                  | skipped                                   |
| `duplicate-customer-number` | `customer_number` held by a different `business_records` row    | **reported, never merged**                |
| `candidate-name-match`      | same normalised name in the same tenant                         | **reported, never merged**                |
| `no-created-by`             | `business_records.created_by` is NOT NULL and this row has none | **refused, never given a sentinel owner** |
| `migratable`                | none of the above                                               | copied by `--apply`                       |

Exit 0 when nothing needs a person, 1 when something does, **2 when it could not
connect** — so "did not run" is never read as "passed".

### 2. Resolve what the report refuses, then copy

A name match is a _candidate_. COP-B10 and COP-B09 both record what it costs to
let a migration decide, unreviewed, that two spellings are one thing: the
original is gone if it decided wrong. Here the same guess fuses two customer
accounts. So those rows wait for a person, who either merges them by hand or
gives one of them a distinguishing name and re-runs.

```
DATABASE_URL=postgres://... npm run crm:reconcile -- --apply
```

**The id is preserved.** `deals`, `proposals` and `quotes` all carry an account
id; copying under a fresh uuid would orphan every one of those references the
moment the readers switch. Preserving it also makes the copy idempotent for
nothing — a re-run is an `id` conflict, which is verdict 1.

Two values are written rather than defaulted, and both are deliberate:

- `source` is `'migrated'`. The column is NOT NULL defaulting to `'website'`,
  which would claim every migrated account came in through the web form.
- `status` comes from `companies.activity` when that word is in the
  `business_records` vocabulary for the row's record type, and otherwise falls
  back to the type default **and is counted in the report**. A coercion nobody
  can see is how a status column stops meaning anything.

Columns `business_records` has and `companies` does not are left alone. A
migrated row is honestly sparse rather than confidently wrong.

### 3. Repoint the readers and retire the wrapper

Only after step 2 reports `migratable: 0` for every tenant. `business-records`
drops `mapCompanyToBusinessRecord` and reads `business_records` directly; the
`companies` writes in `companies/` and `import/` follow. That commit is what
unblocks COP-M01, COP-M03, COP-E03, COP-E04 and WF-S-01.

## What was proven, and where

Against a real PostgreSQL 16 with the full migration chain applied (682 tables),
seeded to hit every verdict including a same-name pair in two different tenants:

- each verdict fires on the row it should, and only that row;
- a cross-tenant name collision is **not** a match;
- `--apply` copies exactly the unambiguous rows, ids intact, and a second
  `--apply` copies nothing;
- exit codes 0 / 1 / 2 behave as documented.

`shared/company-to-business-record.ts` is the pure half, covered by 22 tests in
`server/tests/unit/company-to-business-record.test.ts` and mutation-tested on the
four properties that matter: stripping a legal suffix from the name key,
dropping the tenant from it, letting `source` fall back to the default, and
checking NOT NULL before the id. All four mutants fail the suite.

**Not proven:** nothing has run against the deployed database. The row counts,
the duplicate set and the coercion count are per-tenant facts this checkout
cannot know — step 1 is what produces them.
