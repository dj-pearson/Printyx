# Shared utilities for edge functions

Drop-in modules every edge function should use. All are Deno-compatible and require no build step.

## Files

| File | Purpose | Added |
|---|---|---|
| `cors.ts` | CORS preflight + headers | pre-existing |
| `supabase.ts` | Supabase JS client factories (user-scoped + service-role) | pre-existing |
| `db.ts` | Drizzle + postgres-js client (`getDb()`) | Phase 1 |
| `auth.ts` | `requireAuth(req)` — JWT verify + tenant resolution | Phase 1 |
| `http.ts` | `jsonResponse`, `errorResponse`, `validateBody`, `validateQuery` | Phase 1 |
| `logger.ts` | `createLogger(module)` — structured JSON logs | Phase 1 |

## Canonical handler skeleton

Copy this into any new edge function:

```typescript
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, jsonResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

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

    // ...business logic...

    return jsonResponse({ ok: true }, 200, req, requestId);
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

## Environment variables consumed

| Var | Consumer | Purpose |
|---|---|---|
| `DATABASE_URL` | `db.ts` | Postgres connection string |
| `DB_SSL_REJECT_UNAUTHORIZED` | `db.ts` | Accept self-signed certs (set `false`) |
| `DB_POOL_MAX` | `db.ts` | Max pool per instance (default 2) |
| `SUPABASE_URL` | `auth.ts`, `supabase.ts` | Base URL of self-hosted Supabase |
| `SUPABASE_ANON_KEY` | `auth.ts` | For JWT verification via `auth.getUser()` |
| `SUPABASE_SERVICE_ROLE_KEY` | `auth.ts`, `supabase.ts` | Service-role client |
| `LOG_LEVEL` | `logger.ts` | `trace`/`debug`/`info`/`warn`/`error` (default info) |
| `ALLOWED_ORIGINS` | `cors.ts` | Comma-separated CORS allowlist |

## Verifying Phase 1 is live

Hit `https://functions.printyx.net/db-probe` after Coolify deploys:

- **No auth header** → 401 `{ message: "Authorization header missing or malformed", code: "missing_token", requestId: "..." }`
- **Valid JWT with tenant** → 200 `{ status: "ok", dbNow, tenantCount, rlsEnabled, authenticated: { userId, tenantId, email }, durationMs, requestId }`

`rlsEnabled` object should show `true` for every outreach table if `drizzle/rls/outreach.sql` has been applied.

## Gotchas

1. **Pooler in transaction mode** — Supabase's pooler defaults to transaction mode, which breaks prepared statements. `db.ts` sets `prepare: false` on the postgres client to compensate. If you switch to session mode, you can remove that.
2. **Service-role client bypasses RLS** — `supabase.ts`'s `createSupabaseServiceClient()` and `db.ts`'s `getDb()` both operate as superuser. RLS is enforced when the frontend hits PostgREST directly with a user JWT, or when you explicitly switch roles inside a function. Edge functions that filter by `tenantId` in code get defense-in-depth.
3. **JWT shape** — `auth.ts` expects `app_metadata.tenantId` on the token. If Supabase signs tokens without that claim, add a fallback chain (already implemented) but fix the auth hook that issues tokens so new signups get it.
