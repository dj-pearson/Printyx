import { Router } from 'express';
import { IntelligentAlertsService } from './services/intelligent-alerts-service';
import { db } from './db';
import {
  alertTriageResults,
  automatedContainmentLogs,
  incidentCorrelations,
  incidentResolutionPatterns,
  proactiveThreatDetection,
  alertRoutingRules,
  resolutionSuggestionFeedback,
} from '@shared/schema';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';
import { getUserId, getTenantId, isPlatformAdmin } from './utils/auth-helpers';
import { z } from 'zod';

/**
 * INTELLIGENT ALERTS & INCIDENT RESPONSE ROUTES
 *
 * AI-powered security alert management with automated triage, containment, and resolution.
 */

const router = Router();

// ============================================================================
// ALERT TRIAGE
// ============================================================================

/**
 * POST /api/security/alerts/triage
 * Triage an alert with AI classification
 */
router.post('/alerts/triage', async (req, res) => {
  try {
    const {
      alertId,
      tenantId,
      alertTitle,
      alertDescription,
      affectedResources,
      userId,
      ipAddress,
    } = req.body;

    // Validate required fields
    if (!alertId || !tenantId || !alertTitle) {
      return res.status(400).json({
        error: 'Missing required fields: alertId, tenantId, alertTitle',
      });
    }

    const result = await IntelligentAlertsService.triageAlert({
      alertId,
      tenantId,
      alertTitle,
      alertDescription,
      affectedResources,
      userId,
      ipAddress: ipAddress || req.ip,
    });

    res.status(201).json({
      success: true,
      triage: result,
    });
  } catch (error) {
    console.error('Failed to triage alert:', error);
    res.status(500).json({
      error: 'Failed to triage alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/security/alerts/:alertId/triage
 * Get triage result for an alert
 */
router.get('/alerts/:alertId/triage', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const triage = await db.query.alertTriageResults.findFirst({
      where: and(
        eq(alertTriageResults.alertId, req.params.alertId),
        eq(alertTriageResults.tenantId, tenantId),
      ),
      orderBy: desc(alertTriageResults.createdAt),
    });

    if (!triage) {
      return res.status(404).json({ error: 'Triage result not found' });
    }

    res.json({ triage });
  } catch (error) {
    console.error('Failed to fetch triage result:', error);
    res.status(500).json({ error: 'Failed to fetch triage result' });
  }
});

/**
 * PUT /api/security/alerts/:alertId/triage/:triageId/review
 * Human review of AI classification
 */
router.put('/alerts/:alertId/triage/:triageId/review', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { reviewedBy, classificationAccurate, reviewNotes } = req.body;

    if (!reviewedBy || classificationAccurate === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: reviewedBy, classificationAccurate',
      });
    }

    // Verify the triage record belongs to this tenant before updating
    const existingTriage = await db.query.alertTriageResults.findFirst({
      where: and(
        eq(alertTriageResults.id, req.params.triageId),
        eq(alertTriageResults.tenantId, tenantId),
      ),
    });

    if (!existingTriage) {
      return res.status(404).json({ error: 'Triage result not found' });
    }

    const [updated] = await db
      .update(alertTriageResults)
      .set({
        humanReviewed: true,
        reviewedBy,
        reviewedAt: new Date(),
        classificationAccurate,
        reviewNotes,
      })
      .where(
        and(
          eq(alertTriageResults.id, req.params.triageId),
          eq(alertTriageResults.tenantId, tenantId),
        ),
      )
      .returning();

    res.json({
      success: true,
      triage: updated,
    });
  } catch (error) {
    console.error('Failed to review triage:', error);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// ============================================================================
// AUTOMATED CONTAINMENT
// ============================================================================

/**
 * POST /api/security/containment/execute
 * Execute a containment action
 */
router.post('/containment/execute', async (req, res) => {
  try {
    const { alertId, tenantId, actionType, target, reason, executedBy } = req.body;

    // Validate required fields
    if (!alertId || !tenantId || !actionType || !target || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: alertId, tenantId, actionType, target, reason',
      });
    }

    const result = await IntelligentAlertsService.executeContainmentAction({
      alertId,
      tenantId,
      actionType,
      target,
      reason,
      automated: false,
      executedBy,
    });

    res.status(201).json({
      success: true,
      containmentLog: result,
    });
  } catch (error) {
    console.error('Failed to execute containment action:', error);
    res.status(500).json({
      error: 'Failed to execute containment action',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/security/containment/logs
 * Get containment action logs
 */
router.get('/containment/logs', async (req, res) => {
  try {
    // SECURITY FIX: Get tenant from auth context, not query params
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { alertId, limit = 50 } = req.query;

    const conditions = [eq(automatedContainmentLogs.tenantId, tenantId)];
    if (alertId) {
      conditions.push(eq(automatedContainmentLogs.alertId, alertId as string));
    }

    const logs = await db.query.automatedContainmentLogs.findMany({
      where: and(...conditions),
      orderBy: desc(automatedContainmentLogs.createdAt),
      limit: Number(limit),
    });

    res.json({ logs });
  } catch (error) {
    console.error('Failed to fetch containment logs:', error);
    res.status(500).json({ error: 'Failed to fetch containment logs' });
  }
});

/**
 * POST /api/security/containment/:logId/reverse
 * Reverse a containment action
 */
router.post('/containment/:logId/reverse', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { reversedBy, reversalReason } = req.body;

    if (!reversedBy || !reversalReason) {
      return res.status(400).json({
        error: 'Missing required fields: reversedBy, reversalReason',
      });
    }

    // Verify the containment log belongs to this tenant before updating
    const existingLog = await db.query.automatedContainmentLogs.findFirst({
      where: and(
        eq(automatedContainmentLogs.id, req.params.logId),
        eq(automatedContainmentLogs.tenantId, tenantId),
      ),
    });

    if (!existingLog) {
      return res.status(404).json({ error: 'Containment log not found' });
    }

    const [updated] = await db
      .update(automatedContainmentLogs)
      .set({
        reversed: true,
        reversedAt: new Date(),
        reversedBy,
        reversalReason,
      })
      .where(
        and(
          eq(automatedContainmentLogs.id, req.params.logId),
          eq(automatedContainmentLogs.tenantId, tenantId),
        ),
      )
      .returning();

    // TODO: Actually reverse the action (unblock IP, restore access, etc.)

    res.json({
      success: true,
      log: updated,
    });
  } catch (error) {
    console.error('Failed to reverse containment action:', error);
    res.status(500).json({ error: 'Failed to reverse containment action' });
  }
});

// ============================================================================
// INCIDENT CORRELATION
// ============================================================================

/**
 * GET /api/security/incidents/correlations
 * Get correlated incidents
 */
router.get('/incidents/correlations', async (req, res) => {
  try {
    // SECURITY FIX: Get tenant from auth context, not query params
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { limit = 50 } = req.query;

    const correlations = await db.query.incidentCorrelations.findMany({
      where: eq(incidentCorrelations.tenantId, tenantId),
      orderBy: desc(incidentCorrelations.createdAt),
      limit: Number(limit),
    });

    res.json({ correlations });
  } catch (error) {
    console.error('Failed to fetch incident correlations:', error);
    res.status(500).json({ error: 'Failed to fetch incident correlations' });
  }
});

/**
 * GET /api/security/incidents/:incidentId/related
 * Get related incidents for a specific incident
 */
router.get('/incidents/:incidentId/related', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const correlation = await db.query.incidentCorrelations.findFirst({
      where: and(
        eq(incidentCorrelations.masterIncidentId, req.params.incidentId),
        eq(incidentCorrelations.tenantId, tenantId),
      ),
      orderBy: desc(incidentCorrelations.createdAt),
    });

    if (!correlation) {
      return res.json({
        related: [],
        correlation: null,
      });
    }

    res.json({
      related: correlation.relatedIncidentIds,
      correlation,
    });
  } catch (error) {
    console.error('Failed to fetch related incidents:', error);
    res.status(500).json({ error: 'Failed to fetch related incidents' });
  }
});

// ============================================================================
// RESOLUTION PATTERNS
// ============================================================================

/**
 * GET /api/security/patterns
 * Get incident resolution patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    const { category, limit = 20 } = req.query;

    const patterns = await db.query.incidentResolutionPatterns.findMany({
      where: category ? eq(incidentResolutionPatterns.category, category as any) : undefined,
      orderBy: desc(incidentResolutionPatterns.successRate),
      limit: Number(limit),
    });

    res.json({ patterns });
  } catch (error) {
    console.error('Failed to fetch resolution patterns:', error);
    res.status(500).json({ error: 'Failed to fetch resolution patterns' });
  }
});

/**
 * POST /api/security/patterns
 * Record a resolution pattern
 */
router.post('/patterns', async (req, res) => {
  try {
    const { category, resolutionSteps, resolutionTime, successful } = req.body;

    if (!category || !resolutionSteps || resolutionTime === undefined || successful === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: category, resolutionSteps, resolutionTime, successful',
      });
    }

    await IntelligentAlertsService.recordResolutionPattern(
      category,
      resolutionSteps,
      resolutionTime,
      successful,
    );

    res.status(201).json({
      success: true,
      message: 'Resolution pattern recorded',
    });
  } catch (error) {
    console.error('Failed to record resolution pattern:', error);
    res.status(500).json({ error: 'Failed to record resolution pattern' });
  }
});

