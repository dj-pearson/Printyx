/**
 * Persona Reports edge function — persona-based routing for the 10 role-level
 * reporting APIs from server/routes/*-reports-api.ts.
 *
 * Named `persona-reports/` (not `reports/`) to avoid conflict with the
 * existing `reports/` function, which handles generic analytics endpoints
 * like /reports/executive-summary.
 *
 * Initial port:
 *   /persona-reports/director/*   — 3 endpoints fully ported + RPC-backed
 *
 * The remaining 9 personas (executive, sales, sales-manager, sales-supervisor,
 * service, service-manager, service-supervisor, team, warehouse) and the
 * generic reporting engine return 501 with pointers to the Express source
 * file. Full tracking lives in tasks/followup-reports-migration.md.
 *
 * Report queries live in Postgres as PL/pgSQL functions (drizzle/reports/*.sql)
 * and are called via supabase.rpc(). This keeps the complex SQL in one place
 * (easy to test with psql) and avoids Drizzle-in-Deno limitations.
 *
 * One-time SQL:
 *   \i drizzle/reports/director.sql
 *   # More files land per the followup plan.
 *
 * Frontend note: the Express version mounts each persona at its own path
 * (e.g. /api/director-reports/*). Migrating to this function means the
 * frontend calls /api/persona-reports/director/* instead. Either update
 * the frontend or add a router rewrite — tracked in the followup doc.
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleDirector } from './handlers/director.ts';
import { handleWarehouse } from './handlers/warehouse.ts';
import { handleExecutive } from './handlers/executive.ts';

const log = createLogger('persona-reports');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/persona-reports(?=\/|$)/, '')
      .replace(/\/$/, '') || '/'
  );
}

// Personas not yet ported — endpoint returns 501 with source-file pointer.
// Remove entries as each persona's handler lands.
const PENDING_PERSONAS: Record<string, { sourceFile: string; endpoints: number }> = {
  // executive is ported below; intentionally omitted from PENDING_PERSONAS.
  sales: { sourceFile: 'server/routes/sales-reports-api.ts', endpoints: 10 },
  'sales-manager': {
    sourceFile: 'server/routes/sales-manager-reports-api.ts',
    endpoints: 6,
  },
  'sales-supervisor': {
    sourceFile: 'server/routes/sales-supervisor-reports-api.ts',
    endpoints: 6,
  },
  service: { sourceFile: 'server/routes/service-reports-api.ts', endpoints: 8 },
  'service-manager': {
    sourceFile: 'server/routes/service-manager-reports-api.ts',
    endpoints: 6,
  },
  'service-supervisor': {
    sourceFile: 'server/routes/service-supervisor-reports-api.ts',
    endpoints: 6,
  },
  team: { sourceFile: 'server/routes/team-reports-api.ts', endpoints: 8 },
  // warehouse is ported below; intentionally omitted from PENDING_PERSONAS.
};

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

    const rest = stripPrefix(url.pathname);
    const pathParts = rest.split('/').filter(Boolean);
    const ctx = { auth, db, requestId, pathParts, method, url };

    const persona = pathParts[0];

    let result: Response | null = null;
    if (persona === 'director') {
      result = await handleDirector(req, ctx);
    } else if (persona === 'warehouse') {
      result = await handleWarehouse(req, ctx);
    } else if (persona === 'executive') {
      result = await handleExecutive(req, ctx);
    } else if (persona && PENDING_PERSONAS[persona]) {
      const info = PENDING_PERSONAS[persona];
      return jsonResponse(
        {
          status: 'not_implemented',
          persona,
          message: `/persona-reports/${persona}/* endpoints are pending port`,
          source: info.sourceFile,
          endpointCount: info.endpoints,
          trackedIn: 'tasks/followup-reports-migration.md',
        },
        501,
        req,
        requestId,
      );
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
