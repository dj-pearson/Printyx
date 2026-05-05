/**
 * Customer Success edge function.
 *
 * Replaces server/routes/customer-success-routes.ts (1,006 lines, 44 endpoints).
 *
 * URL prefix: /customer-success/*
 *
 * Resource groups:
 *   /health-scores/*       → handlers/health-scores.ts  (7 endpoints)
 *   /churn-predictions/*   → handlers/churn-predictions.ts (8)
 *   /interventions/*       → handlers/interventions.ts (10)
 *   /journeys/*            → handlers/journeys.ts (9)
 *   /renewals/*            → handlers/renewals.ts (10)
 *
 * One-time SQL:
 *   \i drizzle/rls/customer-success-tables.sql
 *   \i drizzle/rls/customer-success.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleHealthScores } from './handlers/health-scores.ts';
import { handleChurnPredictions } from './handlers/churn-predictions.ts';
import { handleInterventions } from './handlers/interventions.ts';
import { handleJourneys } from './handlers/journeys.ts';
import { handleRenewals } from './handlers/renewals.ts';
import {
  handleUsageAnalytics,
  handleSatisfaction,
  handleCalculateHealth,
} from './handlers/analytics-frontend-stubs.ts';

const log = createLogger('customer-success');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/customer-success/, '')
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

    const pathParts = sub.split('/').filter(Boolean);
    const first = pathParts[0];
    const ctx = { auth, db, requestId, pathParts: pathParts.slice(1), method, url };

    let result: Response | null = null;
    switch (first) {
      case 'health-scores':
        result = await handleHealthScores(req, ctx);
        break;
      case 'churn-predictions':
        result = await handleChurnPredictions(req, ctx);
        break;
      case 'interventions':
        result = await handleInterventions(req, ctx);
        break;
      case 'journeys':
        result = await handleJourneys(req, ctx);
        break;
      case 'renewals':
        result = await handleRenewals(req, ctx);
        break;
      case 'usage-analytics':
        result = await handleUsageAnalytics(req, ctx);
        break;
      case 'satisfaction':
        result = await handleSatisfaction(req, ctx);
        break;
      case 'calculate-health':
        result = await handleCalculateHealth(req, ctx);
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