// ============================================================================
// RESOLUTION SUGGESTIONS
// ============================================================================

/**
 * POST /api/security/incidents/:incidentId/execute-suggestion
 * Execute a suggested resolution
 */
router.post('/incidents/:incidentId/execute-suggestion', async (req, res) => {
  try {
    const { suggestionId, triageResultId, executedBy } = req.body;

    if (!suggestionId || !triageResultId || !executedBy) {
      return res.status(400).json({
        error: 'Missing required fields: suggestionId, triageResultId, executedBy',
      });
    }

    // TODO: Implement actual suggestion execution
    // This would execute the steps defined in the suggestion

    res.status(201).json({
      success: true,
      message: 'Suggestion execution started',
    });
  } catch (error) {
    console.error('Failed to execute suggestion:', error);
    res.status(500).json({ error: 'Failed to execute suggestion' });
  }
});

/**
 * POST /api/security/suggestions/:suggestionId/feedback
 * Provide feedback on a resolution suggestion
 */
router.post('/suggestions/:suggestionId/feedback', async (req, res) => {
  try {
    const {
      triageResultId,
      incidentId,
      suggestionUsed,
      suggestionHelpful,
      helpfulnessScore,
      incidentResolved,
      resolutionTime,
      stepsFollowed,
      additionalSteps,
      rootCauseCorrect,
      estimatedTimeAccurate,
      feedback,
      improvementSuggestions,
      providedBy,
    } = req.body;

    if (!triageResultId || !incidentId || suggestionUsed === undefined || !providedBy) {
      return res.status(400).json({
        error: 'Missing required fields: triageResultId, incidentId, suggestionUsed, providedBy',
      });
    }

    const [feedbackRecord] = await db
      .insert(resolutionSuggestionFeedback)
      .values({
        suggestionId: req.params.suggestionId,
        triageResultId,
        incidentId,
        suggestionUsed,
        suggestionHelpful,
        helpfulnessScore,
        incidentResolved,
        resolutionTime,
        stepsFollowed,
        additionalSteps,
        rootCauseCorrect,
        estimatedTimeAccurate,
        feedback,
        improvementSuggestions,
        providedBy,
      })
      .returning();

    res.status(201).json({
      success: true,
      feedback: feedbackRecord,
    });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    res.status(500).json({ error: 'Failed to submit suggestion feedback' });
  }
});

