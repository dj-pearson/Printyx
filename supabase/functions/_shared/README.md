# Shared utilities for edge functions

Drop-in modules every edge function should use. All are Deno-compatible and require no build step.

## Files

| File | Purpose | Added |
|---|---|---|
| `cors.ts` | CORS preflight + headers | pre-existing |
| `supabase.ts` | Supabase JS client factories (user-scoped + service-role) — low-level | pre-existing |
| `db.ts` | Canonical DB client for new handlers (`getDb()` — service-role, `getUserDb(jwt)` — RLS-scoped) | Phase 1 |
| `auth.ts` | `requireAuth(req)` — JWT verify + tenant resolution | Phase 1 |
| `http.ts` | `jsonResponse`, `errorResponse`, `validateBody`, `validateQuery` | Phase 1 |
| `logger.ts` | `createLogger(module)` — structured JSON logs | Phase 1 |

## DB access pattern

**All new edge functions use `db.ts`** (which wraps `@supabase/supabase-js` via PostgREST over HTTPS). This is the proven working path on our self-hosted Supabase + Coolify + Deno stack.

**Drizzle schemas** (`shared/**/*-schema.ts`) remain the single source of truth for table structure and TypeScript types. Import them **type-only** into edge functions:

```typescript
import type { OutreachSequence } from '../../../shared/outreach-schema.ts';
```

and cast query results:

```typescript
const { data } = await db.from('outreach_sequences').select('*');
return jsonResponse({ sequences: data as OutreachSequence[] }, 200, req);
```

### Why not Drizzle query builder in Deno?

We tried. `drizzle-orm/postgres-js` + `postgres@3.x` crashes on our Supavisor pooler because the pooler's SSL handshake returns a non-standard byte that postgres-js can't parse. Node's `pg` library handles it; Deno-native clients don't. Rather than upgrade Deno (risk of breaking 184 existing edge functions) or hack the protocol, we use Supabase JS client which goes over HTTPS through PostgREST at `api.printyx.net`. Revisit when Deno is safe to upgrade.

## Canonical handler skeleton

Copy this into any new edge function:

```typescript
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, jsonResponse, generateRequestId, validateBody } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import type { OutreachSequence } from '../../../shared/outreach-schema.ts';

const log = createLogger('my-domain');

export default async function handler(req: Request): Promise<Response> {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const t0 = Date.now();

  try {
    const ctx = await requireAuth(req);
    const scoped = log.child({ requestId, userId: ctx.userId, tenantId: ctx.tenantId });
    const db = getDb();

    // Example: list resources scoped to the authenticated tenant
    const { data, error } = await db
      .from('outreach_sequences')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .order('updated_at', { ascending: false });

    if (error) {
      scoped.error({ err: error.message, code: error.code }, 'query_failed');
      return errorResponse(500, error.message, req, { code: 'DB_ERROR', requestId });
    }

    return jsonResponse({ sequences: data as OutreachSequence[] }, 200, req, requestId);
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code,
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'handler_failed');
    return errorResponse(500, 'Internal server error', req, { code: 'INTERNAL', requestId });
  } finally {
    log.info({ requestId, durationMs: Date.now() - t0 }, 'request_complete');
  }
}
```

The `server.ts` router strips the function-name prefix before calling `handler`, so inside the handler `new URL(req.url).pathname` already starts at your domain's resource path.

## Tenant isolation

**Always filter by `tenant_id` in application code** — every query, every `.eq('tenant_id', ctx.tenantId)`. RLS is defense-in-depth (enabled per `drizzle/rls/*.sql`), not your primary mechanism, because the service-role client in `getDb()` **bypasses RLS**.

If you want RLS enforcement too, use `getUserDb(ctx.jwt)` instead — passes the user's JWT and policies apply. Trade-off: it's a per-request client (not cached), slightly higher latency, but any forgotten `tenant_id` filter is caught by RLS.

| Client | Use when | RLS applies | Cached |
|---|---|---|---|
| `getDb()` | Most handlers — server-side, trusted | No | Yes |
| `getUserDb(ctx.jwt)` | Belt-and-suspenders tenant safety | Yes | No |

## Environment variables consumed

| Var | Consumer | Purpose |
|---|---|---|
| `SUPABASE_URL` | `db.ts`, `auth.ts`, `supabase.ts` | Base URL of self-hosted Supabase (`https://api.printyx.net`) |
| `SUPABASE_ANON_KEY` | `db.ts` (user client), `auth.ts` | Anon key for JWT verification + user-scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | `db.ts` (service client) | Service role key for bypass-RLS queries |
| `LOG_LEVEL` | `logger.ts` | `trace`/`debug`/`info`/`warn`/`error` (default `info`) |
| `ALLOWED_ORIGINS` | `cors.ts` | Comma-separated CORS allowlist |

**Note**: `DATABASE_URL` is no longer required — we no longer connect directly to Postgres from edge functions. If you see a handler trying to read it, that's legacy and should be refactored.

## Verifying Phase 1 is live

Hit `https://functions.printyx.net/db-probe` after deploy:

- **No auth header** → 401 `{ message: "Authorization header missing...", code: "missing_token", ... }`
- **Valid JWT with tenant** → 200 with tenant count, outreach table reachability, and authenticated context

## Gotchas

1. **Import schemas type-only** — `import type { Foo } from '../../../shared/...-schema.ts'`. If you drop `type`, Deno tries to import the Drizzle runtime which may pull in Node-only deps.
2. **No transactions in Supabase JS client** — if you need atomic multi-statement operations, create a Postgres function and call `db.rpc('function_name', args)`. Transactions across PostgREST requests don't exist.
3. **Service-role bypasses RLS** — never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. Only edge functions and the Express server (when it existed) should have it.
4. **`.select('*', { count: 'exact', head: true })`** returns only the count, no rows — use this for counts to avoid transferring unnecessary data.
