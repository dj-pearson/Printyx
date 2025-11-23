/**
 * PLATFORM CUSTOMER SUCCESS API ROUTES
 *
 * Manages customer health scoring, churn prediction, and success interventions.
 * Enables proactive customer success management at the platform level.
 *
 * Features:
 * - Customer health score calculation
 * - Churn prediction and risk assessment
 * - Success intervention management
 * - Renewal opportunity tracking
 * - At-risk tenant identification
 * - Success metrics and analytics
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import {
  platformHealthScores,
  platformChurnPredictions,
  platformSuccessInterventions,
  platformRenewalOpportunities,
  platformBusinessRecords,
  platformActivities,
  type PlatformHealthScore,
  type NewPlatformHealthScore,
  type PlatformChurnPrediction,
  type NewPlatformChurnPrediction,
  type PlatformSuccessIntervention,
  type NewPlatformSuccessIntervention,
} from '@shared/schema';
import { eq, and, or, inArray, gte, lte, desc, asc, sql, SQL } from 'drizzle-orm';
import { requireRootAdmin } from './routes-root-admin';

const router = Router();

// All routes require root admin access
router.use(requireRootAdmin);

// ============================================================================
// HEALTH SCORES
// ============================================================================

/**
 * GET /api/platform-cs/health-scores
 * List health scores with filtering
 */
