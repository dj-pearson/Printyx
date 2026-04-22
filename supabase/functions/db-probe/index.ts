/**
 * db-probe — Phase 1 proof-of-life edge function.
 *
 * Exercises every shared utility so Phase 1 lands atomically:
 *   - _shared/db.ts          (Supabase JS client via PostgREST)
 *   - _shared/auth.ts        (JWT + tenant resolution)
 *   - _shared/http.ts        (jsonResponse / errorResponse)
 *   - _shared/logger.ts      (structured JSON logs)
 *   - _shared/cors.ts        (existing, unchanged)
 *
 * Responses:
 *   - Unauthenticated → 401 with structured error
 *   - Authenticated no tenant → 403
 *   - Authenticated + tenant → 200 with { status, tenantCount, outreachReachable, durationMs, requestId }
 *
 * This version uses the Supabase JS client (via PostgREST over HTTPS) instead of
 * direct Postgres. Supavisor's pooler has a non-standard SSL handshake that
 * crashes Deno's postgres-js; PostgREST is what the rest of the codebase uses
 * and works reliably.
 */

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

    // 1. Can we reach PostgREST at all? Count all tenants (service-role, bypasses RLS).
    const tenantsQuery = await db.from('tenants').select('*', { count: 'exact', head: true });

    if (tenantsQuery.error) {
      scoped.error(
        { err: tenantsQuery.error.message, code: tenantsQuery.error.code },
        'tenants_query_failed',
      );
      return errorResponse(500, 'DB query failed: ' + tenantsQuery.error.message, req, {
        code: 'DB_QUERY_ERROR',
        details: {
          pgCode: tenantsQuery.error.code,
          pgHint: tenantsQuery.error.hint,
          pgDetails: tenantsQuery.error.details,
        },
        requestId,
      });
    }

    // 2. Can we query an outreach table scoped to this tenant? Confirms migration ran.
    const contextsQuery = await db
      .from('business_contexts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId);

    const outreachTables = {
      business_contexts: !contextsQuery.error,
    };

    // 3. Count sequences + drafts for this tenant — proves the rest of the
    //    outreach migration landed and RLS (if enabled) lets us through.
    const sequencesQuery = await db
      .from('outreach_sequences')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId);
    outreachTables['outreach_sequences'] = !sequencesQuery.error;

    const draftsQuery = await db
      .from('outreach_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId);
    outreachTables['outreach_drafts'] = !draftsQuery.error;

    const prospectsQuery = await db
      .from('outreach_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId);
    outreachTables['outreach_prospects'] = !prospectsQuery.error;

    const specializationsQuery = await db
      .from('rep_specializations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId);
    outreachTables['rep_specializations'] = !specializationsQuery.error;

    const stepsQuery = await db
      .from('outreach_sequence_steps')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId);
    outreachTables['outreach_sequence_steps'] = !stepsQuery.error;

    const durationMs = Date.now() - t0;
    scoped.info({ durationMs, tenantCount: tenantsQuery.count }, 'probe_success');

    return jsonResponse(
      {
        status: 'ok',
        tenantCount: tenantsQuery.count ?? 0,
        outreachTables,
        outreachCounts: {
          businessContexts: contextsQuery.count ?? 0,
          sequences: sequencesQuery.count ?? 0,
          drafts: draftsQuery.count ?? 0,
          prospects: prospectsQuery.count ?? 0,
          specializations: specializationsQuery.count ?? 0,
          sequenceSteps: stepsQuery.count ?? 0,
        },
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
