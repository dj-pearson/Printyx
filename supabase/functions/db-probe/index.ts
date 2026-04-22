/**
 * db-probe — Phase 1 proof-of-life edge function.
 *
 * Exercises every shared utility so Phase 1 lands atomically:
 *   - _shared/db.ts          (Drizzle + postgres-js)
 *   - _shared/auth.ts        (JWT + tenant resolution)
 *   - _shared/http.ts        (jsonResponse / errorResponse)
 *   - _shared/logger.ts      (structured JSON logs)
 *   - _shared/cors.ts        (existing, unchanged)
 *
 * Responses:
 *   - Unauthenticated → 401 with structured error
 *   - Authenticated no tenant → 403
 *   - Authenticated + tenant → 200 with { status, tenantCount, rlsEnabled, durationMs, requestId }
 *
 * The tenant count is returned unfiltered (all tenants). If you want to test RLS,
 * use the outreach function instead — this one uses the service-role client.
 */

import { sql } from 'https://esm.sh/drizzle-orm@0.29.4';
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, jsonResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('db-probe');

export default async function handler(req: Request): Promise<Response> {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const t0 = Date.now();
  const url = new URL(req.url);

  log.info({ requestId, method: req.method, path: url.pathname }, 'request_received');

  try {
    const ctx = await requireAuth(req, {
      log: (level, msg, extra) => log[level]({ requestId, ...extra }, msg),
    });

    const scoped = log.child({
      requestId,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    });

    const db = getDb();

    // 1. Can we reach the DB?
    const pingRows = await db.execute<{ now: string }>(sql`SELECT NOW() as now`);
    const dbNow = pingRows?.[0]?.now;

    // 2. Can we count tenants?
    const tenantRows = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM tenants`,
    );
    const tenantCount = parseInt(tenantRows?.[0]?.count ?? '0', 10);

    // 3. Which outreach tables have RLS enabled? (helps verify US-003 landed)
    const rlsRows = await db.execute<{ tablename: string; rowsecurity: boolean }>(sql`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'business_contexts',
          'rep_specializations',
          'outreach_sequences',
          'outreach_sequence_steps',
          'outreach_prospects',
          'outreach_drafts'
        )
    `);
    const rlsEnabled: Record<string, boolean> = {};
    for (const row of rlsRows ?? []) {
      rlsEnabled[row.tablename] = !!row.rowsecurity;
    }

    const durationMs = Date.now() - t0;
    scoped.info({ durationMs, tenantCount }, 'probe_success');

    return jsonResponse(
      {
        status: 'ok',
        dbNow,
        tenantCount,
        rlsEnabled,
        authenticated: {
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          email: ctx.email,
        },
        durationMs,
        requestId,
      },
      200,
      req,
      requestId,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn({ requestId, status: err.status, code: err.code, msg: err.message }, 'auth_failed');
      return errorResponse(err.status, err.message, req, {
        code: err.code,
        details: err.details,
        requestId,
      });
    }

    const error = err as Error;
    log.error({ requestId, err: error.message, stack: error.stack }, 'probe_failed');
    // db-probe is a diagnostic endpoint — surface the actual error so we can
    // diagnose without spelunking Coolify logs.
    return errorResponse(500, 'Probe failed: ' + (error.message || 'unknown error'), req, {
      code: 'PROBE_ERROR',
      details: {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack?.split('\n').slice(0, 10),
      },
      requestId,
    });
  } finally {
    log.info({ requestId, durationMs: Date.now() - t0 }, 'request_complete');
  }
}
