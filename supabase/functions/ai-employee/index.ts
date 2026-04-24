/**
 * AI Employee edge function (canonical).
 *
 * Replaces:
 *   server/routes/ai-employee-routes.ts       (10 endpoints)
 *   server/routes/ai-routes-simple.ts         ( 2 endpoints, merged under /ai/*)
 *   server/services/ai-employee-service.ts    (918 lines — port as _execute.ts)
 *   server/services/claude-ai-service.ts      (replaced by _shared/anthropic.ts)
 *
 * URL layout (all under /ai-employee):
 *   /ai-employee/ai-employees                         — CRUD
 *   /ai-employee/ai-employees/:id                     — detail
 *   /ai-employee/ai-employees/templates               — static catalog
 *   /ai-employee/ai-employees/tasks                   — POST create task
 *   /ai-employee/ai-employees/:id/tasks               — GET employee tasks
 *   /ai-employee/ai-employees/:id/performance         — GET metrics
 *   /ai-employee/ai-employees/workflows               — GET active workflows
 *   /ai-employee/ai-employees/workflows/execute       — POST run workflow
 *   /ai-employee/ai-employees/analytics/overview      — GET analytics
 *   /ai-employee/ai/health                            — GET liveness (Claude probe)
 *   /ai-employee/ai/leads/analyze                     — POST Claude lead analysis
 *
 * One-time SQL:
 *   \i drizzle/rls/ai-employee-tables.sql
 *   \i drizzle/rls/ai-employee.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { requireRateLimit, RateLimitError, PRESETS } from '../_shared/rate-limit.ts';

import { handleEmployees } from './handlers/employees.ts';
import { handleTasks } from './handlers/tasks.ts';
import { handleWorkflows } from './handlers/workflows.ts';
import { handleAnalytics } from './handlers/analytics.ts';
import { handleSimple } from './handlers/simple.ts';

const log = createLogger('ai-employee');

function stripPrefix(path: string): string {
  // server.ts strips the function-name prefix before calling us, but handle
  // both `/foo` and `/ai-employee/foo` so dev harnesses that preserve the
  // prefix still work.
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/ai-employee(?=\/|$)/, '')
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

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const rest = stripPrefix(url.pathname);
    const pathParts = rest.split('/').filter(Boolean);
    const ctx = { auth, db, requestId, pathParts, method, url };

    // Rate-limit Claude-hitting endpoints per tenant. Cheap list/detail calls
    // don't pay the per-minute cost; only task creation, workflow execution,
    // and the lead-analyze endpoint do.
    const firstSegment = pathParts[0];
    const needsAiLimit =
      method === 'POST' &&
      (firstSegment === 'ai' ||
        (firstSegment === 'ai-employees' &&
          (pathParts[1] === 'tasks' ||
            (pathParts[1] === 'workflows' && pathParts[2] === 'execute'))));
    if (needsAiLimit) {
      try {
        requireRateLimit(`claude:${auth.tenantId}`, PRESETS.aiGenerationPerTenant);
      } catch (err) {
        if (err instanceof RateLimitError) {
          return errorResponse(429, 'AI rate limit exceeded', req, {
            code: 'RATE_LIMIT',
            details: { retryAfterSeconds: err.retryAfterSeconds },
            requestId,
          });
        }
        throw err;
      }
    }

    let result: Response | null = null;

    switch (firstSegment) {
      case 'ai-employees': {
        const seg1 = pathParts[1];
        if (seg1 === 'workflows') {
          result = await handleWorkflows(req, ctx);
        } else if (seg1 === 'analytics') {
          result = await handleAnalytics(req, ctx);
        } else if (seg1 === 'tasks' && method === 'POST') {
          result = await handleTasks(req, ctx);
        } else if (pathParts[2] === 'tasks' || pathParts[2] === 'performance') {
          result = await handleTasks(req, ctx);
        } else {
          result = await handleEmployees(req, ctx);
        }
        break;
      }
      case 'ai':
        result = await handleSimple(req, ctx);
        break;
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