router.get('/health-scores', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      healthStatus,
      scoreLessThan,
      scoreGreaterThan,
      trend,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions: SQL[] = [];

    if (healthStatus) {
      const statuses = Array.isArray(healthStatus) ? healthStatus : [healthStatus];
      conditions.push(inArray(platformHealthScores.healthStatus, statuses as any));
    }

    if (scoreLessThan) {
      conditions.push(lte(platformHealthScores.overallScore, parseInt(scoreLessThan as string)));
    }

    if (scoreGreaterThan) {
      conditions.push(gte(platformHealthScores.overallScore, parseInt(scoreGreaterThan as string)));
    }

    if (trend) {
      conditions.push(eq(platformHealthScores.trend, trend as string));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch health scores with business record info
    const healthScores = await db.query.platformHealthScores.findMany({
      where: whereClause,
      orderBy: [asc(platformHealthScores.overallScore)], // Lowest scores first (most at-risk)
      limit: limitNum,
      offset: offset,
    });

    // Get associated business records
    const businessRecordIds = healthScores.map(hs => hs.businessRecordId);
    const businessRecords = businessRecordIds.length > 0
      ? await db.query.platformBusinessRecords.findMany({
          where: inArray(platformBusinessRecords.id, businessRecordIds),
        })
      : [];

    // Combine data
    const results = healthScores.map(hs => ({
      ...hs,
      businessRecord: businessRecords.find(br => br.id === hs.businessRecordId),
    }));

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformHealthScores)
      .where(whereClause || sql`true`);

    const totalCount = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      healthScores: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords: totalCount,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching health scores:', error);
    res.status(500).json({
      error: 'Failed to fetch health scores',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/platform-cs/health-scores/:businessRecordId
 * Get health score for a business record
 */
router.get('/health-scores/:businessRecordId', async (req: Request, res: Response) => {
  try {
    const { businessRecordId } = req.params;

    const healthScore = await db.query.platformHealthScores.findFirst({
      where: eq(platformHealthScores.businessRecordId, businessRecordId),
    });

    if (!healthScore) {
      return res.status(404).json({ error: 'Health score not found' });
    }

    res.json(healthScore);
  } catch (error) {
    console.error('Error fetching health score:', error);
    res.status(500).json({
      error: 'Failed to fetch health score',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/platform-cs/health-scores/calculate
 * Calculate or recalculate health score for a business record
 */
router.post('/health-scores/calculate', async (req: Request, res: Response) => {
  try {
    const { businessRecordId } = req.body;

    if (!businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    // Get business record
    const businessRecord = await db.query.platformBusinessRecords.findFirst({
      where: eq(platformBusinessRecords.id, businessRecordId),
    });

    if (!businessRecord) {
      return res.status(404).json({ error: 'Business record not found' });
    }

    // Only calculate for tenants
    if (businessRecord.recordType !== 'tenant') {
      return res.status(400).json({ error: 'Health scores are only for tenants' });
    }

    // Calculate component scores (0-100 each)
    // This is a simplified calculation - in production, you'd pull real data from usage metrics, support tickets, etc.

    // Usage score (based on engagement metrics)
    const usageScore = Math.min(100, (businessRecord.engagementScore || 0));

    // Engagement score (based on activity levels)
    const daysSinceLastActivity = businessRecord.lastEngagementDate
      ? Math.floor((Date.now() - businessRecord.lastEngagementDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    const engagementScore = Math.max(0, 100 - (daysSinceLastActivity * 2)); // Lose 2 points per day of inactivity

    // Adoption score (placeholder - would come from feature usage data)
    const adoptionScore = 70; // Default

    // Support score (placeholder - would come from support ticket metrics)
    const supportScore = 85; // Default (higher is better - fewer issues)

    // Payment score (based on payment history)
    const paymentScore = businessRecord.currentMRR ? 100 : 50; // Full score if paying

    // Satisfaction score (based on NPS/CSAT)
    const satisfactionScore = businessRecord.npsScore
      ? Math.max(0, Math.min(100, ((businessRecord.npsScore + 100) / 2))) // Convert -100 to 100 scale to 0-100
      : 50;

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      (usageScore * 0.2) +
      (engagementScore * 0.2) +
      (adoptionScore * 0.15) +
      (supportScore * 0.15) +
      (paymentScore * 0.2) +
      (satisfactionScore * 0.1)
    );

    // Determine health status
    let healthStatus: 'excellent' | 'healthy' | 'at_risk' | 'critical' | 'churned';
    if (overallScore >= 90) healthStatus = 'excellent';
    else if (overallScore >= 70) healthStatus = 'healthy';
    else if (overallScore >= 50) healthStatus = 'at_risk';
    else healthStatus = 'critical';

    // Determine trend (compared to previous score)
    const previousHealthScore = await db.query.platformHealthScores.findFirst({
      where: eq(platformHealthScores.businessRecordId, businessRecordId),
    });

    let trend: string | null = null;
    if (previousHealthScore) {
      if (overallScore > previousHealthScore.overallScore + 5) trend = 'improving';
      else if (overallScore < previousHealthScore.overallScore - 5) trend = 'declining';
      else trend = 'stable';
    }

    // Identify risk factors
    const riskFactors: string[] = [];
    if (usageScore < 50) riskFactors.push('Low usage');
    if (engagementScore < 50) riskFactors.push('Low engagement');
    if (daysSinceLastActivity > 30) riskFactors.push('No recent activity');
    if (!businessRecord.currentMRR) riskFactors.push('No active subscription');
    if (businessRecord.npsScore && businessRecord.npsScore < 0) riskFactors.push('Negative NPS');

    // Identify strengths
    const strengthFactors: string[] = [];
    if (usageScore >= 80) strengthFactors.push('High usage');
    if (engagementScore >= 80) strengthFactors.push('High engagement');
    if (businessRecord.npsScore && businessRecord.npsScore > 50) strengthFactors.push('High NPS');
    if (businessRecord.currentMRR && Number(businessRecord.currentMRR) > 1000) strengthFactors.push('High-value customer');

    // Generate recommendations
    const recommendations: string[] = [];
    if (overallScore < 70) {
      recommendations.push('Schedule check-in call');
      if (engagementScore < 50) recommendations.push('Send re-engagement campaign');
      if (usageScore < 50) recommendations.push('Offer training session');
    }

    // Upsert health score
    const [healthScore] = await db
      .insert(platformHealthScores)
      .values({
        businessRecordId,
        tenantId: businessRecord.tenantId || undefined,
        overallScore,
        healthStatus,
        trend: trend || undefined,
        usageScore,
        engagementScore,
        adoptionScore,
        supportScore,
        paymentScore,
        satisfactionScore,
        daysSinceLastLogin: daysSinceLastActivity,
        npsScore: businessRecord.npsScore || undefined,
        csatScore: businessRecord.csatScore || undefined,
        riskFactors,
        strengthFactors,
        recommendations,
        calculatedAt: new Date(),
        calculatedBy: req.user?.id || 'system',
        nextCalculationDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      })
      .onConflictDoUpdate({
        target: platformHealthScores.businessRecordId,
        set: {
          overallScore,
          healthStatus,
          trend,
          usageScore,
          engagementScore,
          adoptionScore,
          supportScore,
          paymentScore,
          satisfactionScore,
          daysSinceLastLogin: daysSinceLastActivity,
          npsScore: businessRecord.npsScore || undefined,
          csatScore: businessRecord.csatScore || undefined,
          riskFactors,
          strengthFactors,
          recommendations,
          calculatedAt: new Date(),
          calculatedBy: req.user?.id || 'system',
          nextCalculationDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      })
      .returning();

    // Update business record with health status
    await db
      .update(platformBusinessRecords)
      .set({
        churnRisk: healthStatus === 'critical' ? 'critical' :
                   healthStatus === 'at_risk' ? 'high' :
                   healthStatus === 'healthy' ? 'low' : 'very_low',
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, businessRecordId));

    res.json(healthScore);
  } catch (error) {
    console.error('Error calculating health score:', error);
    res.status(500).json({
      error: 'Failed to calculate health score',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// CHURN PREDICTIONS
// ============================================================================

/**
 * GET /api/platform-cs/churn-predictions
 * List churn predictions with filtering
 */
router.get('/churn-predictions', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      churnRisk,
      daysUntilChurn,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions: SQL[] = [];

    if (churnRisk) {
      const risks = Array.isArray(churnRisk) ? churnRisk : [churnRisk];
      conditions.push(inArray(platformChurnPredictions.churnRisk, risks as any));
    }

    if (daysUntilChurn) {
      conditions.push(lte(platformChurnPredictions.daysUntilChurn, parseInt(daysUntilChurn as string)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const predictions = await db.query.platformChurnPredictions.findMany({
      where: whereClause,
      orderBy: [desc(platformChurnPredictions.churnProbability)], // Highest risk first
      limit: limitNum,
      offset: offset,
    });

    // Get associated business records
    const businessRecordIds = predictions.map(p => p.businessRecordId);
    const businessRecords = businessRecordIds.length > 0
      ? await db.query.platformBusinessRecords.findMany({
          where: inArray(platformBusinessRecords.id, businessRecordIds),
        })
      : [];

    // Combine data
    const results = predictions.map(p => ({
      ...p,
      businessRecord: businessRecords.find(br => br.id === p.businessRecordId),
    }));

    res.json({
      predictions: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching churn predictions:', error);
    res.status(500).json({
      error: 'Failed to fetch churn predictions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/platform-cs/churn-predictions/predict
 * Generate churn prediction for a business record
 */
router.post('/churn-predictions/predict', async (req: Request, res: Response) => {
  try {
    const { businessRecordId } = req.body;

    if (!businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    // Get business record and health score
    const businessRecord = await db.query.platformBusinessRecords.findFirst({
      where: eq(platformBusinessRecords.id, businessRecordId),
    });

    if (!businessRecord || businessRecord.recordType !== 'tenant') {
      return res.status(400).json({ error: 'Invalid business record or not a tenant' });
    }

    const healthScore = await db.query.platformHealthScores.findFirst({
      where: eq(platformHealthScores.businessRecordId, businessRecordId),
    });

    // Simple rule-based churn prediction
    // In production, this would use an ML model
    let churnProbability = 0.0;
    let churnRisk: 'very_low' | 'low' | 'medium' | 'high' | 'critical';

    // Base probability on health score
    if (healthScore) {
      churnProbability = (100 - healthScore.overallScore) / 100;
    } else {
      churnProbability = 0.5; // Unknown health = medium risk
    }

    // Adjust based on other factors
    if (!businessRecord.currentMRR) churnProbability += 0.3;
    if (businessRecord.npsScore && businessRecord.npsScore < 0) churnProbability += 0.2;
    if (businessRecord.lastEngagementDate) {
      const daysSinceEngagement = Math.floor((Date.now() - businessRecord.lastEngagementDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceEngagement > 60) churnProbability += 0.2;
    }

    churnProbability = Math.min(1.0, churnProbability);

    // Determine risk level
    if (churnProbability < 0.2) churnRisk = 'very_low';
    else if (churnProbability < 0.4) churnRisk = 'low';
    else if (churnProbability < 0.6) churnRisk = 'medium';
    else if (churnProbability < 0.8) churnRisk = 'high';
    else churnRisk = 'critical';

    // Estimate days until churn
    const daysUntilChurn = churnRisk === 'critical' ? 30 :
                          churnRisk === 'high' ? 60 :
                          churnRisk === 'medium' ? 90 : 180;

    // Identify risk factors
    const primaryRiskFactors: string[] = [];
    const secondaryRiskFactors: string[] = [];

    if (healthScore && healthScore.overallScore < 50) primaryRiskFactors.push('Low health score');
    if (!businessRecord.currentMRR) primaryRiskFactors.push('No active subscription');
    if (businessRecord.npsScore && businessRecord.npsScore < 0) primaryRiskFactors.push('Negative NPS');
    if (businessRecord.engagementScore && businessRecord.engagementScore < 30) secondaryRiskFactors.push('Low engagement');

    // Create prediction
    const [prediction] = await db
      .insert(platformChurnPredictions)
      .values({
        businessRecordId,
        tenantId: businessRecord.tenantId || undefined,
        churnRisk,
        churnProbability: churnProbability.toFixed(4) as any,
        confidenceLevel: '0.75' as any, // Placeholder confidence
        predictedChurnDate: new Date(Date.now() + daysUntilChurn * 24 * 60 * 60 * 1000),
        daysUntilChurn,
        primaryRiskFactors,
        secondaryRiskFactors,
        modelVersion: 'v1.0',
        modelType: 'rules_based',
        estimatedMRR: businessRecord.currentMRR || undefined,
        estimatedARR: businessRecord.currentARR || undefined,
        estimatedLTV: businessRecord.lifetimeValue || undefined,
        predictedAt: new Date(),
        predictedBy: 'system',
        nextPrediction: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        interventionRequired: churnRisk === 'critical' || churnRisk === 'high',
      })
      .returning();

    // Update business record with churn risk
    await db
      .update(platformBusinessRecords)
      .set({
        churnRisk,
        churnProbability: churnProbability.toFixed(4) as any,
        updatedAt: new Date(),
      })
      .where(eq(platformBusinessRecords.id, businessRecordId));

    res.json(prediction);
  } catch (error) {
    console.error('Error predicting churn:', error);
    res.status(500).json({
      error: 'Failed to predict churn',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// SUCCESS INTERVENTIONS
// ============================================================================

/**
 * GET /api/platform-cs/interventions
 * List success interventions
 */
router.get('/interventions', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      status,
      priority,
      assignedTo,
      businessRecordId,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions: SQL[] = [];

    if (status) {
      conditions.push(eq(platformSuccessInterventions.status, status as string));
    }

    if (priority) {
      conditions.push(eq(platformSuccessInterventions.priority, priority as string));
    }

    if (assignedTo) {
      conditions.push(eq(platformSuccessInterventions.assignedTo, assignedTo as string));
    }

    if (businessRecordId) {
      conditions.push(eq(platformSuccessInterventions.businessRecordId, businessRecordId as string));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const interventions = await db.query.platformSuccessInterventions.findMany({
      where: whereClause,
      orderBy: [desc(platformSuccessInterventions.createdAt)],
      limit: limitNum,
      offset: offset,
    });

    res.json({ interventions });
  } catch (error) {
    console.error('Error fetching interventions:', error);
    res.status(500).json({
      error: 'Failed to fetch interventions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/platform-cs/interventions
 * Create success intervention
 */
router.post('/interventions', async (req: Request, res: Response) => {
  try {
    const data: NewPlatformSuccessIntervention = req.body;

    if (!data.businessRecordId) {
      return res.status(400).json({ error: 'businessRecordId is required' });
    }

    if (!data.title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const [intervention] = await db
      .insert(platformSuccessInterventions)
      .values({
        ...data,
        createdBy: req.user?.id || 'system',
      })
      .returning();

    // Log activity
    await db.insert(platformActivities).values({
      businessRecordId: data.businessRecordId,
      activityType: 'note',
      subject: 'Success intervention created',
      description: `Intervention: ${data.title}`,
      activityDate: new Date(),
      createdBy: req.user?.id || 'system',
    });

    res.status(201).json(intervention);
  } catch (error) {
    console.error('Error creating intervention:', error);
    res.status(500).json({
      error: 'Failed to create intervention',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/platform-cs/interventions/:id
 * Update success intervention
 */
router.patch('/interventions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [updatedIntervention] = await db
      .update(platformSuccessInterventions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(platformSuccessInterventions.id, id))
      .returning();

    if (!updatedIntervention) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    res.json(updatedIntervention);
  } catch (error) {
    console.error('Error updating intervention:', error);
    res.status(500).json({
      error: 'Failed to update intervention',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
