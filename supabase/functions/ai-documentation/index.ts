/**
 * AI Documentation edge function.
 *
 * Replaces:
 *   server/routes/ai-documentation-routes.ts  (11 endpoints)
 *   server/services/ai-documentation-service.ts (ported into handlers)
 *
 * URL layout (under /ai-documentation):
 *   POST /documents                                   — create (echo; no table yet)
 *   GET  /documents                                   — list (mock)
 *   GET  /documents/:id                               — detail (mock)
 *   POST /documents/from-meeting                      — Claude: transcript → doc
 *   POST /documents/:id/sections/generate             — Claude: section content
 *   POST /documents/:id/improve                       — Claude: improve prose
 *   POST /documents/search                            — keyword search (mock)
 *   POST /knowledge/articles                          — create article (echo)
 *   GET  /knowledge/articles                          — list (mock)
 *   GET  /analytics/writing                           — writing analytics (mock)
 *   GET  /document-types                              — type catalog (static)
 *
 * NOTE: No `ai_documents` / `ai_document_types` tables exist in migrations.
 * The Express routes returned mock data; we do the same here to preserve
 * frontend compatibility. Only the Claude endpoints do real work.
 *
 * No RLS file is required today — there are no tables to protect. When real
 * persistence lands, add drizzle/rls/ai-documentation.sql alongside a
 * migration that creates the tables.
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { requireRateLimit, RateLimitError, PRESETS } from '../_shared/rate-limit.ts';

import { handleDocuments } from './handlers/documents.ts';
import { handleKnowledge } from './handlers/knowledge.ts';
import { MOCK_DOCUMENT_TYPES, MOCK_WRITING_ANALYTICS } from './_mock.ts';

const log = createLogger('ai-documentation');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/ai-documentation(?=\/|$)/, '')
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

    // Claude-backed endpoints per-tenant rate limit.
    const firstSegment = pathParts[0];
    const isHeavyAi =
      method === 'POST' &&
      firstSegment === 'documents' &&
      (pathParts[1] === 'from-meeting' ||
        (pathParts[2] === 'sections' && pathParts[3] === 'generate') ||
        pathParts[2] === 'improve');
    if (isHeavyAi) {
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
      case 'documents':
        result = await handleDocuments(req, ctx);
        break;
      case 'knowledge':
        result = await handleKnowledge(req, ctx);
        break;
      case 'analytics':
        if (method === 'GET' && pathParts[1] === 'writing') {
          result = jsonResponse(MOCK_WRITING_ANALYTICS, 200, req, requestId);
        }
        break;
      case 'document-types':
        if (method === 'GET') {
          const activeOnly = url.searchParams.get('active_only') !== 'false';
          const category = url.searchParams.get('category');
          let types = MOCK_DOCUMENT_TYPES;
          if (category) types = types.filter((t) => t.category === category);
          if (activeOnly) types = types.filter((t) => t.isActive);
          result = jsonResponse(types, 200, req, requestId);
        }
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
