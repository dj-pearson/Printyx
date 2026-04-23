/**
 * Lead Assignment edge function (canonical).
 *
 * Consolidates 3 Express route files + 9 standalone edge functions into one
 * dispatcher. See `docs/lead-assignment-parity.md` for the full endpoint
 * matrix and PR 1/PR 2 deploy plan.
 *
 * URL prefixes handled (all frontend paths preserved):
 *
 *   /sales-territories/*             → handlers/territories.ts
 *   /territories/*                   → handlers/territories.ts (richer schema)
 *   /lead-assignment-rules/*         → handlers/rules.ts
 *   /rep-capacity/*                  → handlers/capacity.ts
 *   /lead-assignment-history/*       → handlers/history.ts
 *   /user-assignments/*              → handlers/history.ts (per-user view)
 *   /lead-assignment-queue/*         → handlers/queue.ts
 *   /assign-lead                     → handlers/assign.ts
 *   /auto-lead-routing/*             → handlers/routing.ts
 *
 * Once PR 2 ships, these 9 auxiliary edge functions get deleted:
 *   sales-territories, territories, lead-assignment-rules, rep-capacity,
 *   lead-assignment-history, user-assignments, lead-assignment-queue,
 *   assign-lead, auto-lead-routing.
 *
 * Required SQL before deploy (one-time):
 *   \i drizzle/functions/lead-assignment.sql
 *   \i drizzle/rls/lead-assignment.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleTerritories } from './handlers/territories.ts';
import { handleRules } from './handlers/rules.ts';
import { handleCapacity } from './handlers/capacity.ts';
import { handleHistory } from './handlers/history.ts';
import { handleQueue } from './handlers/queue.ts';
import { handleAssign } from './handlers/assign.ts';
import { handleRouting } from './handlers/routing.ts';

const log = createLogger('lead-assignment');

const PREFIX_MAP: Array<{ prefix: string; handler: string }> = [
  { prefix: '/sales-territories', handler: 'territories' },
  { prefix: '/territories', handler: 'territories' },
  { prefix: '/lead-assignment-rules', handler: 'rules' },
  { prefix: '/rep-capacity', handler: 'capacity' },
  { prefix: '/lead-assignment-history', handler: 'history' },
  { prefix: '/user-assignments', handler: 'history' },
  { prefix: '/lead-assignment-queue', handler: 'queue' },
  { prefix: '/assign-lead', handler: 'assign' },
  { prefix: '/auto-lead-routing', handler: 'routing' },
  // Legacy path the existing lead-assignment/index.ts served — keep compatible.
  { prefix: '/lead-assignment', handler: 'rules-legacy' },
];

function stripKnownPrefix(path: string): { prefix: string; handler: string; rest: string } | null {
  // Normalize trailing slash + double slashes.
  const norm = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  for (const entry of PREFIX_MAP) {
    if (norm === entry.prefix || norm.startsWith(entry.prefix + '/')) {
      return {
        prefix: entry.prefix,
        handler: entry.handler,
        rest: norm.slice(entry.prefix.length),
      };
    }
  }
  return null;
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method;
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const matched = stripKnownPrefix(url.pathname);
    if (!matched) {
      return errorResponse(404, 'Not found', req, {
        code: 'NOT_FOUND',
        details: { path: url.pathname, method },
        requestId,
      });
    }

    const pathParts = matched.rest.split('/').filter(Boolean);
    const ctx = { auth, db, requestId, pathParts, method, url };

    let result: Response | null = null;
    switch (matched.handler) {
      case 'territories':
        result = await handleTerritories(req, ctx, matched.prefix);
        break;
      case 'rules':
        result = await handleRules(req, ctx);
        break;
      case 'capacity':
        result = await handleCapacity(req, ctx);
        break;
      case 'history':
        result = await handleHistory(req, ctx, matched.prefix);
        break;
      case 'queue':
        result = await handleQueue(req, ctx);
        break;
      case 'assign':
        result = await handleAssign(req, ctx);
        break;
      case 'routing':
        result = await handleRouting(req, ctx);
        break;
      case 'rules-legacy':
        // `/lead-assignment/rules[/:id]` — the legacy entry point the old
        // edge function served. Forward to the rules handler by re-routing
        // under a virtual prefix so the handler sees the same shape as
        // `/lead-assignment-rules/*`.
        if (pathParts[0] === 'rules') {
          result = await handleRules(req, { ...ctx, pathParts: pathParts.slice(1) });
        } else {
          result = null;
        }
        break;
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
