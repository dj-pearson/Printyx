# Postgres Functions

SQL-level functions applied outside the Drizzle migration flow. These are
idempotent (`CREATE OR REPLACE FUNCTION`) so you can re-run any file after
making changes.

## Applying

From `psql` (or the Supabase SQL editor) connected to the target database:

```sql
\i drizzle/functions/dashboard-widget-data.sql
```

Or via any SQL runner pointed at `DATABASE_URL`.

## Files

| File | Purpose | Consumed by |
|---|---|---|
| `dashboard-widget-data.sql` | `dashboard_widget_data(widget_key, tenant_id, user_id, role_code, level)` — returns JSONB for one of 34 dashboard widgets. Tenant-scoped by explicit parameter. | `supabase/functions/dashboard-widgets/` |

## Why not in `drizzle/migrations/`

Drizzle-kit-generated migrations ship with a `meta/*_snapshot.json` that tracks
the schema state. Hand-written SQL (functions, triggers, RLS policies) doesn't
have a corresponding schema delta, so `drizzle-kit generate` won't pick it up,
and the migrator may choke on orphaned SQL files. Putting these in a sibling
directory keeps the two flows independent.

Related: `drizzle/rls/` follows the same pattern for RLS policies.
