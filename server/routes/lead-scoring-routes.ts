import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('lead-scoring-routes');

import {
  insertLeadScoringRuleSchema,
  insertBantQualificationSchema,
  insertLeadEngagementTrackingSchema,
} from '@shared/lead-scoring-schema';

const router = express.Router();

// Helper function to check if user has admin/manager role
function isAdminOrManager(user: any): boolean {
  if (!user?.role) return false;
  const role = user.role || '';
  const roleLower = role.toLowerCase();
  return (
    roleLower.includes('admin') || roleLower.includes('manager') || roleLower.includes('executive')
  );
}

// Helper function to check if user can manage scoring rules
function canManageScoringRules(user: any): boolean {
  return isAdminOrManager(user);
}

// ==================== Lead Scoring Rules Management ====================

// POST /api/lead-scoring/rules - Create a new scoring rule (Admin/Manager only)
router.post('/rules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role
  if (!canManageScoringRules(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to manage scoring rules' });
  }

  try {
    const data = insertLeadScoringRuleSchema.parse(req.body);
    const rule = await storage.createLeadScoringRule({
      ...data,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    log.error('Create scoring rule error:', error);
    res.status(500).json({ error: 'Failed to create scoring rule' });
  }
});

// GET /api/lead-scoring/rules - Get all scoring rules
router.get('/rules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { category } = req.query;
    const rules = await storage.getLeadScoringRules(user.tenantId, category as string);
    res.json(rules);
  } catch (error) {
    log.error('Get scoring rules error:', error);
    res.status(500).json({ error: 'Failed to fetch scoring rules' });
  }
});

// GET /api/lead-scoring/rules/active - Get only active scoring rules
router.get('/rules/active', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rules = await storage.getActiveLeadScoringRules(user.tenantId);
    res.json(rules);
  } catch (error) {
    log.error('Get active scoring rules error:', error);
    res.status(500).json({ error: 'Failed to fetch active scoring rules' });
  }
});

// GET /api/lead-scoring/rules/:id - Get a specific scoring rule
router.get('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rule = await storage.getLeadScoringRule(req.params.id);
    if (!rule || rule.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Scoring rule not found' });
    }

    res.json(rule);
  } catch (error) {
    log.error('Get scoring rule error:', error);
    res.status(500).json({ error: 'Failed to fetch scoring rule' });
  }
});

// PUT /api/lead-scoring/rules/:id - Update a scoring rule (Admin/Manager only)
router.put('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role
  if (!canManageScoringRules(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to manage scoring rules' });
  }

  try {
    const existing = await storage.getLeadScoringRule(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Scoring rule not found' });
    }

    const data = insertLeadScoringRuleSchema.partial().parse(req.body);
    const rule = await storage.updateLeadScoringRule(req.params.id, data);

    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    log.error('Update scoring rule error:', error);
    res.status(500).json({ error: 'Failed to update scoring rule' });
  }
});

// DELETE /api/lead-scoring/rules/:id - Delete a scoring rule (Admin/Manager only)
router.delete('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role
  if (!canManageScoringRules(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to manage scoring rules' });
  }

  try {
    const rule = await storage.getLeadScoringRule(req.params.id);
    if (!rule || rule.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Scoring rule not found' });
    }

    await storage.deleteLeadScoringRule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    log.error('Delete scoring rule error:', error);
    res.status(500).json({ error: 'Failed to delete scoring rule' });
  }
});

// ==================== Lead Score Calculation ====================

