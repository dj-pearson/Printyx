/**
 * Leases edge function (canonical).
 *
 * Replaces server/routes/lease-routes.ts (28 endpoints) and retires Node-only
 * PDF services (pdfkit, puppeteer+handlebars) in favor of `_pdf.ts` which uses
 * pdf-lib via esm.sh per the Phase 4 leases PRD decision.
 *
 * URL prefixes handled:
 *   /leases/*                      → handlers/leases.ts (core CRUD + nested)
 *   /lease-payments/*              → handlers/payments.ts
 *   /lease-renewals/*              → handlers/renewals.ts
 *   /lease-dispositions/*          → handlers/dispositions.ts
 *
 * The last three reach this fn only via the AUDIT-012 aliases in server.ts,
 * which deliberately do NOT strip their segment (it is our discriminator).
 *
 * NOTE (AUDIT-012): a `/customers/:customerId/leases` arm used to live here, but
 * it was unreachable — server.ts resolves segment 0, and a real `customers/`
 * function dir exists, so that path never arrives here. It was removed rather
 * than left as dead code. handlers/leases.ts still implements the 'by-customer'
 * route; if that surface is ever needed, forward to it from the `customers` fn.
 *
 * One-time SQL:
 *   \i drizzle/rls/leases-tables.sql
 *   \i drizzle/rls/leases.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { normalizePath } from '../_shared/path.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleLeases } from './handlers/leases.ts';
import { handlePayments } from './handlers/payments.ts';
import { handleRenewals } from './handlers/renewals.ts';
import { handleDispositions } from './handlers/dispositions.ts';

const log = createLogger('leases');

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    // AUDIT-012: server.ts strips the matched function-name segment before
    // invoking us, so this must NOT assume 'leases' is still at parts[0] — it
    // hand-rolled a raw split and switched on parts[0], which meant EVERY prod
    // request fell through to `default` and 404'd. normalizePath is idempotent
    // (it only strips a LEADING '/leases'), so it yields the same flat shape
    // whether or not the segment survived:
    //   /leases/:id  or  /:id            -> parts = [':id']
    // The three sibling prefixes are aliased to this fn by server.ts WITHOUT the
    // strip (stripSegments = 0), so they keep their discriminator at parts[0]:
    //   /lease-payments/:id/process      -> parts = ['lease-payments', ':id', 'process']
    const { parts } = normalizePath(url.pathname, 'leases');

    const ctx = { auth, db, requestId, pathParts: parts, method, url };

    let result: Response | null = null;
    switch (parts[0]) {
      case 'lease-payments':
        result = await handlePayments(req, { ...ctx, pathParts: parts.slice(1) });
        break;
      case 'lease-renewals':
        result = await handleRenewals(req, { ...ctx, pathParts: parts.slice(1) });
        break;
      case 'lease-dispositions':
        result = await handleDispositions(req, { ...ctx, pathParts: parts.slice(1) });
        break;
      default:
        // Core lease CRUD + nested routes, on the flat shape the handler already
        // expects: [] | [id] | [id, 'payments'] | [id, 'initiate-renewal'] | ...
        result = await handleLeases(req, ctx);
    }

    if (!result) {
      return errorResponse(404, 'Not found', req, {
        code: 'NOT_FOUND',
        details: { path: url.pathname, method },
        requestId,
      });
    }
    return result;
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}
