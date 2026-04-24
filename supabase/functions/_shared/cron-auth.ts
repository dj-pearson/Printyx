/**
 * Internal cron auth — validates pg_cron invocations of edge function
 * endpoints.
 *
 * Cron jobs defined in drizzle/cron/*.sql call edge functions via
 * pg_net.http_post with an Authorization: Bearer header set to the
 * `app.internal_cron_token` Postgres runtime setting. Edge functions on the
 * receiving end (e.g. /customer-success/health-scores/recalc) use this
 * helper to verify the call came from our own scheduler rather than a
 * random caller.
 *
 * The helper is deliberately SEPARATE from requireAuth — cron calls don't
 * carry a user JWT, and they shouldn't. Instead they carry the cron token
 * and an X-Cron-Job header naming the schedule. Handlers that support both
 * modes (e.g. "admin can force-run via Bearer JWT, pg_cron can also hit it")
 * should try requireAuth first and fall back to isCronRequest on AuthError.
 *
 * Required env var: INTERNAL_CRON_TOKEN (must match the value of the
 * `app.internal_cron_token` Postgres setting).
 */

import { createLogger } from './logger.ts';

const log = createLogger('cron-auth');

export class CronAuthError extends Error {
  constructor(public reason: 'missing_token' | 'token_mismatch' | 'not_configured') {
    super(`Cron auth failed: ${reason}`);
    this.name = 'CronAuthError';
  }
}

/**
 * Constant-time comparison of two strings. Mirrors the pattern used by
 * api-keys/_compare from Phase 5 US-021.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Returns true when the request carries a valid internal cron token.
 * Returns false for any other case (missing header, wrong token, unset env).
 * Use this when your endpoint wants to support BOTH user JWT and cron token
 * callers — check isCronRequest first, then fall through to requireAuth.
 */
export function isCronRequest(req: Request): boolean {
  const expected = (() => {
    try {
      return Deno.env.get('INTERNAL_CRON_TOKEN') ?? null;
    } catch {
      return null;
    }
  })();

  if (!expected) return false;
  const provided = extractBearer(req);
  if (!provided) return false;
  return constantTimeEqual(provided, expected);
}

/**
 * Strict variant — throws CronAuthError if the request is not a valid cron
 * invocation. For endpoints that are CRON-ONLY (never called by users).
 */
export function requireCronAuth(req: Request): void {
  const expected = (() => {
    try {
      return Deno.env.get('INTERNAL_CRON_TOKEN') ?? null;
    } catch {
      return null;
    }
  })();

  if (!expected) {
    log.error({}, 'INTERNAL_CRON_TOKEN env var is unset — cron endpoints will always reject');
    throw new CronAuthError('not_configured');
  }

  const provided = extractBearer(req);
  if (!provided) throw new CronAuthError('missing_token');
  if (!constantTimeEqual(provided, expected)) {
    log.warn({ job: req.headers.get('X-Cron-Job') ?? 'unknown' }, 'cron_token_mismatch');
    throw new CronAuthError('token_mismatch');
  }

  log.info({ job: req.headers.get('X-Cron-Job') ?? 'unknown' }, 'cron_request_authorized');
}