// POST /api/lead-scoring/calculate/:leadId - Calculate score for a lead
router.post('/calculate/:leadId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;

    // Get the lead to verify access
    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get active scoring rules
    const rules = await storage.getActiveLeadScoringRules(user.tenantId);

    // Initialize score components
    let demographicScore = 0;
    let firmographicScore = 0;
    let behavioralScore = 0;
    let engagementScore = 0;
    let bantScore = 0;

    const appliedRules: string[] = [];
    const startTime = Date.now();

    // Clear previous scoring factors for this lead
    await storage.deleteLeadScoringFactors(leadId);

    // Apply each scoring rule
    for (const rule of rules) {
      let ruleMatches = false;

      // Get the field value from the lead
      const fieldValue = (lead as any)[rule.field];

      // Evaluate the rule operator
      switch (rule.operator) {
        case 'equals':
          ruleMatches = fieldValue === rule.value;
          break;
        case 'not_equals':
          ruleMatches = fieldValue !== rule.value;
          break;
        case 'greater_than':
          ruleMatches = Number(fieldValue) > Number(rule.value);
          break;
        case 'less_than':
          ruleMatches = Number(fieldValue) < Number(rule.value);
          break;
        case 'greater_than_or_equal':
          ruleMatches = Number(fieldValue) >= Number(rule.value);
          break;
        case 'less_than_or_equal':
          ruleMatches = Number(fieldValue) <= Number(rule.value);
          break;
        case 'contains':
          ruleMatches = String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
          break;
        case 'in_list':
          ruleMatches = Array.isArray(rule.value) && rule.value.includes(fieldValue);
          break;
        case 'is_null':
          ruleMatches = fieldValue === null || fieldValue === undefined;
          break;
        case 'is_not_null':
          ruleMatches = fieldValue !== null && fieldValue !== undefined;
          break;
      }

      // Award points if rule matches
      if (ruleMatches) {
        appliedRules.push(rule.id);

        // Track scoring factor
        await storage.createLeadScoringFactor({
          leadId,
          ruleId: rule.id,
          tenantId: user.tenantId,
          factorName: rule.ruleName,
          factorCategory: rule.category,
          pointsAwarded: rule.scorePoints,
          evaluatedField: rule.field,
          evaluatedValue: fieldValue,
          ruleCondition: { operator: rule.operator, value: rule.value },
        });

        // Add points to appropriate category
        switch (rule.category) {
          case 'demographic':
            demographicScore += rule.scorePoints;
            break;
          case 'firmographic':
            firmographicScore += rule.scorePoints;
            break;
          case 'behavioral':
            behavioralScore += rule.scorePoints;
            break;
          case 'engagement':
            engagementScore += rule.scorePoints;
            break;
          case 'bant':
            bantScore += rule.scorePoints;
            break;
        }
      }
    }

    // Get BANT score if exists
    const bantQualification = await storage.getBantQualification(leadId);
    if (bantQualification) {
      bantScore = bantQualification.totalBantScore;
    }

    // Get engagement score from tracking
    const recentEngagementScore = await storage.getEngagementScore(leadId, 30);
    engagementScore += recentEngagementScore;

    // Cap individual components at reasonable maxes
    demographicScore = Math.min(demographicScore, 20);
    firmographicScore = Math.min(firmographicScore, 20);
    behavioralScore = Math.min(behavioralScore, 20);
    engagementScore = Math.min(engagementScore, 20);
    bantScore = Math.min(bantScore, 25);

    // Calculate total score (0-100)
    const totalScore =
      demographicScore + firmographicScore + behavioralScore + engagementScore + bantScore * 0.8;
    const cappedTotalScore = Math.min(Math.round(totalScore), 100);

    // Determine lead grade
    let leadGrade: string;
    if (cappedTotalScore >= 90) leadGrade = 'A+';
    else if (cappedTotalScore >= 80) leadGrade = 'A';
    else if (cappedTotalScore >= 70) leadGrade = 'B+';
    else if (cappedTotalScore >= 60) leadGrade = 'B';
    else if (cappedTotalScore >= 50) leadGrade = 'C+';
    else if (cappedTotalScore >= 40) leadGrade = 'C';
    else leadGrade = 'D';

    // Determine lead tier
    let leadTier: string;
    if (cappedTotalScore >= 75) leadTier = 'hot';
    else if (cappedTotalScore >= 50) leadTier = 'warm';
    else leadTier = 'cold';

    // Determine recommended action
    let recommendedAction: string;
    if (cappedTotalScore >= 75) recommendedAction = 'contact_immediately';
    else if (cappedTotalScore >= 50) recommendedAction = 'nurture';
    else if (cappedTotalScore >= 30) recommendedAction = 'request_more_info';
    else recommendedAction = 'disqualify';

    // Get previous score for comparison
    const previousCalculation = await storage.getLatestLeadScore(leadId);
    const previousScore = previousCalculation?.totalScore || 0;
    const scoreChange = cappedTotalScore - previousScore;

    // Save calculation
    const calculation = await storage.createLeadScoreCalculation({
      leadId,
      tenantId: user.tenantId,
      demographicScore,
      firmographicScore,
      behavioralScore,
      engagementScore,
      bantScore: Math.round(bantScore),
      totalScore: cappedTotalScore,
      previousScore,
      scoreChange,
      leadGrade,
      leadTier,
      predictionScore: null,
      confidenceLevel: 'medium',
      recommendedAction,
      calculationMethod: 'rule_based',
      rulesApplied: appliedRules,
      calculationDuration: Date.now() - startTime,
    });

    // Update lead score in business_records
    await storage.updateBusinessRecord(leadId, {
      leadScore: cappedTotalScore,
      priority: leadTier === 'hot' ? 'high' : leadTier === 'warm' ? 'medium' : 'low',
    });

    res.json({
      calculation,
      factors: await storage.getLeadScoringFactors(leadId),
    });
  } catch (error) {
    log.error('Calculate lead score error:', error);
    res.status(500).json({ error: 'Failed to calculate lead score' });
  }
});

