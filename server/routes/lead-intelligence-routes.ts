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
    const intelligence = await leadIntelligenceService.getLeadIntelligence(leadId, context.tenantId);

    res.json(intelligence);
  } catch (error: any) {
    console.error('Get lead intelligence error:', error);
    res.status(500).json({ error: 'Failed to get lead intelligence', message: error.message });
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
    const score = await leadIntelligenceService.calculateLeadScore(leadId, context.tenantId, context.userId);

    res.json({
      success: true,
      score,
    });
  } catch (error: any) {
    console.error('Calculate lead score error:', error);
    res.status(500).json({ error: 'Failed to calculate lead score', message: error.message });
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
    const enrichment = await leadIntelligenceService.enrichLeadFromApollo(leadId, context.tenantId, context.userId);

    res.json({
      success: true,
      enrichment,
    });
  } catch (error: any) {
    console.error('Enrich lead error:', error);
    res.status(500).json({ error: 'Failed to enrich lead', message: error.message });
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
    const result = await leadIntelligenceService.processNewLead(leadId, context.tenantId, context.userId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Process lead error:', error);
    res.status(500).json({ error: 'Failed to process lead', message: error.message });
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
    const result = await leadIntelligenceService.batchProcessLeads(leadIds, context.tenantId, context.userId);

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Batch score error:', error);
    res.status(500).json({ error: 'Failed to batch score leads', message: error.message });
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
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics', message: error.message });
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
    console.error('Get attention required error:', error);
    res.status(500).json({ error: 'Failed to get leads requiring attention', message: error.message });
  }
});

export default router;
