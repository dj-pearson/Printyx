/**
 * Lead Scoring + Lead Intelligence edge function (canonical).
 *
 * Replaces:
 *   server/routes/lead-scoring-routes.ts (19 endpoints)
 *   server/routes/lead-intelligence-routes.ts (7 endpoints)
 *   server/services/lead-intelligence-service.ts (logic inlined into handlers)
 *
 * Two URL prefixes, one function:
 *   /lead-scoring/*       → scoring rules, calculation, BANT, engagement, analytics
 *   /lead-intelligence/*  → Apollo-backed enrichment, process, batch, attention
 *
 * One-time SQL (order matters):
 *   \i drizzle/rls/lead-scoring-tables.sql   # if missing tables
 *   \i drizzle/rls/lead-scoring.sql          # RLS
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleRules } from './handlers/rules.ts';
import { handleCalculate } from './handlers/calculate.ts';
import { handleBant } from './handlers/bant.ts';
import { handleEngagement } from './handlers/engagement.ts';
import { handleAnalytics } from './handlers/analytics.ts';
import { handleIntelligence } from './handlers/intelligence.ts';

const log = createLogger('lead-scoring');

function stripKnownPrefix(
  path: string,
): { prefix: 'lead-scoring' | 'lead-intelligence'; rest: string } | null {
  const norm = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  for (const prefix of ['lead-scoring', 'lead-intelligence'] as const) {
    const full = `/${prefix}`;
    if (norm === full || norm.startsWith(full + '/')) {
      return { prefix, rest: norm.slice(full.length) };
    }
  }
  return null;
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

    if (matched.prefix === 'lead-intelligence') {
      result = await handleIntelligence(req, ctx);
    } else {
      // /lead-scoring/*
      const first = pathParts[0];
      switch (first) {
        case 'rules':
          result = await handleRules(req, { ...ctx, pathParts: pathParts.slice(1) });
          break;
        case 'calculate':
        case 'score':
        case 'leaderboard':
        case 'grade':
          result = await handleCalculate(req, ctx);
          break;
        case 'bant':
        case 'bant-analytics':
        case 'qualified':
        case 'qualification-history':
          result = await handleBant(req, ctx);
          break;
        case 'engagement':
          result = await handleEngagement(req, ctx);
          break;
        case 'analytics':
          result = await handleAnalytics(req, ctx);
          break;
        default:
          result = null;
      }
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