// GET /api/lead-scoring/score/:leadId - Get latest score for a lead
router.get('/score/:leadId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;

    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const score = await storage.getLatestLeadScore(leadId);
    if (!score) {
      return res.status(404).json({ error: 'No score calculated for this lead' });
    }

    const factors = await storage.getLeadScoringFactors(leadId);

    res.json({
      score,
      factors,
    });
  } catch (error) {
    log.error('Get lead score error:', error);
    res.status(500).json({ error: 'Failed to fetch lead score' });
  }
});

// GET /api/lead-scoring/score/:leadId/history - Get score history for a lead
router.get('/score/:leadId/history', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const history = await storage.getLeadScoreHistory(leadId, limit);
    res.json(history);
  } catch (error) {
    log.error('Get lead score history error:', error);
    res.status(500).json({ error: 'Failed to fetch lead score history' });
  }
});

// GET /api/lead-scoring/leaderboard - Get top scored leads
router.get('/leaderboard', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const topLeads = await storage.getTopScoredLeads(user.tenantId, limit);

    // Enrich with lead details
    const enrichedLeads = await Promise.all(
      topLeads.map(async (score) => {
        const lead = await storage.getBusinessRecord(score.leadId);
        return {
          ...score,
          lead: lead
            ? {
                id: lead.id,
                companyName: lead.companyName,
                status: lead.status,
                ownerId: lead.ownerId,
              }
            : null,
        };
      }),
    );

    res.json(enrichedLeads);
  } catch (error) {
    log.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/lead-scoring/grade/:grade - Get leads by grade
router.get('/grade/:grade', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { grade } = req.params;
    const leads = await storage.getLeadsByGrade(user.tenantId, grade);

    // Enrich with lead details
    const enrichedLeads = await Promise.all(
      leads.map(async (score) => {
        const lead = await storage.getBusinessRecord(score.leadId);
        return {
          ...score,
          lead: lead
            ? {
                id: lead.id,
                companyName: lead.companyName,
                status: lead.status,
                ownerId: lead.ownerId,
              }
            : null,
        };
      }),
    );

    res.json(enrichedLeads);
  } catch (error) {
    log.error('Get leads by grade error:', error);
    res.status(500).json({ error: 'Failed to fetch leads by grade' });
  }
});

// ==================== BANT Qualification ====================

// POST /api/lead-scoring/bant/:leadId - Create or update BANT qualification
router.post('/bant/:leadId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;

    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const data = insertBantQualificationSchema.parse(req.body);

    // Calculate individual component scores based on the data
    const budgetScore = data.budgetIdentified ? (data.budgetApproved ? 25 : 15) : 0;
    const authorityScore = data.decisionMakerIdentified ? 25 : 0;
    const needScore = data.needIdentified
      ? data.needUrgency === 'critical'
        ? 25
        : data.needUrgency === 'high'
          ? 20
          : 15
      : 0;
    const timelineScore = data.timelineIdentified
      ? data.decisionTimeline === 'immediate'
        ? 25
        : data.decisionTimeline === '30_days'
          ? 20
          : 15
      : 0;

    const totalBantScore = budgetScore + authorityScore + needScore + timelineScore;

    let qualificationStatus: string;
    if (totalBantScore >= 75) qualificationStatus = 'highly_qualified';
    else if (totalBantScore >= 50) qualificationStatus = 'qualified';
    else if (totalBantScore >= 25) qualificationStatus = 'partially_qualified';
    else qualificationStatus = 'unqualified';

    const qualificationData = {
      ...data,
      leadId,
      tenantId: user.tenantId,
      budgetScore,
      authorityScore,
      needScore,
      timelineScore,
      totalBantScore,
      qualificationStatus,
      assessedBy: user.id,
      lastAssessedAt: new Date(),
      qualifiedDate:
        qualificationStatus === 'qualified' || qualificationStatus === 'highly_qualified'
          ? new Date()
          : null,
    };

    // Check if BANT already exists
    const existing = await storage.getBantQualification(leadId);
    let qualification;

    if (existing) {
      qualification = await storage.updateBantQualification(leadId, qualificationData);
    } else {
      qualification = await storage.createBantQualification(qualificationData);
    }

    // Track qualification status change
    if (existing && existing.qualificationStatus !== qualificationStatus) {
      await storage.createLeadQualificationHistory({
        leadId,
        tenantId: user.tenantId,
        previousStatus: existing.qualificationStatus,
        newStatus: qualificationStatus,
        statusReason: 'BANT assessment updated',
        scoreAtChange: totalBantScore,
        bantScoreAtChange: totalBantScore,
        changedBy: user.id,
        changeReason: 'bant_assessment',
      });
    }

    res.json(qualification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    log.error('Create/update BANT qualification error:', error);
    res.status(500).json({ error: 'Failed to save BANT qualification' });
  }
});