// ============================================================================
// PROACTIVE THREAT DETECTION
// ============================================================================

/**
 * POST /api/security/threats/detect
 * Report a detected anomaly/threat
 */
router.post('/threats/detect', async (req, res) => {
  try {
    const {
      tenantId,
      entityType,
      entityId,
      anomalyType,
      normalBehavior,
      observedBehavior,
      deviation,
    } = req.body;

    if (!tenantId || !entityType || !entityId || !anomalyType || !deviation) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, entityType, entityId, anomalyType, deviation',
      });
    }

    await IntelligentAlertsService.detectAnomaly({
      tenantId,
      entityType,
      entityId,
      anomalyType,
      normalBehavior,
      observedBehavior,
      deviation,
    });

    res.status(201).json({
      success: true,
      message: 'Anomaly detected and recorded',
    });
  } catch (error) {
    console.error('Failed to detect anomaly:', error);
    res.status(500).json({ error: 'Failed to record anomaly detection' });
  }
});

/**
 * GET /api/security/threats
 * Get detected threats
 */
router.get('/threats', async (req, res) => {
  try {
    // SECURITY FIX: Get tenant from auth context, not query params
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { status, limit = 50 } = req.query;

    const conditions = [eq(proactiveThreatDetection.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(proactiveThreatDetection.status, status as string));
    }

    const threats = await db.query.proactiveThreatDetection.findMany({
      where: and(...conditions),
      orderBy: desc(proactiveThreatDetection.lastDetectedAt),
      limit: Number(limit),
    });

    res.json({ threats });
  } catch (error) {
    console.error('Failed to fetch threats:', error);
    res.status(500).json({ error: 'Failed to fetch threat detections' });
  }
});

/**
 * PUT /api/security/threats/:threatId
 * Update threat status
 */
