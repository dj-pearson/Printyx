/**
 * AI Search + Knowledge Graph edge function.
 *
 * Replaces:
 *   server/routes/ai-search-knowledge-routes.ts  (9 endpoints)
 *   server/services/ai-search-knowledge-service.ts (port inlined into handlers)
 *
 * URL layout (under /ai-search):
 *   POST /search/semantic            — embedding + cosine re-rank + Claude answer
 *   GET  /search/suggestions         — suggestions mixing recent queries + fallbacks
 *   POST /search/feedback            — record user feedback against query+answer
 *   POST /search/embeddings          — store a new vector_embeddings row
 *   GET  /search/analytics           — aggregated tenant analytics
 *   POST /knowledge/entities         — create knowledge entity
 *   GET  /knowledge/entities         — list entities
 *   GET  /knowledge/entities/:id     — entity detail
 *   GET  /knowledge/graph            — force-directed graph nodes + edges
 *
 * Vector storage: `vector_embeddings.embedding_vector` is TEXT-encoded JSON
 * (no native pgvector). We compute cosine similarity in JS over a bounded
 * candidate set. If the corpus grows past ~10K rows per tenant, add a real
 * `vector(1536)` column + ivfflat index and push ORDER BY into SQL.
 *
 * One-time SQL:
 *   \i drizzle/rls/ai-search-tables.sql   # guarantees tables exist
 *   \i drizzle/rls/ai-search.sql          # RLS policies
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { requireRateLimit, RateLimitError, PRESETS } from '../_shared/rate-limit.ts';

import { handleSearch } from './handlers/search.ts';
import { handleEmbeddings } from './handlers/embeddings.ts';
import { handleEntities } from './handlers/entities.ts';
import { handleAnalytics } from './handlers/analytics.ts';

const log = createLogger('ai-search');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/ai-search(?=\/|$)/, '')
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

    const firstSegment = pathParts[0];
    const secondSegment = pathParts[1];

    // Embedding writes hit OpenAI; semantic search + feedback hit Claude.
    // Apply the embeddings preset (cheaper, higher volume) for /embeddings
    // and the AI-heavy preset for /semantic.
    if (method === 'POST' && firstSegment === 'search' && secondSegment === 'embeddings') {
      try {
        requireRateLimit(`embed:${auth.tenantId}`, PRESETS.embeddingsPerTenant);
      } catch (err) {
        if (err instanceof RateLimitError) {
          return errorResponse(429, 'Embedding rate limit exceeded', req, {
            code: 'RATE_LIMIT',
            details: { retryAfterSeconds: err.retryAfterSeconds },
            requestId,
          });
        }
        throw err;
      }
    } else if (method === 'POST' && firstSegment === 'search' && secondSegment === 'semantic') {
      try {
        requireRateLimit(`search:${auth.tenantId}`, PRESETS.aiGenerationPerTenant);
      } catch (err) {
        if (err instanceof RateLimitError) {
          return errorResponse(429, 'Search rate limit exceeded', req, {
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
      case 'search':
        if (secondSegment === 'embeddings') {
          result = await handleEmbeddings(req, ctx);
        } else if (secondSegment === 'analytics') {
          result = await handleAnalytics(req, ctx);
        } else {
          result = await handleSearch(req, ctx);
        }
        break;
      case 'knowledge':
        result = await handleEntities(req, ctx);
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
