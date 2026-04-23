/**
 * Content Gap Analysis edge function.
 *
 * Replaces:
 *   server/routes/content-gap-analysis-routes.ts (5 endpoints)
 *   server/services/content-gap-analysis-service.ts (→ _engine.ts)
 *
 * URL prefix: /content-gap-analysis/*
 *
 * Endpoints (all admin-only):
 *   GET  /                       — full analysis report
 *   GET  /summary                — top-10 + counts + category health + top-5 recs
 *   GET  /category/:slug         — gaps filtered to a category
 *   GET  /priorities             — gaps grouped by priority bucket
 *   POST /refresh                — trigger fresh analysis (same logic; no cache today)
 *
 * No schema changes. Reads existing knowledge_* + article_feedback tables.
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { generateAnalysis } from './_engine.ts';
import type { AuthContext } from '../_shared/auth.ts';

const log = createLogger('content-gap-analysis');

function isAdmin(auth: AuthContext): boolean {
  // deno-lint-ignore no-explicit-any
  const u = auth.supabaseUser as any;
  const role = String(u?.app_metadata?.role ?? u?.user_metadata?.role ?? '').toLowerCase();
  if (
    role &&
    ['platform_admin', 'super_admin', 'admin'].some((r) => role === r || role.includes(r))
  ) {
    return true;
  }
  const raw =
    u?.app_metadata?.roleLevel ??
    u?.app_metadata?.role_level ??
    u?.user_metadata?.roleLevel ??
    u?.user_metadata?.role_level ??
    1;
  const level = typeof raw === 'number' ? raw : parseInt(String(raw), 10) || 1;
  return level >= 7; // platform admin = 8, admin ≈ 7
}

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/content-gap-analysis/, '')
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
    if (!isAdmin(auth)) {
      return errorResponse(403, 'Admin access required', req, { code: 'FORBIDDEN', requestId });
    }

    const db = getDb();
    const pathParts = sub.split('/').filter(Boolean);
    const first = pathParts[0];
    const second = pathParts[1];

    // GET /category/:slug
    if (method === 'GET' && first === 'category' && second) {
      const report = await generateAnalysis(db, auth.tenantId);
      const slug = decodeURIComponent(second);
      const gaps = report.gaps.filter(
        (g) => g.category.toLowerCase().replace(/_/g, '-') === slug.toLowerCase(),
      );
      const health = report.categoryHealth[slug] ?? {
        articleCount: 0,
        targetArticles: 0,
        coverageScore: 0,
        status: 'poor' as const,
        missingTopics: [],
      };
      return jsonResponse(
        { success: true, category: slug, gaps, health, totalGaps: gaps.length },
        200,
        req,
        requestId,
      );
    }

    // GET /summary
    if (method === 'GET' && first === 'summary') {
      const report = await generateAnalysis(db, auth.tenantId);
      return jsonResponse(
        {
          success: true,
          summary: {
            totalGaps: report.totalGaps,
            criticalGaps: report.criticalGaps,
            highPriorityGaps: report.highPriorityGaps,
            topGaps: report.gaps.slice(0, 10),
            categoryHealth: report.categoryHealth,
            topRecommendations: report.recommendations.slice(0, 5),
          },
        },
        200,
        req,
        requestId,
      );
    }

    // GET /priorities
    if (method === 'GET' && first === 'priorities') {
      const report = await generateAnalysis(db, auth.tenantId);
      const byPriority = {
        critical: report.gaps.filter((g) => g.priority === 'critical'),
        high: report.gaps.filter((g) => g.priority === 'high'),
        medium: report.gaps.filter((g) => g.priority === 'medium'),
        low: report.gaps.filter((g) => g.priority === 'low'),
      };
      return jsonResponse(
        {
          success: true,
          priorities: byPriority,
          counts: {
            critical: byPriority.critical.length,
            high: byPriority.high.length,
            medium: byPriority.medium.length,
            low: byPriority.low.length,
          },
        },
        200,
        req,
        requestId,
      );
    }

    // POST /refresh
    if (method === 'POST' && first === 'refresh') {
      const report = await generateAnalysis(db, auth.tenantId);
      return jsonResponse(
        { success: true, message: 'Content gap analysis refreshed successfully', report },
        200,
        req,
        requestId,
      );
    }

    // GET / (root)
    if (method === 'GET' && !first) {
      const report = await generateAnalysis(db, auth.tenantId);
      return jsonResponse({ success: true, report }, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path: url.pathname, method },
      requestId,
    });
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