router.put('/threats/:threatId', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { status, resolutionNotes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Verify the threat belongs to this tenant before updating
    const existingThreat = await db.query.proactiveThreatDetection.findFirst({
      where: and(
        eq(proactiveThreatDetection.id, req.params.threatId),
        eq(proactiveThreatDetection.tenantId, tenantId),
      ),
    });

    if (!existingThreat) {
      return res.status(404).json({ error: 'Threat not found' });
    }

    const [updated] = await db
      .update(proactiveThreatDetection)
      .set({
        status,
        resolutionNotes,
        resolvedAt: status === 'resolved' ? new Date() : undefined,
      })
      .where(
        and(
          eq(proactiveThreatDetection.id, req.params.threatId),
          eq(proactiveThreatDetection.tenantId, tenantId),
        ),
      )
      .returning();

    res.json({
      success: true,
      threat: updated,
    });
  } catch (error) {
    console.error('Failed to update threat:', error);
    res.status(500).json({ error: 'Failed to update threat status' });
  }
});

// ============================================================================
// ROUTING RULES
// ============================================================================

/**
 * GET /api/security/routing-rules
 * Get alert routing rules
 */
router.get('/routing-rules', async (req, res) => {
  try {
    // SECURITY FIX: Get tenant from auth context, not query params
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { isActive } = req.query;

    const conditions = [eq(alertRoutingRules.tenantId, tenantId)];
    if (isActive !== undefined) {
      conditions.push(eq(alertRoutingRules.isActive, isActive === 'true'));
    }

    const rules = await db.query.alertRoutingRules.findMany({
      where: and(...conditions),
      orderBy: desc(alertRoutingRules.priority),
    });

    res.json({ rules });
  } catch (error) {
    console.error('Failed to fetch routing rules:', error);
    res.status(500).json({ error: 'Failed to fetch routing rules' });
  }
});

// SECURITY FIX: Validation schemas - tenantId comes from auth context, NOT from body
const routingRuleSchema = z
  .object({
    name: z.string().max(255),
    description: z.string().optional(),
    priority: z.number().int().min(0),
    enabled: z.boolean(),
    conditions: z.any(), // JSON field
    actions: z.any(), // JSON field
  })
  .strict();

const updateRoutingRuleSchema = z
  .object({
    name: z.string().max(255).optional(),
    description: z.string().optional(),
    priority: z.number().int().min(0).optional(),
    enabled: z.boolean().optional(),
    conditions: z.any().optional(),
    actions: z.any().optional(),
  })
  .strict();

/**
 * POST /api/security/routing-rules
 * Create a routing rule
 */
router.post('/routing-rules', async (req, res) => {
  try {
    // SECURITY FIX: Get tenant from auth context, NOT from body
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    // Validate input
    const validatedData = routingRuleSchema.parse(req.body);

    const [rule] = await db
      .insert(alertRoutingRules)
      .values({
        ...validatedData,
        tenantId, // SECURITY: tenantId from auth context
      })
      .returning();

    res.status(201).json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Failed to create routing rule:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create routing rule' });
  }
});

/**
 * PUT /api/security/routing-rules/:ruleId
 * Update a routing rule
 */
router.put('/routing-rules/:ruleId', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    // SECURITY FIX: Validate input to prevent mass assignment
    const validatedData = updateRoutingRuleSchema.parse(req.body);

    // Verify the rule belongs to this tenant before updating
    const existingRule = await db.query.alertRoutingRules.findFirst({
      where: and(
        eq(alertRoutingRules.id, req.params.ruleId),
        eq(alertRoutingRules.tenantId, tenantId),
      ),
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Routing rule not found' });
    }

    const [updated] = await db
      .update(alertRoutingRules)
      .set(validatedData)
      .where(
        and(eq(alertRoutingRules.id, req.params.ruleId), eq(alertRoutingRules.tenantId, tenantId)),
      )
      .returning();

    res.json({
      success: true,
      rule: updated,
    });
  } catch (error) {
    console.error('Failed to update routing rule:', error);
    res.status(500).json({ error: 'Failed to update routing rule' });
  }
});

/**
 * DELETE /api/security/routing-rules/:ruleId
 * Delete a routing rule
 */
router.delete('/routing-rules/:ruleId', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    // Verify the rule belongs to this tenant before deleting
    const existingRule = await db.query.alertRoutingRules.findFirst({
      where: and(
        eq(alertRoutingRules.id, req.params.ruleId),
        eq(alertRoutingRules.tenantId, tenantId),
      ),
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Routing rule not found' });
    }

    await db
      .delete(alertRoutingRules)
      .where(
        and(eq(alertRoutingRules.id, req.params.ruleId), eq(alertRoutingRules.tenantId, tenantId)),
      );

    res.json({
      success: true,
      message: 'Routing rule deleted',
    });
  } catch (error) {
    console.error('Failed to delete routing rule:', error);
    res.status(500).json({ error: 'Failed to delete routing rule' });
  }
});

export default router;
