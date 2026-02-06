/**
 * Article Ratings and Voting API Routes
 *
 * Endpoints for rating articles and tracking helpful/not helpful votes
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('article-ratings-routes');

import {
  articleRatings,
  articleVotes,
  knowledgeArticles,
  readingHistory,
} from '../../shared/knowledge-base-schema';
import { eq, and, desc, sql, avg, count } from 'drizzle-orm';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Helper to get tenant ID
const getTenantId = (req: Request): string => {
  return (
    (req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
  );
};

// Helper to get user ID
const getUserId = (req: Request): string => {
  return req.session?.userId || (req.session as any).user?.id || '';
};

/**
 * GET /api/knowledge-base/ratings/:articleId
 * Get rating summary for an article
 */
router.get('/:articleId', async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    const tenantId = getTenantId(req);

    // Get rating statistics
    const [stats] = await db
      .select({
        averageRating: avg(articleRatings.rating),
        totalRatings: count(articleRatings.id),
        fiveStarCount: sql<number>`count(*) filter (where ${articleRatings.rating} = 5)`,
        fourStarCount: sql<number>`count(*) filter (where ${articleRatings.rating} = 4)`,
        threeStarCount: sql<number>`count(*) filter (where ${articleRatings.rating} = 3)`,
        twoStarCount: sql<number>`count(*) filter (where ${articleRatings.rating} = 2)`,
        oneStarCount: sql<number>`count(*) filter (where ${articleRatings.rating} = 1)`,
      })
      .from(articleRatings)
      .where(and(eq(articleRatings.articleId, articleId), eq(articleRatings.tenantId, tenantId)));

    // Get vote statistics
    const [voteStats] = await db
      .select({
        helpfulCount: sql<number>`count(*) filter (where ${articleVotes.voteType} = 'helpful')`,
        notHelpfulCount: sql<number>`count(*) filter (where ${articleVotes.voteType} = 'not_helpful')`,
        outdatedCount: sql<number>`count(*) filter (where ${articleVotes.voteType} = 'outdated')`,
        inaccurateCount: sql<number>`count(*) filter (where ${articleVotes.voteType} = 'inaccurate')`,
      })
      .from(articleVotes)
      .where(and(eq(articleVotes.articleId, articleId), eq(articleVotes.tenantId, tenantId)));

    // Get recent reviews (ratings with comments)
    const recentReviews = await db
      .select({
        id: articleRatings.id,
        rating: articleRatings.rating,
        comment: articleRatings.comment,
        verifiedReader: articleRatings.verifiedReader,
        helpfulCount: articleRatings.helpfulCount,
        createdAt: articleRatings.createdAt,
      })
      .from(articleRatings)
      .where(
        and(
          eq(articleRatings.articleId, articleId),
          eq(articleRatings.tenantId, tenantId),
          sql`${articleRatings.comment} IS NOT NULL`,
        ),
      )
      .orderBy(desc(articleRatings.createdAt))
      .limit(10);

    res.json({
      success: true,
      articleId,
      ratings: {
        average: stats.averageRating ? Number(Number(stats.averageRating).toFixed(1)) : 0,
        total: stats.totalRatings || 0,
        distribution: {
          5: stats.fiveStarCount || 0,
          4: stats.fourStarCount || 0,
          3: stats.threeStarCount || 0,
          2: stats.twoStarCount || 0,
          1: stats.oneStarCount || 0,
        },
      },
      votes: {
        helpful: voteStats.helpfulCount || 0,
        notHelpful: voteStats.notHelpfulCount || 0,
        outdated: voteStats.outdatedCount || 0,
        inaccurate: voteStats.inaccurateCount || 0,
      },
      recentReviews,
    });
  } catch (error) {
    log.error('Error fetching article ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article ratings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/knowledge-base/ratings
 * Submit a rating for an article
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { articleId, rating, comment, ratingType = 'overall' } = req.body;

    if (!articleId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Article ID and rating are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Check if user completed reading (for verified reader badge)
    const completedReading = await db
      .select()
      .from(readingHistory)
      .where(
        and(
          eq(readingHistory.userId, userId),
          eq(readingHistory.articleId, articleId),
          eq(readingHistory.completed, true),
        ),
      )
      .limit(1);

    const verifiedReader = completedReading.length > 0;

    // Check if rating already exists
    const existing = await db
      .select()
      .from(articleRatings)
      .where(
        and(
          eq(articleRatings.userId, userId),
          eq(articleRatings.articleId, articleId),
          eq(articleRatings.ratingType, ratingType),
        ),
      )
      .limit(1);

    let result;

    if (existing.length > 0) {
      // Update existing rating
      const [updated] = await db
        .update(articleRatings)
        .set({
          rating,
          comment: comment || existing[0].comment,
          verifiedReader,
          updatedAt: new Date(),
        })
        .where(eq(articleRatings.id, existing[0].id))
        .returning();

      result = updated;
    } else {
      // Create new rating
      const [created] = await db
        .insert(articleRatings)
        .values({
          tenantId,
          userId,
          articleId,
          rating,
          ratingType,
          comment: comment || null,
          verifiedReader,
        })
        .returning();

      result = created;
    }

    res.json({
      success: true,
      message:
        existing.length > 0 ? 'Rating updated successfully' : 'Rating submitted successfully',
      rating: result,
    });
  } catch (error) {
    log.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge-base/ratings/user/:articleId
 * Get user's rating for a specific article
 */
router.get('/user/:articleId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { articleId } = req.params;
    const { ratingType = 'overall' } = req.query;

    const rating = await db
      .select()
      .from(articleRatings)
      .where(
        and(
          eq(articleRatings.userId, userId),
          eq(articleRatings.articleId, articleId),
          eq(articleRatings.ratingType, ratingType as string),
        ),
      )
      .limit(1);

    res.json({
      success: true,
      rating: rating[0] || null,
      hasRated: rating.length > 0,
    });
  } catch (error) {
    log.error('Error fetching user rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user rating',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/knowledge-base/votes
 * Submit a vote for an article
 */
router.post('/votes', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { articleId, voteType, comment } = req.body;

    if (!articleId || !voteType) {
      return res.status(400).json({
        success: false,
        message: 'Article ID and vote type are required',
      });
    }

    const validVoteTypes = ['helpful', 'not_helpful', 'outdated', 'inaccurate'];
    if (!validVoteTypes.includes(voteType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vote type',
      });
    }

    // Check if vote already exists
    const existing = await db
      .select()
      .from(articleVotes)
      .where(and(eq(articleVotes.userId, userId), eq(articleVotes.articleId, articleId)))
      .limit(1);

    let result;

    if (existing.length > 0) {
      // Update existing vote
      const [updated] = await db
        .update(articleVotes)
        .set({
          voteType,
          comment: comment || existing[0].comment,
          updatedAt: new Date(),
        })
        .where(eq(articleVotes.id, existing[0].id))
        .returning();

      result = updated;
    } else {
      // Create new vote
      const [created] = await db
        .insert(articleVotes)
        .values({
          tenantId,
          userId,
          articleId,
          voteType,
          comment: comment || null,
        })
        .returning();

      result = created;
    }

    res.json({
      success: true,
      message: existing.length > 0 ? 'Vote updated successfully' : 'Vote submitted successfully',
      vote: result,
    });
  } catch (error) {
    log.error('Error submitting vote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit vote',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge-base/votes/user/:articleId
 * Get user's vote for a specific article
 */
router.get('/votes/user/:articleId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { articleId } = req.params;

    const vote = await db
      .select()
      .from(articleVotes)
      .where(and(eq(articleVotes.userId, userId), eq(articleVotes.articleId, articleId)))
      .limit(1);

    res.json({
      success: true,
      vote: vote[0] || null,
      hasVoted: vote.length > 0,
    });
  } catch (error) {
    log.error('Error fetching user vote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user vote',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/knowledge-base/ratings/:ratingId
 * Delete a rating
 */
router.delete('/:ratingId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { ratingId } = req.params;

    // Verify ownership
    const existing = await db
      .select()
      .from(articleRatings)
      .where(and(eq(articleRatings.id, ratingId), eq(articleRatings.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found',
      });
    }

    await db.delete(articleRatings).where(eq(articleRatings.id, ratingId));

    res.json({
      success: true,
      message: 'Rating deleted successfully',
    });
  } catch (error) {
    log.error('Error deleting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rating',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/knowledge-base/votes/:voteId
 * Delete a vote
 */
router.delete('/votes/:voteId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { voteId } = req.params;

    // Verify ownership
    const existing = await db
      .select()
      .from(articleVotes)
      .where(and(eq(articleVotes.id, voteId), eq(articleVotes.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vote not found',
      });
    }

    await db.delete(articleVotes).where(eq(articleVotes.id, voteId));

    res.json({
      success: true,
      message: 'Vote deleted successfully',
    });
  } catch (error) {
    log.error('Error deleting vote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vote',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
