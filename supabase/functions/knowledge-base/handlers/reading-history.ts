// Reading history — /knowledge-base/reading-history[/:articleId|/recent|/stats]
// Replaces server/routes/reading-history-routes.ts (6 endpoints).
//
// Enforces upsert semantics on (user_id, article_id): the POST endpoint adds
// lastReadDuration to total_time_seconds rather than replacing — matches the
// Express behavior used to track cumulative reading time across sessions.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { EngagementCtx } from './bookmarks.ts';

export async function handleReadingHistory(
  req: Request,
  ctx: EngagementCtx,
): Promise<Response | null> {
  const { method, tenantId, userId, db, requestId, pathParts, url } = ctx;
  // pathParts: ['reading-history', ...]
  const sub = pathParts[1];

  // GET /reading-history/recent
  if (method === 'GET' && sub === 'recent') {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '10')));
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const { data, error } = await db
      .from('reading_history')
      .select(
        '*, article:article_id (id, title, slug, excerpt, category_id, estimated_reading_time, featured_image)',
      )
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .gte('last_viewed_at', sevenDaysAgo)
      .order('last_viewed_at', { ascending: false })
      .limit(limit);

    if (error) {
      return errorResponse(500, 'Failed to fetch recent articles', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse({ success: true, articles: data ?? [] }, 200, req, requestId);
  }

  // GET /reading-history/stats
  if (method === 'GET' && sub === 'stats') {
    const { data: rows } = await db
      .from('reading_history')
      .select('completed, reading_progress, total_time_seconds, last_viewed_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    const list = rows ?? [];
    const totalArticlesRead = list.length;
    const completedArticles = list.filter((r) => r.completed === true).length;
    const inProgressArticles = totalArticlesRead - completedArticles;
    const totalReadingTimeSeconds = list.reduce(
      (sum, r) => sum + Number(r.total_time_seconds ?? 0),
      0,
    );
    const averageProgress =
      totalArticlesRead > 0
        ? list.reduce((sum, r) => sum + Number(r.reading_progress ?? 0), 0) / totalArticlesRead
        : 0;

    // Streak — consecutive days with activity, walking back from today.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const activityDates = new Set(
      list
        .map((r) => r.last_viewed_at)
        .filter(Boolean)
        .map((iso) => {
          const d = new Date(iso as string);
          d.setUTCHours(0, 0, 0, 0);
          return d.getTime();
        }),
    );
    let currentStreak = 0;
    for (let i = 0; i < 30; i++) {
      const check = new Date(today);
      check.setUTCDate(check.getUTCDate() - i);
      if (activityDates.has(check.getTime())) currentStreak += 1;
      else break;
    }

    // This week.
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const week = list.filter(
      (r) => r.last_viewed_at && new Date(r.last_viewed_at as string) >= weekAgo,
    );

    return jsonResponse(
      {
        success: true,
        stats: {
          overall: {
            totalArticlesRead,
            completedArticles,
            inProgressArticles,
            totalReadingTimeMinutes: Math.round(totalReadingTimeSeconds / 60),
            averageProgress: Math.round(averageProgress),
          },
          thisWeek: {
            articlesRead: week.length,
            completed: week.filter((r) => r.completed === true).length,
            readingTimeMinutes: Math.round(
              week.reduce((sum, r) => sum + Number(r.total_time_seconds ?? 0), 0) / 60,
            ),
          },
          streak: { currentStreak, unit: 'days' },
        },
      },
      200,
      req,
      requestId,
    );
  }

  // POST /reading-history — upsert reading progress
  if (method === 'POST' && !sub) {
    let body: {
      articleId?: string;
      scrollPosition?: number;
      readingProgress?: number;
      currentSectionId?: string;
      completed?: boolean;
      lastReadDuration?: number;
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.articleId) {
      return errorResponse(400, 'Article ID is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const { data: existing } = await db
      .from('reading_history')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', body.articleId)
      .maybeSingle();

    const now = new Date().toISOString();
    const duration = Number(body.lastReadDuration ?? 0);

    if (existing) {
      const updates: Record<string, unknown> = {
        last_viewed_at: now,
        last_read_duration: duration,
        total_time_seconds: Number(existing.total_time_seconds ?? 0) + duration,
      };
      if (body.scrollPosition !== undefined) updates.scroll_position = body.scrollPosition;
      if (body.readingProgress !== undefined) updates.reading_progress = body.readingProgress;
      if (body.currentSectionId !== undefined) updates.current_section_id = body.currentSectionId;
      if (body.completed !== undefined) {
        updates.completed = body.completed;
        if (body.completed && !existing.completed) updates.completed_at = now;
      }

      const { data, error } = await db
        .from('reading_history')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) {
        return errorResponse(500, 'Failed to update reading history', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(
        { success: true, message: 'Reading progress updated successfully', history: data },
        200,
        req,
        requestId,
      );
    }

    const { data, error } = await db
      .from('reading_history')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        article_id: body.articleId,
        scroll_position: body.scrollPosition ?? 0,
        reading_progress: body.readingProgress ?? 0,
        current_section_id: body.currentSectionId ?? null,
        completed: body.completed ?? false,
        total_time_seconds: duration,
        last_read_duration: duration,
        completed_at: body.completed ? now : null,
      })
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to create reading history', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      { success: true, message: 'Reading progress updated successfully', history: data },
      201,
      req,
      requestId,
    );
  }

  // GET /reading-history — paginated list
  if (method === 'GET' && !sub) {
    const completedQuery = url.searchParams.get('completed');
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));

    let query = db
      .from('reading_history')
      .select(
        '*, article:article_id (id, title, slug, excerpt, category_id, estimated_reading_time, featured_image)',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('last_viewed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (completedQuery !== null) {
      query = query.eq('completed', completedQuery === 'true' || completedQuery === '1');
    }

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(500, 'Failed to fetch reading history', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      {
        success: true,
        history: data ?? [],
        total: count ?? data?.length ?? 0,
        limit,
        offset,
      },
      200,
      req,
      requestId,
    );
  }

  // GET /reading-history/:articleId — fetch progress for a specific article
  if (method === 'GET' && sub) {
    const { data, error } = await db
      .from('reading_history')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', sub)
      .maybeSingle();

    if (error) {
      return errorResponse(500, 'Failed to fetch article reading history', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(
      { success: true, history: data ?? null, exists: !!data },
      200,
      req,
      requestId,
    );
  }

  // DELETE /reading-history/:articleId
  if (method === 'DELETE' && sub) {
    const { error } = await db
      .from('reading_history')
      .delete()
      .eq('user_id', userId)
      .eq('article_id', sub);

    if (error) {
      return errorResponse(500, 'Failed to clear reading history', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(
      { success: true, message: 'Reading history cleared successfully' },
      200,
      req,
      requestId,
    );
  }

  return null;
}
