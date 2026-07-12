# Legacy ad-hoc SQL (archive)

These files are **un-versioned, one-off SQL patches** that were applied by hand
during the Neon → self-hosted-Supabase migration. They are **not** part of the
migration chain and must not be treated as the schema source of truth.

They were moved here from the repo root (PA-033) so that:

- the repo root is no longer cluttered with ad-hoc scripts that obscure the real
  workflow (`drizzle/migrations/` + `npm run db:migrate`);
- a CI guard (`npm run check:datadumps` → `scripts/check-no-root-sql.mjs`) can
  forbid new `*.sql` files at the repo root;
- the historical record of what was patched by hand is preserved rather than
  deleted (we can't verify from the repo which of these were actually applied to
  production).

## Do not run these

Anything worth keeping must be folded into a real numbered migration under
`drizzle/migrations/` (generate with `npm run db:generate`, review, apply with
`npm run db:migrate`). Reconciling each of these into a migration — or confirming
it is already covered and deleting it — is the remaining half of PA-033 and needs
a database to diff against.

RLS setup lives in `drizzle/rls/` (apply with `npm run db:rls`), not here.
