// POST /ai-search/search/embeddings — write a new embedding row.
// Ported from server/routes/ai-search-knowledge-routes.ts::560-606 +
// server/services/ai-search-knowledge-service.ts::202-271.

import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { z } from 'https://esm.sh/zod@3.22.4';
import type { HandlerCtx } from '../_context.ts';
import { createEmbedding, OpenAIRateLimitError } from '../../_shared/openai.ts';

const createEmbeddingSchema = z.object({
  contentId: z.string().min(1),
  contentType: z.string().min(1),
  text: z.string().min(1),
  title: z.string().optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  accessLevel: z.enum(['tenant', 'public', 'restricted', 'private']).optional(),
  accessPermissions: z.array(z.string()).optional(),
});

export async function handleEmbeddings(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  // pathParts: ['search', 'embeddings']
  if (method !== 'POST' || pathParts[1] !== 'embeddings') return null;

  let body;
  try {
    body = await validateBody(createEmbeddingSchema, req);
  } catch (err) {
    return errorResponse(400, 'Invalid embedding payload', req, {
      code: 'VALIDATION',
      details: (err as { issues?: unknown }).issues,
      requestId,
    });
  }

  let vec: number[] | null;
  try {
    vec = await createEmbedding(body.text);
  } catch (err) {
    if (err instanceof OpenAIRateLimitError) {
      return errorResponse(503, 'Embedding service rate-limited', req, {
        code: 'EMBEDDING_RATE_LIMIT',
        details: { retryAfterSeconds: err.retryAfterSeconds },
        requestId,
      });
    }
    return errorResponse(503, 'Failed to generate embedding', req, {
      code: 'EMBEDDING_FAILED',
      details: String(err),
      requestId,
    });
  }

  if (!vec) {
    return errorResponse(503, 'Embedding unavailable (OPENAI_API_KEY unset)', req, {
      code: 'EMBEDDING_DISABLED',
      requestId,
    });
  }

  // Quality heuristic mirrors the Express service's calculateContentQuality.
  const text = body.text;
  const title = body.title ?? '';
  let qualityScore = 0.5;
  if (text.length > 1000) qualityScore += 0.2;
  else if (text.length > 500) qualityScore += 0.1;
  if (title.length > 10) qualityScore += 0.1;
  if (text.includes('\n\n')) qualityScore += 0.1;
  if (/\d+\./.test(text)) qualityScore += 0.1;
  qualityScore = Math.min(1, qualityScore);

  const createdAt = body.createdAt ? new Date(body.createdAt) : new Date();
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const freshnessScore =
    ageDays < 7 ? 1.0 : ageDays < 30 ? 0.9 : ageDays < 90 ? 0.7 : ageDays < 365 ? 0.5 : 0.3;

  const { data, error } = await db
    .from('vector_embeddings')
    .insert({
      tenant_id: auth.tenantId,
      content_id: body.contentId,
      content_type: body.contentType,
      embedding_vector: JSON.stringify(vec),
      embedding_model: 'text-embedding-3-small',
      content_text: body.text,
      content_title: body.title ?? null,
      content_summary: body.summary ?? null,
      content_keywords: body.keywords ?? [],
      content_category: body.category ?? null,
      content_subcategory: body.subcategory ?? null,
      content_tags: body.tags ?? [],
      content_language: 'en',
      content_author_id: body.authorId ?? null,
      content_created_at: createdAt.toISOString(),
      access_level: body.accessLevel ?? 'tenant',
      access_permissions: body.accessPermissions ?? [],
      content_quality_score: qualityScore,
      freshness_score: freshnessScore,
      embedding_confidence: 0.95,
      embedding_source: 'api',
    })
    .select('id, content_id, content_type, embedding_model, content_quality_score, freshness_score')
    .single();

  if (error) {
    return errorResponse(500, 'Failed to store embedding', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  return jsonResponse(data, 201, req, requestId);
}
