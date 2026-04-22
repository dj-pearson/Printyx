# RLS Policies

Row-Level Security policies for Printyx's multi-tenant tables. RLS is the **primary** tenant-isolation mechanism once the Edge Functions migration is complete; application-layer `where(tenantId = ...)` filters remain as defense-in-depth.

## Files

- **`_template.sql`** — reference documentation of the canonical 4-policy pattern. Not applied directly.
- **`apply-rls.sql`** — defines the `apply_tenant_rls(table_name)` Postgres function. Run once per database; it creates the helper function that the per-domain files call.
- **`<domain>.sql`** — per-domain files that apply RLS to that domain's tables. Idempotent — safe to re-run.
  - `outreach.sql`

## One-time setup (per database)

```bash
# Connect via your preferred client
psql "$DATABASE_URL" -f drizzle/rls/apply-rls.sql
```

That installs the `apply_tenant_rls()` function. You only need to do this once.

## Per-domain apply

```bash
psql "$DATABASE_URL" -f drizzle/rls/outreach.sql
```

The function is idempotent — it drops existing policies with matching names before creating, so you can re-run this any time (after a schema change, for example).

## Canonical JWT shape

The policies expect Supabase to issue JWTs with this claim structure:

```json
{
  "aud": "authenticated",
  "sub": "<userId>",
  "email": "...",
  "app_metadata": {
    "tenantId": "<tenantId>",
    "provider": "email"
  },
  "user_metadata": { ... }
}
```

The policy expression `auth.jwt() -> 'app_metadata' ->> 'tenantId'` extracts the `tenantId` string. `auth.jwt()` is a Supabase-provided function present in self-hosted installations by default.

## Policy pattern (per table)

4 policies per table — SELECT, INSERT, UPDATE, DELETE — all scoped to `TO authenticated` and all checking `tenant_id = jwt_tenant`.

UPDATE uses both `USING` (can see the row) and `WITH CHECK` (can't re-parent to another tenant).

See `_template.sql` for the raw SQL equivalent.

## Gotcha: GRANT is required in addition to the policy

Self-hosted Supabase + PostgREST requires BOTH:

1. `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated`
2. The policy

If you only add the policy, you'll get `403 Forbidden` even for rows your JWT should be allowed to see — because the `authenticated` role has no table-level permission at all. `apply_tenant_rls()` handles both.

## Adding RLS to a new table

1. Ensure the table has a NOT NULL `tenant_id` text column.
2. Either add a `SELECT apply_tenant_rls('<new_table>');` line to the appropriate domain file, or create a new domain file.
3. Run it: `psql "$DATABASE_URL" -f drizzle/rls/<file>.sql`

That's it.

## Verification

To confirm RLS is actually enabled on every expected table:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Anything with `rowsecurity = f` that should be tenant-scoped is a bug.

To confirm the policies work, impersonate an authenticated role with a test JWT and attempt a cross-tenant read:

```sql
-- As tenant A's JWT: should return rows
SET ROLE authenticated;
SET request.jwt.claims = '{"app_metadata":{"tenantId":"tenant-a"}}'::text;
SELECT count(*) FROM outreach_sequences;

-- Switch to tenant B: should return 0 rows (or only tenant B's rows)
SET request.jwt.claims = '{"app_metadata":{"tenantId":"tenant-b"}}'::text;
SELECT count(*) FROM outreach_sequences;

-- Cleanup
RESET ROLE;
RESET request.jwt.claims;
```

## Emergency break-glass

If a policy misconfiguration locks out a production tenant:

```sql
ALTER TABLE <table_name> DISABLE ROW LEVEL SECURITY;
```

This is a production incident, not a regular operation. Re-enable and fix the policy ASAP.

## Why not just use application-level filters?

We did, and it almost bit us. One missing `where(tenantId = ctx.tenantId)` in any of 850+ handlers = cross-tenant data leak. RLS enforces isolation in the database, so even buggy application code can't leak.

Application filters remain (belt + suspenders), but the database is the source of truth for tenancy boundaries.
