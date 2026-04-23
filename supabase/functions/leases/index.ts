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
 *   /customers/:customerId/leases  → handlers/leases.ts
 *
 * One-time SQL:
 *   \i drizzle/rls/leases-tables.sql
 *   \i drizzle/rls/leases.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
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

    const pathParts = url.pathname.replace(/\/+/g, '/').split('/').filter(Boolean);
    const first = pathParts[0];

    const ctx = { auth, db, requestId, pathParts: pathParts.slice(1), method, url };

    let result: Response | null = null;
    switch (first) {
      case 'leases':
        result = await handleLeases(req, ctx);
        break;
      case 'lease-payments':
        result = await handlePayments(req, ctx);
        break;
      case 'lease-renewals':
        result = await handleRenewals(req, ctx);
        break;
      case 'lease-dispositions':
        result = await handleDispositions(req, ctx);
        break;
      case 'customers': {
        // /customers/:customerId/leases forward
        const customerId = pathParts[1];
        if (pathParts[2] === 'leases' && customerId) {
          const sub = { ...ctx, pathParts: ['by-customer', customerId] };
          result = await handleLeases(req, sub);
        } else {
          result = null;
        }
        break;
      }
      default:
        result = null;
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