// GET /api/lead-scoring/bant/:leadId - Get BANT qualification for a lead
router.get('/bant/:leadId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;

    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const qualification = await storage.getBantQualification(leadId);
    if (!qualification) {
      return res.status(404).json({ error: 'No BANT qualification found for this lead' });
    }

    res.json(qualification);
  } catch (error) {
    log.error('Get BANT qualification error:', error);
    res.status(500).json({ error: 'Failed to fetch BANT qualification' });
  }
});

// GET /api/lead-scoring/qualified - Get qualified leads
router.get('/qualified', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const minScore = parseInt(req.query.minScore as string) || 50;
    const qualifiedLeads = await storage.getQualifiedLeads(user.tenantId, minScore);

    // Enrich with lead details
    const enrichedLeads = await Promise.all(
      qualifiedLeads.map(async (qualification) => {
        const lead = await storage.getBusinessRecord(qualification.leadId);
        return {
          ...qualification,
          lead: lead
            ? {
                id: lead.id,
                companyName: lead.companyName,
                status: lead.status,
                ownerId: lead.ownerId,
              }
            : null,
        };
      }),
    );

    res.json(enrichedLeads);
  } catch (error) {
    log.error('Get qualified leads error:', error);
    res.status(500).json({ error: 'Failed to fetch qualified leads' });
  }
});

// ==================== Engagement Tracking ====================

// POST /api/lead-scoring/engagement/:leadId - Track engagement
router.post('/engagement/:leadId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;

    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const data = insertLeadEngagementTrackingSchema.parse(req.body);
    const engagement = await storage.createLeadEngagement({
      ...data,
      leadId,
      tenantId: user.tenantId,
      userId: user.id,
    });

    res.json(engagement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    log.error('Track engagement error:', error);
    res.status(500).json({ error: 'Failed to track engagement' });
  }
});

// GET /api/lead-scoring/engagement/:leadId - Get engagement history for a lead
router.get('/engagement/:leadId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const engagements = await storage.getLeadEngagements(leadId, limit);
    res.json(engagements);
  } catch (error) {
    log.error('Get engagement history error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement history' });
  }
});

// ==================== Analytics & Reporting ====================

// GET /api/lead-scoring/analytics - Get lead scoring analytics (Admin/Manager only)
router.get('/analytics', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role for analytics
  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to view analytics' });
  }

  try {
    const analytics = await storage.getLeadScoringAnalytics(user.tenantId);
    res.json(analytics);
  } catch (error) {
    log.error('Get lead scoring analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/lead-scoring/bant-analytics - Get BANT analytics (Admin/Manager only)
router.get('/bant-analytics', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role for analytics
  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to view analytics' });
  }

  try {
    const analytics = await storage.getBantAnalytics(user.tenantId);
    res.json(analytics);
  } catch (error) {
    log.error('Get BANT analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch BANT analytics' });
  }
});

// GET /api/lead-scoring/qualification-history/:leadId - Get qualification status changes
router.get('/qualification-history/:leadId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { leadId } = req.params;

    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const history = await storage.getLeadQualificationHistory(leadId);
    res.json(history);
  } catch (error) {
    log.error('Get qualification history error:', error);
    res.status(500).json({ error: 'Failed to fetch qualification history' });
  }
});

export default router;
