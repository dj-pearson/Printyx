/**
 * Content Gap Analysis API Routes
 *
 * AI-powered analysis endpoints for identifying missing content in knowledge base
 */

import { Router, Request, Response } from 'express';
import ContentGapAnalysisService from '../services/content-gap-analysis-service';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Middleware to require admin role
const requireAdmin = (req: Request, res: Response, next: Function) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const userRole = (req.session as any).role || 'guest';
  const adminRoles = ['platform_admin', 'super_admin', 'admin'];
  if (!adminRoles.includes(userRole)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Helper to get tenant ID
const getTenantId = (req: Request): string => {
  return (
    (req as any).tenantId || (req.session as any).tenantId || '00000000-0000-0000-0000-000000000000'
  );
};

/**
 * GET /api/content-gap-analysis
 * Generate comprehensive content gap analysis report
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    console.log('🔍 Generating content gap analysis for tenant:', tenantId);

    const report = await ContentGapAnalysisService.generateAnalysis(tenantId);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Content gap analysis failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content gap analysis',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/content-gap-analysis/summary
 * Get quick summary of content gaps
 */
router.get('/summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    const report = await ContentGapAnalysisService.generateAnalysis(tenantId);

    res.json({
      success: true,
      summary: {
        totalGaps: report.totalGaps,
        criticalGaps: report.criticalGaps,
        highPriorityGaps: report.highPriorityGaps,
        topGaps: report.gaps.slice(0, 10),
        categoryHealth: report.categoryHealth,
        topRecommendations: report.recommendations.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Content gap summary failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content gap summary',
    });
  }
});

/**
 * GET /api/content-gap-analysis/category/:categorySlug
 * Get content gaps for specific category
 */
router.get(
  '/category/:categorySlug',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { categorySlug } = req.params;

      const report = await ContentGapAnalysisService.generateAnalysis(tenantId);

      // Filter gaps for this category
      const categoryGaps = report.gaps.filter(gap =>
        gap.category.toLowerCase().replace(/_/g, '-') === categorySlug.toLowerCase()
      );

      const categoryHealth = report.categoryHealth[categorySlug] || {
        articleCount: 0,
        coverageScore: 0,
        missingTopics: [],
      };

      res.json({
        success: true,
        category: categorySlug,
        gaps: categoryGaps,
        health: categoryHealth,
        totalGaps: categoryGaps.length,
      });
    } catch (error) {
      console.error('Category content gap analysis failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze category content gaps',
      });
    }
  }
);

/**
 * GET /api/content-gap-analysis/priorities
 * Get gaps organized by priority level
 */
router.get('/priorities', requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    const report = await ContentGapAnalysisService.generateAnalysis(tenantId);

    const byPriority = {
      critical: report.gaps.filter(g => g.priority === 'critical'),
      high: report.gaps.filter(g => g.priority === 'high'),
      medium: report.gaps.filter(g => g.priority === 'medium'),
      low: report.gaps.filter(g => g.priority === 'low'),
    };

    res.json({
      success: true,
      priorities: byPriority,
      counts: {
        critical: byPriority.critical.length,
        high: byPriority.high.length,
        medium: byPriority.medium.length,
        low: byPriority.low.length,
      },
    });
  } catch (error) {
    console.error('Priority-based content gap analysis failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze content gaps by priority',
    });
  }
});

/**
 * POST /api/content-gap-analysis/refresh
 * Manually trigger a fresh analysis (cache-busting)
 */
router.post('/refresh', requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    console.log('🔄 Refreshing content gap analysis for tenant:', tenantId);

    // Force fresh analysis
    const report = await ContentGapAnalysisService.generateAnalysis(tenantId);

    res.json({
      success: true,
      message: 'Content gap analysis refreshed successfully',
      report,
    });
  } catch (error) {
    console.error('Content gap refresh failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh content gap analysis',
    });
  }
});

export default router;
