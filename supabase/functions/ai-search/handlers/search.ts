// Semantic search + suggestions + feedback.
//
// `vector_embeddings.embedding_vector` is stored as TEXT (JSON-encoded
// 1536-dim array) — not native pgvector. We can't push cosine similarity
// into SQL, so we read a candidate window scoped to tenant/type filters,
// parse the JSON arrays, and rank in-memory. This is fine up to ~O(10k)
// rows per tenant; a future pass can add a real pgvector column +
// `vector_cosine_ops` index and push the ORDER BY into SQL.
//
// Ported from server/routes/ai-search-knowledge-routes.ts::18-146 + service::276-431.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { createEmbedding, cosineSimilarity, OpenAIRateLimitError } from '../../_shared/openai.ts';
import { generateCompletion } from '../../_shared/anthropic.ts';
import { createLogger } from '../../_shared/logger.ts';

const log = createLogger('ai-search-search');

const FALLBACK_SUGGESTIONS = [
  'How to set up meeting transcription',
  'AI documentation best practices',
  'Team collaboration workflows',
  'Calendar integration troubleshooting',
  'Advanced scheduling algorithms',
  'Vector search implementation',
  'Knowledge management strategies',
  'Automated content generation',
];

function analyzeIntent(query: string): {
  intent: 'factual' | 'how_to' | 'troubleshooting' | 'definition' | 'comparison';
  expandedTerms: string[];
} {
  const q = query.toLowerCase();
  let intent: ReturnType<typeof analyzeIntent>['intent'] = 'factual';
  if (/how to|how do/.test(q)) intent = 'how_to';
  else if (/what is|define/.test(q)) intent = 'definition';
  else if (/\bvs\b|compare/.test(q)) intent = 'comparison';
  else if (/error|problem|issue|fail/.test(q)) intent = 'troubleshooting';
  return {
    intent,
    expandedTerms: q.split(/\s+/).filter((w) => w.length > 3),
  };
}

function excerpt(content: string, query: string, maxLen = 200): string {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  let best = sentences[0] ?? '';
  let bestMatches = 0;
  for (const s of sentences) {
    const matches = queryWords.filter((w) => s.toLowerCase().includes(w)).length;
    if (matches > bestMatches) {
      best = s;
      bestMatches = matches;
    }
  }
  const trimmed = best.trim();
  return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen - 3) + '...';
}

function highlights(content: string, query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const out = new Set<string>();
  for (const w of words) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const m = content.match(re);
    if (m) m.slice(0, 3).forEach((x) => out.add(x));
  }
  return Array.from(out);
}

