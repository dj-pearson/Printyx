// Article ratings + votes — /knowledge-base/ratings[/*] + /knowledge-base/votes[/*]
// Replaces server/routes/article-ratings-routes.ts (7 endpoints).
//
// - ratings: 1-5 star with optional comment. Upserts on (user_id, article_id, rating_type).
//   "verified_reader" is set true when the user has a reading_history row with completed=true.
// - votes: helpful/not_helpful/outdated/inaccurate. Upserts on (user_id, article_id).

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { EngagementCtx } from './bookmarks.ts';

const VALID_VOTE_TYPES = ['helpful', 'not_helpful', 'outdated', 'inaccurate'] as const;

export async function handleRatings(req: Request, ctx: EngagementCtx): Promise<Response | null> {
  const { method, tenantId, userId, db, requestId, pathParts, url } = ctx;
  // pathParts: ['ratings', ...] or ['votes', ...]
  const resource = pathParts[0];
  const sub = pathParts[1];
  const sub2 = pathParts[2];

  // ─── Ratings ──────────────────────────────────────────────────────────────

  if (resource === 'ratings') {
    // GET /ratings/user/:articleId — the caller's rating for that article
    if (method === 'GET' && sub === 'user' && sub2) {
      const ratingType = url.searchParams.get('ratingType') ?? 'overall';
      const { data, error } = await db
        .from('article_ratings')
        .select('*')
        .eq('user_id', userId)
        .eq('article_id', sub2)
        .eq('rating_type', ratingType)
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to fetch user rating', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }

      return jsonResponse(
        { success: true, rating: data ?? null, hasRated: !!data },
        200,
        req,
        requestId,
      );
    }

    // POST /ratings — submit or update a rating
    if (method === 'POST' && !sub) {
      let body: {
        articleId?: string;
        rating?: number;
        comment?: string;
        ratingType?: string;
      } = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      if (!body.articleId || !body.rating) {
        return errorResponse(400, 'Article ID and rating are required', req, {
          code: 'VALIDATION',
          requestId,
        });
      }
      if (body.rating < 1 || body.rating > 5) {
        return errorResponse(400, 'Rating must be between 1 and 5', req, {
          code: 'VALIDATION',
          requestId,
        });
      }

      const ratingType = body.ratingType ?? 'overall';

      // Verified reader badge — true if the user completed reading the article.
      const { data: completed } = await db
        .from('reading_history')
        .select('id')
        .eq('user_id', userId)
        .eq('article_id', body.articleId)
        .eq('completed', true)
        .maybeSingle();
      const verifiedReader = !!completed;

      const { data: existing } = await db
        .from('article_ratings')
        .select('id, comment')
        .eq('user_id', userId)
        .eq('article_id', body.articleId)
        .eq('rating_type', ratingType)
        .maybeSingle();

      if (existing) {
        const { data, error } = await db
          .from('article_ratings')
          .update({
            rating: body.rating,
            comment: body.comment ?? existing.comment,
            verified_reader: verifiedReader,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) {
          return errorResponse(500, 'Failed to update rating', req, {
            code: 'DB_ERROR',
            details: error.message,
            requestId,
          });
        }
        return jsonResponse(
          { success: true, message: 'Rating updated successfully', rating: data },
          200,
          req,
          requestId,
        );
      }

      const { data, error } = await db
        .from('article_ratings')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          article_id: body.articleId,
          rating: body.rating,
          rating_type: ratingType,
          comment: body.comment ?? null,
          verified_reader: verifiedReader,
        })
        .select('*')
        .single();

      if (error) {
        return errorResponse(500, 'Failed to submit rating', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(
        { success: true, message: 'Rating submitted successfully', rating: data },
        201,
        req,
        requestId,
      );
    }

    // GET /ratings/:articleId — aggregate ratings for the article
    if (method === 'GET' && sub && !sub2) {
      const articleId = sub;

      // Ratings: average + distribution by star.
      const { data: ratings } = await db
        .from('article_ratings')
        .select('rating')
        .eq('tenant_id', tenantId)
        .eq('article_id', articleId);

      const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      let sum = 0;
      let count = 0;
      for (const r of ratings ?? []) {
        const v = Number(r.rating);
        if (v >= 1 && v <= 5) {
          distribution[v as 1 | 2 | 3 | 4 | 5] += 1;
          sum += v;
          count += 1;
        }
      }
      const average = count > 0 ? Number((sum / count).toFixed(1)) : 0;

      // Votes: counts per vote_type.
      const { data: votes } = await db
        .from('article_votes')
        .select('vote_type')
        .eq('tenant_id', tenantId)
        .eq('article_id', articleId);

      const voteCounts: Record<string, number> = {
        helpful: 0,
        not_helpful: 0,
        outdated: 0,
        inaccurate: 0,
      };
      for (const v of votes ?? []) {
        const key = String(v.vote_type);
        voteCounts[key] = (voteCounts[key] ?? 0) + 1;
      }

      // Recent reviews (ratings with comment).
      const { data: reviews } = await db
        .from('article_ratings')
        .select('id, rating, comment, verified_reader, helpful_count, created_at')
        .eq('tenant_id', tenantId)
        .eq('article_id', articleId)
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      return jsonResponse(
        {
          success: true,
          articleId,
          ratings: {
            average,
            total: count,
            distribution,
          },
          votes: {
            helpful: voteCounts.helpful,
            notHelpful: voteCounts.not_helpful,
            outdated: voteCounts.outdated,
            inaccurate: voteCounts.inaccurate,
          },
          recentReviews: reviews ?? [],
        },
        200,
        req,
        requestId,
      );
    }

    // DELETE /ratings/:ratingId
    if (method === 'DELETE' && sub && !sub2) {
      const { data: existing } = await db
        .from('article_ratings')
        .select('id')
        .eq('id', sub)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        return jsonResponse({ success: false, message: 'Rating not found' }, 404, req, requestId);
      }

      const { error } = await db.from('article_ratings').delete().eq('id', sub);
      if (error) {
        return errorResponse(500, 'Failed to delete rating', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(
        { success: true, message: 'Rating deleted successfully' },
        200,
        req,
        requestId,
      );
    }

    return null;
  }

  // ─── Votes ───────────────────────────────────────────────────────────────

  if (resource === 'votes') {
    // GET /votes/user/:articleId
    if (method === 'GET' && sub === 'user' && sub2) {
      const { data, error } = await db
        .from('article_votes')
        .select('*')
        .eq('user_id', userId)
        .eq('article_id', sub2)
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to fetch user vote', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }

      return jsonResponse(
        { success: true, vote: data ?? null, hasVoted: !!data },
        200,
        req,
        requestId,
      );
    }

    // POST /votes — submit or update
    if (method === 'POST' && !sub) {
      let body: { articleId?: string; voteType?: string; comment?: string } = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      if (!body.articleId || !body.voteType) {
        return errorResponse(400, 'Article ID and vote type are required', req, {
          code: 'VALIDATION',
          requestId,
        });
      }
      if (!VALID_VOTE_TYPES.includes(body.voteType as (typeof VALID_VOTE_TYPES)[number])) {
        return errorResponse(400, 'Invalid vote type', req, {
          code: 'VALIDATION',
          requestId,
        });
      }

      const { data: existing } = await db
        .from('article_votes')
        .select('id, comment')
        .eq('user_id', userId)
        .eq('article_id', body.articleId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await db
          .from('article_votes')
          .update({
            vote_type: body.voteType,
            comment: body.comment ?? existing.comment,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (error) {
          return errorResponse(500, 'Failed to update vote', req, {
            code: 'DB_ERROR',
            details: error.message,
            requestId,
          });
        }
        return jsonResponse(
          { success: true, message: 'Vote updated successfully', vote: data },
          200,
          req,
          requestId,
        );
      }

      const { data, error } = await db
        .from('article_votes')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          article_id: body.articleId,
          vote_type: body.voteType,
          comment: body.comment ?? null,
        })
        .select('*')
        .single();

      if (error) {
        return errorResponse(500, 'Failed to submit vote', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(
        { success: true, message: 'Vote submitted successfully', vote: data },
        201,
        req,
        requestId,
      );
    }

    // DELETE /votes/:voteId
    if (method === 'DELETE' && sub && !sub2) {
      const { data: existing } = await db
        .from('article_votes')
        .select('id')
        .eq('id', sub)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        return jsonResponse({ success: false, message: 'Vote not found' }, 404, req, requestId);
      }

      const { error } = await db.from('article_votes').delete().eq('id', sub);
      if (error) {
        return errorResponse(500, 'Failed to delete vote', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(
        { success: true, message: 'Vote deleted successfully' },
        200,
        req,
        requestId,
      );
    }

    return null;
  }

  return null;
}
