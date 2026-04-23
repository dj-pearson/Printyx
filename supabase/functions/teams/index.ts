/**
 * Teams edge function (canonical).
 *
 * Replaces:
 *   server/routes/team-collaboration-routes.ts (13 endpoints)
 *   supabase/functions/teams/ (pre-rewrite — 195 loc)
 *
 * URL prefixes handled (both supported for frontend compat):
 *   /teams/*                         — direct team paths (legacy)
 *   /team-collaboration/*            — what the frontend calls
 *
 * Resource groups:
 *   /teams/*                         → handlers/teams.ts
 *   /projects/*                      → handlers/projects.ts
 *   /collaboration/templates         → handlers/templates.ts (stub)
 *   /collaboration/analytics         → handlers/analytics.ts (computed aggregates)
 *
 * One-time SQL:
 *   \i drizzle/rls/tasks-collab-tables.sql
 *   \i drizzle/rls/tasks-collab.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleTeams } from './handlers/teams.ts';
import { handleProjects } from './handlers/projects.ts';
import { handleTemplates } from './handlers/templates.ts';
import { handleAnalytics } from './handlers/analytics.ts';

const log = createLogger('teams');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/(team-collaboration|teams)/, '')
      .replace(/\/$/, '') || '/'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();
  const sub = stripPrefix(url.pathname);

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const parts = sub.split('/').filter(Boolean);
    const first = parts[0];

    let handlerParts: string[];
    let bucket: 'teams' | 'projects' | 'templates' | 'analytics';
    if (first === 'teams') {
      bucket = 'teams';
      handlerParts = parts.slice(1);
    } else if (first === 'projects') {
      bucket = 'projects';
      handlerParts = parts.slice(1);
    } else if (first === 'collaboration' && parts[1] === 'templates') {
      bucket = 'templates';
      handlerParts = [];
    } else if (first === 'collaboration' && parts[1] === 'analytics') {
      bucket = 'analytics';
      handlerParts = [];
    } else {
      bucket = 'teams';
      handlerParts = parts;
    }

    const ctx = { auth, db, requestId, pathParts: handlerParts, method, url };

    let result: Response | null = null;
    switch (bucket) {
      case 'teams':
        result = await handleTeams(req, ctx);
        break;
      case 'projects':
        result = await handleProjects(req, ctx);
        break;
      case 'templates':
        result = await handleTemplates(req, ctx);
        break;
      case 'analytics':
        result = await handleAnalytics(req, ctx);
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
