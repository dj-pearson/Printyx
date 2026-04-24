// GET /ai-search/search/analytics — aggregated search analytics for a tenant.
// Ported from server/routes/ai-search-knowledge-routes.ts::612-629 + service::596-686.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  if (method !== 'GET' || pathParts[1] !== 'analytics') return null;

  const end = url.searchParams.get('end_date')
    ? new Date(url.searchParams.get('end_date')!)
    : new Date();
  const start = url.searchParams.get('start_date')
    ? new Date(url.searchParams.get('start_date')!)
    : new Date(end.getTime() - 30 * 86_400_000);

  const { data: queries, error } = await db
    .from('ai_search_queries')
    .select(
      'id, user_id, query_intent, query_text, response_time_ms, results_count, user_satisfaction_rating, follow_up_query_id',
    )
    .eq('tenant_id', auth.tenantId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (error) {
    return errorResponse(500, 'Failed to fetch search analytics', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  const rows = queries ?? [];
  const totalQueries = rows.length;
  const uniqueUsers = new Set(rows.map((r) => r.user_id)).size;
  const averageQueriesPerUser = uniqueUsers > 0 ? totalQueries / uniqueUsers : 0;

  const intentCounts = new Map<string, number>();
  const termCounts = new Map<string, number>();
  let totalResponseTime = 0;
  let totalResults = 0;
  let zeroResults = 0;
  let totalSatisfaction = 0;
  let satisfactionCount = 0;
  let followUps = 0;

  for (const r of rows) {
    const intent = r.query_intent ?? 'factual';
    intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);

    const term = String(r.query_text ?? '')
      .toLowerCase()
      .trim();
    if (term) termCounts.set(term, (termCounts.get(term) ?? 0) + 1);

    totalResponseTime += Number(r.response_time_ms ?? 0);
    const resultsCount = Number(r.results_count ?? 0);
    totalResults += resultsCount;
    if (resultsCount === 0) zeroResults += 1;

    if (typeof r.user_satisfaction_rating === 'number') {
      totalSatisfaction += r.user_satisfaction_rating;
      satisfactionCount += 1;
    }
    if (r.follow_up_query_id) followUps += 1;
  }

  const mostCommonQueryTypes = Array.from(intentCounts.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalQueries > 0 ? Number(((count / totalQueries) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const popularSearchTerms = Array.from(termCounts.entries())
    .map(([term, count]) => ({ term, count, trend: 'stable' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return jsonResponse(
    {
      totalQueries,
      uniqueUsers,
      averageQueriesPerUser: Number(averageQueriesPerUser.toFixed(1)),
      mostCommonQueryTypes,
      popularSearchTerms,
      trendingTopics: [],
      averageResponseTime: totalQueries > 0 ? Math.round(totalResponseTime / totalQueries) : 0,
      averageResultCount: totalQueries > 0 ? Number((totalResults / totalQueries).toFixed(1)) : 0,
      zeroResultQueryRate: totalQueries > 0 ? Number((zeroResults / totalQueries).toFixed(3)) : 0,
      averageUserSatisfaction:
        satisfactionCount > 0 ? Number((totalSatisfaction / satisfactionCount).toFixed(2)) : 0,
      followUpQueryRate: totalQueries > 0 ? Number((followUps / totalQueries).toFixed(3)) : 0,
      aiInsights: [],
      optimizationRecommendations: [],
      contentSuggestions: [],
    },
    200,
    req,
    requestId,
  );
}
