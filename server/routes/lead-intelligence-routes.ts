/**
 * Lead Intelligence API Routes
 *
 * Provides unified endpoints for lead scoring, enrichment, and intelligence.
 * Integrates Lead Scoring, Apollo.io, and Salesforce functionality.
 */

import express, { Request, Response } from 'express';
import { isAuthenticated } from '../replitAuth';
import { leadIntelligenceService } from '../services/lead-intelligence-service';
import { z } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('lead-intelligence-routes');

const router = express.Router();

// Middleware to get tenant and user context
function getTenantContext(req: Request): { tenantId: string; userId: string } | null {
  const user = (req as any).user || req.session?.user;
  if (!user?.tenantId) return null;
  return {
    tenantId: user.tenantId,
    userId: user.id || user.claims?.sub,
  };
}

/**
 * GET /api/lead-intelligence/:leadId
 * Get comprehensive lead intelligence including score, enrichment, and history
 */
router.get('/:leadId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    if (!context) {
      return res.status(403).json({ error: 'No tenant context found' });
    }

    const { leadId } = req.params;
    const intelligence = await leadIntelligenceService.getLeadIntelligence(
      leadId,
      context.tenantId,
    );

    res.json(intelligence);
  } catch (error: any) {
    log.error('Get lead intelligence error:', error);
    res.status(500).json({ error: 'Failed to get lead intelligence' });
  }
});

/**
 * POST /api/lead-intelligence/:leadId/score
 * Calculate or recalculate lead score
 */
router.post('/:leadId/score', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    if (!context) {
      return res.status(403).json({ error: 'No tenant context found' });
    }

    const { leadId } = req.params;
    const score = await leadIntelligenceService.calculateLeadScore(
      leadId,
      context.tenantId,
      context.userId,
    );

    res.json({
      success: true,
      score,
    });
  } catch (error: any) {
    log.error('Calculate lead score error:', error);
    res.status(500).json({ error: 'Failed to calculate lead score' });
  }
});

/**
 * POST /api/lead-intelligence/:leadId/enrich
 * Enrich lead from Apollo.io
 */
router.post('/:leadId/enrich', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    if (!context) {
      return res.status(403).json({ error: 'No tenant context found' });
    }

    const { leadId } = req.params;
    const enrichment = await leadIntelligenceService.enrichLeadFromApollo(
      leadId,
      context.tenantId,
      context.userId,
    );

    res.json({
      success: true,
      enrichment,
    });
  } catch (error: any) {
    log.error('Enrich lead error:', error);
    res.status(500).json({ error: 'Failed to enrich lead' });
  }
});

/**
 * POST /api/lead-intelligence/:leadId/process
 * Full lead processing: enrich + score (used on lead creation)
 */
router.post('/:leadId/process', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    if (!context) {
      return res.status(403).json({ error: 'No tenant context found' });
    }

    const { leadId } = req.params;
    const result = await leadIntelligenceService.processNewLead(
      leadId,
      context.tenantId,
      context.userId,
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    log.error('Process lead error:', error);
    res.status(500).json({ error: 'Failed to process lead' });
  }
});

/**
 * POST /api/lead-intelligence/batch/score
 * Batch score multiple leads
 */
router.post('/batch/score', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    if (!context) {
      return res.status(403).json({ error: 'No tenant context found' });
    }

    const schema = z.object({
      leadIds: z.array(z.string()).min(1).max(100),
    });

    const { leadIds } = schema.parse(req.body);
    const result = await leadIntelligenceService.batchProcessLeads(
      leadIds,
      context.tenantId,
      context.userId,
    );

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    log.error('Batch score error:', error);
    res.status(500).json({ error: 'Failed to batch score leads' });
  }
});

/**
 * GET /api/lead-intelligence/analytics/overview
 * Get lead scoring analytics and dashboard data
 */
router.get('/analytics/overview', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    if (!context) {
      return res.status(403).json({ error: 'No tenant context found' });
    }

    const analytics = await leadIntelligenceService.getScoringAnalytics(context.tenantId);

    res.json(analytics);
  } catch (error: any) {
    log.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

/**
 * GET /api/lead-intelligence/attention/required
 * Get leads that require immediate attention (hot leads)
 */
router.get('/attention/required', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    if (!context) {
      return res.status(403).json({ error: 'No tenant context found' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const leads = await leadIntelligenceService.getLeadsRequiringAttention(context.tenantId, limit);

    res.json(leads);
  } catch (error: any) {
    log.error('Get attention required error:', error);
    res
      .status(500)
      .json({ error: 'Failed to get leads requiring attention' });
  }
});

export default router;
