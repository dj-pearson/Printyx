/**
 * Tasks edge function (canonical).
 *
 * Replaces:
 *   server/routes/task-routes.ts (9 endpoints)
 *   supabase/functions/tasks/ (pre-rewrite — 273 loc)
 *   supabase/functions/tasks-enhanced/  (DELETED 2026-08-29, EDGE-006a)
 *   supabase/functions/tasks-bulk/      (DELETED 2026-08-29, EDGE-006a)
 *   supabase/functions/tasks-stats/     (DELETED 2026-08-29, EDGE-006a)
 *   supabase/functions/task-comments/   (DELETED 2026-08-29, EDGE-006a)
 *
 * The four are gone rather than merely superseded. None was reachable: no
 * client tree named /api/<any of them>, none was a crmProxies target, none was
 * a server.ts alias, and no pg_cron job posted to one. Their endpoints are all
 * served here, and two of them could not have worked anyway - tasks-enhanced
 * selected assignee_id, customer_id and a users.full_name that the real tables
 * do not have, and task-comments read task_time_entries, a relation in no
 * schema and no migration (handlers/time-entries.ts uses time_entries, which
 * exists).
 *
 * URL prefix: /tasks/*
 *
 * Endpoints:
 *   GET    /                          — list (?status, ?priority, ?assigned_to, ?project_id)
 *   GET    /stats                     — counts by status + priority + overdue
 *   GET    /categories                — stub: static list (no task_categories table)
 *   GET    /suggestions               — stub: returns []
 *   POST   /suggestions/:id/accept    — stub
 *   GET    /:taskId
 *   POST   /
 *   PUT    /:taskId
 *   PATCH  /:taskId
 *   DELETE /:taskId
 *   POST   /schedule                  — stub: no task_schedules table
 *   POST   /:taskId/time-entry        — appends to time_entries
 *   GET    /:taskId/time-entries
 *   POST   /bulk/update               — bulk PATCH on many tasks
 *   POST   /bulk/delete               — bulk delete
 *   GET    /:taskId/comments
 *   POST   /:taskId/comments
 *   PATCH  /:taskId/comments/:commentId
 *   DELETE /:taskId/comments/:commentId
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

import { handleTasks } from './handlers/tasks.ts';
import { handleComments } from './handlers/comments.ts';
import { handleTimeEntries } from './handlers/time-entries.ts';
import { handleBulk } from './handlers/bulk.ts';
import { handleStats } from './handlers/stats.ts';
import { handleStubs } from './handlers/stubs.ts';

const log = createLogger('tasks');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/tasks/, '')
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
    const ctx = { auth, db, requestId, pathParts: parts, method, url };

    let result: Response | null = null;

    if (first === 'stats') {
      result = await handleStats(req, ctx);
    } else if (first === 'categories' || first === 'suggestions' || first === 'schedule') {
      result = await handleStubs(req, ctx);
    } else if (first === 'bulk') {
      result = await handleBulk(req, { ...ctx, pathParts: parts.slice(1) });
    } else if (parts.length >= 2 && parts[1] === 'comments') {
      result = await handleComments(req, { ...ctx, pathParts: parts });
    } else if (parts.length >= 2 && (parts[1] === 'time-entry' || parts[1] === 'time')) {
      // TaskTimeTracker.tsx posts the manual entry to /:id/time; only
      // /:id/time-entry was routed, so every manual entry 404'd.
      result = await handleTimeEntries(req, { ...ctx, pathParts: ['create', parts[0]] });
    } else if (parts.length >= 3 && parts[1] === 'time-entries') {
      // Delete carries the entry id at parts[2]. The old dispatcher forwarded
      // ['list', taskId] for every /time-entries path and dropped it.
      result = await handleTimeEntries(req, {
        ...ctx,
        pathParts: ['delete', parts[0], parts[2]],
      });
    } else if (parts.length >= 2 && parts[1] === 'time-entries') {
      result = await handleTimeEntries(req, { ...ctx, pathParts: ['list', parts[0]] });
    } else if (parts.length >= 3 && parts[1] === 'timer') {
      // /:id/timer/start and /:id/timer/stop. Neither existed here, so the
      // whole timer was dead while Express's working copy sat shadowed.
      //
      // PA-052: the accepted verbs are enumerated rather than interpolated
      // straight into the op name. `timer-${parts[2]}` forwarded any third
      // segment and relied on handleTimeEntries returning null for the ones it
      // did not know, and it named neither verb anywhere a reader - or
      // check:edge-coverage, which reported both as unserved - could see them.
      const verb = parts[2] === 'start' ? 'start' : parts[2] === 'stop' ? 'stop' : null;
      result = verb
        ? await handleTimeEntries(req, { ...ctx, pathParts: [`timer-${verb}`, parts[0]] })
        : null;
    } else {
      result = await handleTasks(req, ctx);
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