export async function handleSearch(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['search', ...]
  const sub = pathParts[1];

  // POST /search/semantic
  if (method === 'POST' && sub === 'semantic') {
    const t0 = Date.now();
    let body: {
      query?: string;
      contentTypes?: string[];
      categories?: string[];
      maxResults?: number;
      minSimilarity?: number;
      includeAnswer?: boolean;
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    const queryText = body.query?.trim();
    if (!queryText) {
      return errorResponse(400, 'Search query is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const maxResults = Math.min(50, Math.max(1, Number(body.maxResults ?? 10)));
    const minSimilarity = Math.max(0, Math.min(1, Number(body.minSimilarity ?? 0.3)));

    // Generate query embedding. If OPENAI_API_KEY is missing, fall back to
    // text search so the endpoint still degrades gracefully.
    const embeddingStart = Date.now();
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await createEmbedding(queryText);
    } catch (err) {
      if (err instanceof OpenAIRateLimitError) {
        return errorResponse(503, 'Embedding service rate-limited', req, {
          code: 'EMBEDDING_RATE_LIMIT',
          details: { retryAfterSeconds: err.retryAfterSeconds },
          requestId,
        });
      }
      log.warn({ err: String(err) }, 'embedding_failed_falling_back_to_text');
    }
    const embeddingTime = Date.now() - embeddingStart;

    // Fetch candidate rows scoped to tenant + filters. We over-fetch (5x the
    // requested limit) so in-memory reranking has material to work with,
    // capped at 500 to bound memory.
    const fetchLimit = Math.min(500, maxResults * 5);
    let query = db
      .from('vector_embeddings')
      .select(
        'id, content_id, content_type, embedding_vector, content_text, content_title, content_summary, content_keywords, content_category, content_tags, content_author_id, content_created_at, content_quality_score, freshness_score',
      )
      .eq('tenant_id', auth.tenantId)
      .limit(fetchLimit);

    if (body.contentTypes && body.contentTypes.length > 0) {
      query = query.in('content_type', body.contentTypes);
    }
    if (body.categories && body.categories.length > 0) {
      query = query.in('content_category', body.categories);
    }
    // Text prefilter when we have no embedding, to narrow the candidate set.
    if (!queryEmbedding) {
      query = query.ilike('content_text', `%${queryText}%`);
    }

    const { data: rowsRaw, error } = await query;
    if (error) {
      return errorResponse(500, 'Failed to query embeddings', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    type EmbeddingRow = {
      id: string;
      content_id: string;
      content_type: string;
      embedding_vector: string | null;
      content_text: string | null;
      content_title: string | null;
      content_summary: string | null;
      content_keywords: string[] | null;
      content_category: string | null;
      content_tags: string[] | null;
      content_author_id: string | null;
      content_created_at: string | null;
      content_quality_score: number | null;
      freshness_score: number | null;
    };

    const scored = ((rowsRaw ?? []) as EmbeddingRow[])
      .map((row) => {
        let similarity = 0;
        if (queryEmbedding && typeof row.embedding_vector === 'string') {
          try {
            const vec = JSON.parse(row.embedding_vector);
            if (Array.isArray(vec) && vec.length === queryEmbedding.length) {
              similarity = cosineSimilarity(queryEmbedding, vec);
            }
          } catch {
            similarity = 0;
          }
        } else if (!queryEmbedding) {
          // Textual fallback: tf-like match score.
          const q = queryText.toLowerCase();
          const text = (row.content_text ?? '').toLowerCase();
          const matches = q.split(/\s+/).filter((w) => w && text.includes(w)).length;
          similarity = Math.min(1, matches / Math.max(1, q.split(/\s+/).length));
        }

        // Keyword-match boost.
        const keywordMatches = (row.content_keywords ?? []).filter((k) =>
          queryText.toLowerCase().includes(String(k).toLowerCase()),
        ).length;
        const keywordBoost = Math.min(0.3, keywordMatches * 0.05);
        const relevanceScore = Math.min(1, similarity * 0.7 + keywordBoost + 0.2);

        return { row, similarity, relevanceScore };
      })
      .filter((x) => x.similarity >= minSimilarity)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    const formattedResults = scored.map(({ row, similarity, relevanceScore }) => ({
      contentId: row.content_id,
      contentType: row.content_type,
      title: row.content_title ?? 'Untitled',
      excerpt: excerpt(row.content_text ?? '', queryText),
      similarity,
      relevanceScore,
      source: {
        author: row.content_author_id ?? undefined,
        createdAt: row.content_created_at ?? undefined,
        category: row.content_category ?? undefined,
        tags: row.content_tags ?? [],
      },
      highlights: highlights(row.content_text ?? '', queryText),
    }));

    // Record the search query.
    const intentInfo = analyzeIntent(queryText);
    const { data: queryRow } = await db
      .from('ai_search_queries')
      .insert({
        tenant_id: auth.tenantId,
        user_id: auth.userId,
        query_text: queryText,
        query_intent: intentInfo.intent,
        query_language: 'en',
        search_filters: { ...body },
        search_scope: body.contentTypes ?? [],
        max_results: maxResults,
        query_embedding: queryEmbedding ? JSON.stringify(queryEmbedding) : null,
        query_expansion: intentInfo.expandedTerms,
        results_count: formattedResults.length,
        top_result_scores: formattedResults.slice(0, 5).map((r) => r.relevanceScore),
        response_time_ms: Date.now() - t0,
      })
      .select('id')
      .single();

    const queryId = queryRow?.id ?? `query-${Date.now()}`;

    // Optionally synthesize an AI answer from the top results.
    let aiAnswer: Record<string, unknown> | undefined;
    let answerTime: number | undefined;
    if (body.includeAnswer !== false && formattedResults.length > 0) {
      const answerStart = Date.now();
      try {
        aiAnswer = await synthesizeAnswer(queryId, queryText, formattedResults, auth.tenantId, db);
      } catch (err) {
        log.warn({ err: String(err) }, 'answer_generation_failed');
      }
      answerTime = Date.now() - answerStart;
    }

    const relatedTopics = Array.from(new Set(formattedResults.flatMap((r) => r.source.tags))).slice(
      0,
      8,
    );

    const suggestedQueries = [
      `How to implement ${queryText}`,
      `${queryText} best practices`,
      `${queryText} troubleshooting`,
      `Advanced ${queryText} techniques`,
    ];

    return jsonResponse(
      {
        queryId,
        results: formattedResults,
        answer: aiAnswer,
        relatedTopics,
        suggestedQueries,
        searchMetrics: {
          totalResults: formattedResults.length,
          searchTime: Date.now() - t0,
          embeddingTime,
          answerTime,
        },
      },
      200,
      req,
      requestId,
    );
  }

  // GET /search/suggestions
  if (method === 'GET' && sub === 'suggestions') {
    const q = (url.searchParams.get('query') ?? '').toLowerCase();
    const limit = Number(url.searchParams.get('limit') ?? '8');

    // Pull recent successful queries for this tenant + surface them.
    const { data: recent } = await db
      .from('ai_search_queries')
      .select('query_text')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    const tenantSuggestions = Array.from(
      new Set(
        (recent ?? [])
          .map((r) => String(r.query_text ?? ''))
          .filter((s) => s.length > 0 && (!q || s.toLowerCase().includes(q))),
      ),
    );

    const fallback = FALLBACK_SUGGESTIONS.filter((s) => !q || s.toLowerCase().includes(q));
    const merged = Array.from(new Set([...tenantSuggestions, ...fallback])).slice(0, limit);

    return jsonResponse(
      {
        suggestions: merged,
        popularQueries: tenantSuggestions.slice(0, 4).map((query, i) => ({
          query,
          frequency: Math.max(1, 10 - i * 2),
        })),
      },
      200,
      req,
      requestId,
    );
  }

  // POST /search/feedback
  if (method === 'POST' && sub === 'feedback') {
    let body: {
      queryId?: string;
      answerId?: string;
      rating?: number;
      feedback?: string;
      clickedResults?: unknown[];
      wasHelpful?: boolean;
      corrections?: unknown[];
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.queryId) {
      return errorResponse(400, 'Query ID is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    // Update the original query with user signals. When answerId is present,
    // also record the helpful/unhelpful vote on ai_generated_answers.
    const queryUpdate: Record<string, unknown> = {};
    if (typeof body.rating === 'number') queryUpdate.user_satisfaction_rating = body.rating;
    if (Array.isArray(body.clickedResults)) queryUpdate.clicked_results = body.clickedResults;
    if (body.feedback) queryUpdate.result_quality_feedback = { feedback: body.feedback };

    if (Object.keys(queryUpdate).length > 0) {
      await db
        .from('ai_search_queries')
        .update(queryUpdate)
        .eq('id', body.queryId)
        .eq('tenant_id', auth.tenantId);
    }

    if (body.answerId && typeof body.wasHelpful === 'boolean') {
      const col = body.wasHelpful ? 'user_helpful_votes' : 'user_unhelpful_votes';
      // Read-modify-write; Supabase-js lacks atomic increment without rpc.
      const { data: ans } = await db
        .from('ai_generated_answers')
        .select(col)
        .eq('id', body.answerId)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();

      const current = Number((ans as Record<string, number> | null)?.[col] ?? 0);
      await db
        .from('ai_generated_answers')
        .update({ [col]: current + 1 })
        .eq('id', body.answerId)
        .eq('tenant_id', auth.tenantId);
    }

    return jsonResponse(
      {
        success: true,
        message: 'Feedback submitted successfully',
        feedbackId: `feedback-${Date.now()}`,
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}

async function synthesizeAnswer(
  queryId: string,
  queryText: string,
  results: Array<{
    contentId: string;
    contentType: string;
    title: string;
    excerpt: string;
    relevanceScore: number;
  }>,
  tenantId: string,
  db: HandlerCtx['db'],
): Promise<Record<string, unknown>> {
  const context = results
    .slice(0, 5)
    .map((r, i) => `Source ${i + 1} (${r.contentType}): ${r.title}\n${r.excerpt}`)
    .join('\n\n');

  const prompt =
    "Based on the following search results, provide a comprehensive and accurate answer to the user's question.\n\n" +
    `USER QUESTION: ${queryText}\n\n` +
    `SEARCH RESULTS:\n${context}\n\n` +
    'Generate a detailed answer that:\n' +
    "1. Directly addresses the user's question\n" +
    '2. Synthesizes information from multiple sources when relevant\n' +
    '3. Provides step-by-step guidance for "how-to" questions\n' +
    '4. Includes specific examples or details when available\n' +
    '5. Acknowledges limitations if information is incomplete\n\n' +
    'Return JSON format:\n' +
    '{\n  "answerText": "Comprehensive answer to the question",\n' +
    '  "answerType": "direct|synthesized|step_by_step|comparison|summary",\n' +
    '  "answerSections": [{ "title": "Section title", "content": "Section content", "sources": ["source1"] }],\n' +
    '  "keyPoints": ["Key point 1", "Key point 2"],\n  "relatedTopics": ["Related topic 1"],\n' +
    '  "confidenceScore": 0.85,\n  "factualAccuracy": 0.90,\n  "completeness": 0.80,\n  "clarity": 0.95,\n  "usefulness": 0.88\n}';

  const t0 = Date.now();
  const raw = await generateCompletion({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { answerText: raw, answerType: 'synthesized' };
  }

  const confidence = Number(parsed.confidenceScore ?? 0.85);
  const processingTime = Date.now() - t0;

  const answerRow = {
    tenant_id: tenantId,
    query_id: queryId,
    answer_text: String(parsed.answerText ?? raw),
    answer_confidence: confidence,
    answer_type: String(parsed.answerType ?? 'synthesized'),
    source_documents: results.slice(0, 5).map((r) => ({
      id: r.contentId,
      type: r.contentType,
      title: r.title,
      excerpt: r.excerpt,
      relevanceScore: r.relevanceScore,
    })),
    source_confidence: results.slice(0, 5).map((r) => r.relevanceScore),
    answer_sections: parsed.answerSections ?? [],
    key_points: parsed.keyPoints ?? [],
    related_topics: parsed.relatedTopics ?? [],
    factual_accuracy_score: parsed.factualAccuracy ?? null,
    completeness_score: parsed.completeness ?? null,
    clarity_score: parsed.clarity ?? null,
    usefulness_score: parsed.usefulness ?? null,
    ai_model_used: 'claude-3-5-sonnet-20241022',
    generation_prompt: prompt,
    generation_parameters: { temperature: 0.3, max_tokens: 2000 },
    processing_time_ms: processingTime,
    version: 1,
    is_current: true,
  };

  const { data: inserted } = await db
    .from('ai_generated_answers')
    .insert(answerRow)
    .select(
      'id, answer_text, answer_confidence, answer_type, source_documents, key_points, related_topics',
    )
    .single();

  return (
    inserted ?? {
      answerText: answerRow.answer_text,
      answerConfidence: confidence,
      answerType: answerRow.answer_type,
    }
  );
}
