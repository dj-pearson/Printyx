import { Router, Request, Response } from 'express';
import type { IStorage } from '../storage';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('customer-success-routes');

const router = Router();
let storage: IStorage;

export function setCustomerSuccessStorage(storageInstance: IStorage) {
  storage = storageInstance;
}

// Helper function to check if user is admin or manager (uses role level hierarchy)
function isAdminOrManager(user: any): boolean {
  const roleLevel = user?.roleLevel || user?.role_level || 1;
  return roleLevel >= 4; // Manager level (4) and above
}

// ==================== Customer Health Scores ====================

// GET /api/customer-success/health-scores - List all health scores with filtering
router.get('/health-scores', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { healthStatus, trend, minScore, maxScore } = req.query;

    const filters: any = {};
    if (healthStatus) filters.healthStatus = healthStatus as string;
    if (trend) filters.trend = trend as string;
    if (minScore) filters.minScore = parseInt(minScore as string);
    if (maxScore) filters.maxScore = parseInt(maxScore as string);

    const scores = await storage.getHealthScores(user.tenantId, filters);
    res.json(scores);
  } catch (error) {
    log.error('Get health scores error:', error);
    res.status(500).json({ error: 'Failed to fetch health scores' });
  }
});

// GET /api/customer-success/health-scores/:id - Get specific health score
router.get('/health-scores/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const score = await storage.getHealthScore(req.params.id);

    if (!score || score.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Health score not found' });
    }

    res.json(score);
  } catch (error) {
    log.error('Get health score error:', error);
    res.status(500).json({ error: 'Failed to fetch health score' });
  }
});

// POST /api/customer-success/health-scores - Create new health score
router.post('/health-scores', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const scoreData = {
      ...req.body,
      tenantId: user.tenantId,
      calculatedBy: req.body.calculatedBy || 'system',
    };

    const score = await storage.createHealthScore(scoreData);
    res.status(201).json(score);
  } catch (error) {
    log.error('Create health score error:', error);
    res.status(500).json({ error: 'Failed to create health score' });
  }
});

// PATCH /api/customer-success/health-scores/:id - Update health score
router.patch('/health-scores/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getHealthScore(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Health score not found' });
    }

    const updated = await storage.updateHealthScore(req.params.id, user.tenantId, req.body);
    res.json(updated);
  } catch (error) {
    log.error('Update health score error:', error);
    res.status(500).json({ error: 'Failed to update health score' });
  }
});

// GET /api/customer-success/health-scores/customer/:customerId - Get health score for customer
router.get('/health-scores/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const score = await storage.getHealthScoreByCustomer(req.params.customerId, user.tenantId);

    if (!score) {
      return res.status(404).json({ error: 'Health score not found for customer' });
    }

    res.json(score);
  } catch (error) {
    log.error('Get health score by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch health score for customer' });
  }
});

// GET /api/customer-success/health-scores/customer/:customerId/history - Get health score history
router.get('/health-scores/customer/:customerId/history', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = await storage.getHealthScoreHistory(
      req.params.customerId,
      user.tenantId,
      limit,
    );
    res.json(history);
  } catch (error) {
    log.error('Get health score history error:', error);
    res.status(500).json({ error: 'Failed to fetch health score history' });
  }
});

// GET /api/customer-success/health-scores/due-calculation - Get scores due for calculation
router.get('/health-scores/due-calculation', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Forbidden: Admin or Manager role required' });
  }

  try {
    const scores = await storage.getScoresDueForCalculation(user.tenantId);
    res.json(scores);
  } catch (error) {
    log.error('Get scores due for calculation error:', error);
    res.status(500).json({ error: 'Failed to fetch scores due for calculation' });
  }
});

// GET /api/customer-success/health-scores/at-risk - Get customers at risk
router.get('/health-scores/at-risk', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const scores = await storage.getCustomersAtRisk(user.tenantId);
    res.json(scores);
  } catch (error) {
    log.error('Get customers at risk error:', error);
    res.status(500).json({ error: 'Failed to fetch customers at risk' });
  }
});

// ==================== Churn Predictions ====================

// GET /api/customer-success/churn-predictions - List all churn predictions with filtering
router.get('/churn-predictions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { churnRisk, interventionRequired } = req.query;

    const filters: any = {};
    if (churnRisk) filters.churnRisk = churnRisk as string;
    if (interventionRequired) filters.interventionRequired = interventionRequired === 'true';

    const predictions = await storage.getChurnPredictions(user.tenantId, filters);
    res.json(predictions);
  } catch (error) {
    log.error('Get churn predictions error:', error);
    res.status(500).json({ error: 'Failed to fetch churn predictions' });
  }
});

// GET /api/customer-success/churn-predictions/:id - Get specific churn prediction
router.get('/churn-predictions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const prediction = await storage.getChurnPrediction(req.params.id);

    if (!prediction || prediction.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Churn prediction not found' });
    }

    res.json(prediction);
  } catch (error) {
    log.error('Get churn prediction error:', error);
    res.status(500).json({ error: 'Failed to fetch churn prediction' });
  }
});

// POST /api/customer-success/churn-predictions - Create new churn prediction
router.post('/churn-predictions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to create churn predictions' });
  }

  try {
    const predictionData = {
      ...req.body,
      tenantId: user.tenantId,
    };

    const prediction = await storage.createChurnPrediction(predictionData);
    res.status(201).json(prediction);
  } catch (error) {
    log.error('Create churn prediction error:', error);
    res.status(500).json({ error: 'Failed to create churn prediction' });
  }
});

// PATCH /api/customer-success/churn-predictions/:id - Update churn prediction
router.patch('/churn-predictions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Forbidden: Admin or Manager role required' });
  }

  try {
    const existing = await storage.getChurnPrediction(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Churn prediction not found' });
    }

    const updated = await storage.updateChurnPrediction(req.params.id, user.tenantId, req.body);
    res.json(updated);
  } catch (error) {
    log.error('Update churn prediction error:', error);
    res.status(500).json({ error: 'Failed to update churn prediction' });
  }
});

// GET /api/customer-success/churn-predictions/customer/:customerId - Get prediction for customer
router.get('/churn-predictions/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const prediction = await storage.getChurnPredictionByCustomer(
      req.params.customerId,
      user.tenantId,
    );

    if (!prediction) {
      return res.status(404).json({ error: 'Churn prediction not found for customer' });
    }

    res.json(prediction);
  } catch (error) {
    log.error('Get churn prediction by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch churn prediction for customer' });
  }
});

// GET /api/customer-success/churn-predictions/high-risk - Get high risk churns
router.get('/churn-predictions/high-risk', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const predictions = await storage.getHighRiskChurns(user.tenantId);
    res.json(predictions);
  } catch (error) {
    log.error('Get high risk churns error:', error);
    res.status(500).json({ error: 'Failed to fetch high risk churns' });
  }
});

// GET /api/customer-success/churn-predictions/expired - Get expired predictions
router.get('/churn-predictions/expired', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Forbidden: Admin or Manager role required' });
  }

  try {
    const predictions = await storage.getExpiredPredictions(user.tenantId);
    res.json(predictions);
  } catch (error) {
    log.error('Get expired predictions error:', error);
    res.status(500).json({ error: 'Failed to fetch expired predictions' });
  }
});

// GET /api/customer-success/churn-predictions/intervention-required - Get predictions requiring intervention
router.get('/churn-predictions/intervention-required', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const predictions = await storage.getPredictionsRequiringIntervention(user.tenantId);
    res.json(predictions);
  } catch (error) {
    log.error('Get predictions requiring intervention error:', error);
    res.status(500).json({ error: 'Failed to fetch predictions requiring intervention' });
  }
});

// ==================== Success Interventions ====================

// GET /api/customer-success/interventions - List all interventions with filtering
router.get('/interventions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { status, interventionType, priority, assignedTo } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (interventionType) filters.interventionType = interventionType as string;
    if (priority) filters.priority = priority as string;
    if (assignedTo) filters.assignedTo = assignedTo as string;

    const interventions = await storage.getInterventions(user.tenantId, filters);
    res.json(interventions);
  } catch (error) {
    log.error('Get interventions error:', error);
    res.status(500).json({ error: 'Failed to fetch interventions' });
  }
});

// GET /api/customer-success/interventions/:id - Get specific intervention
router.get('/interventions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const intervention = await storage.getIntervention(req.params.id);

    if (!intervention || intervention.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    res.json(intervention);
  } catch (error) {
    log.error('Get intervention error:', error);
    res.status(500).json({ error: 'Failed to fetch intervention' });
  }
});

// POST /api/customer-success/interventions - Create new intervention
router.post('/interventions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const interventionData = {
      ...req.body,
      tenantId: user.tenantId,
      createdBy: user.id,
    };

    const intervention = await storage.createIntervention(interventionData);
    res.status(201).json(intervention);
  } catch (error) {
    log.error('Create intervention error:', error);
    res.status(500).json({ error: 'Failed to create intervention' });
  }
});

// PATCH /api/customer-success/interventions/:id - Update intervention
router.patch('/interventions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getIntervention(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    const updated = await storage.updateIntervention(req.params.id, user.tenantId, req.body);
    res.json(updated);
  } catch (error) {
    log.error('Update intervention error:', error);
    res.status(500).json({ error: 'Failed to update intervention' });
  }
});

// GET /api/customer-success/interventions/customer/:customerId - Get interventions for customer
router.get('/interventions/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const interventions = await storage.getInterventionsByCustomer(
      req.params.customerId,
      user.tenantId,
    );
    res.json(interventions);
  } catch (error) {
    log.error('Get interventions by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch interventions for customer' });
  }
});

// POST /api/customer-success/interventions/:id/assign - Assign intervention to user
router.post('/interventions/:id/assign', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to assign interventions' });
  }

  try {
    const existing = await storage.getIntervention(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const assigned = await storage.assignIntervention(req.params.id, user.tenantId, userId);
    res.json(assigned);
  } catch (error) {
    log.error('Assign intervention error:', error);
    res.status(500).json({ error: 'Failed to assign intervention' });
  }
});

// POST /api/customer-success/interventions/:id/complete - Complete intervention
router.post('/interventions/:id/complete', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getIntervention(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    const { outcome, notes } = req.body;
    if (!outcome) {
      return res.status(400).json({ error: 'outcome is required' });
    }

    const completed = await storage.completeIntervention(
      req.params.id,
      user.tenantId,
      outcome,
      notes,
    );
    res.json(completed);
  } catch (error) {
    log.error('Complete intervention error:', error);
    res.status(500).json({ error: 'Failed to complete intervention' });
  }
});

// POST /api/customer-success/interventions/:id/cancel - Cancel intervention
router.post('/interventions/:id/cancel', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to cancel interventions' });
  }

  try {
    const existing = await storage.getIntervention(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const cancelled = await storage.cancelIntervention(req.params.id, user.tenantId, reason);
    res.json(cancelled);
  } catch (error) {
    log.error('Cancel intervention error:', error);
    res.status(500).json({ error: 'Failed to cancel intervention' });
  }
});

// GET /api/customer-success/interventions/overdue - Get overdue interventions
router.get('/interventions/overdue', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const interventions = await storage.getOverdueInterventions(user.tenantId);
    res.json(interventions);
  } catch (error) {
    log.error('Get overdue interventions error:', error);
    res.status(500).json({ error: 'Failed to fetch overdue interventions' });
  }
});

// GET /api/customer-success/interventions/my - Get my interventions
router.get('/interventions/my', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const interventions = await storage.getMyInterventions(user.id, user.tenantId);
    res.json(interventions);
  } catch (error) {
    log.error('Get my interventions error:', error);
    res.status(500).json({ error: 'Failed to fetch my interventions' });
  }
});

// ==================== Customer Journeys ====================

// GET /api/customer-success/journeys - List all journeys with filtering
router.get('/journeys', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { currentStage, lifecyclePhase, journeyHealth } = req.query;

    const filters: any = {};
    if (currentStage) filters.currentStage = currentStage as string;
    if (lifecyclePhase) filters.lifecyclePhase = lifecyclePhase as string;
    if (journeyHealth) filters.journeyHealth = journeyHealth as string;

    const journeys = await storage.getJourneys(user.tenantId, filters);
    res.json(journeys);
  } catch (error) {
    log.error('Get journeys error:', error);
    res.status(500).json({ error: 'Failed to fetch journeys' });
  }
});

// GET /api/customer-success/journeys/:id - Get specific journey
router.get('/journeys/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const journey = await storage.getJourney(req.params.id);

    if (!journey || journey.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    res.json(journey);
  } catch (error) {
    log.error('Get journey error:', error);
    res.status(500).json({ error: 'Failed to fetch journey' });
  }
});

// POST /api/customer-success/journeys - Create new journey
router.post('/journeys', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const journeyData = {
      ...req.body,
      tenantId: user.tenantId,
    };

    const journey = await storage.createJourney(journeyData);
    res.status(201).json(journey);
  } catch (error) {
    log.error('Create journey error:', error);
    res.status(500).json({ error: 'Failed to create journey' });
  }
});

// PATCH /api/customer-success/journeys/:id - Update journey
router.patch('/journeys/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getJourney(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const updated = await storage.updateJourney(req.params.id, user.tenantId, req.body);
    res.json(updated);
  } catch (error) {
    log.error('Update journey error:', error);
    res.status(500).json({ error: 'Failed to update journey' });
  }
});

// GET /api/customer-success/journeys/customer/:customerId - Get journey for customer
router.get('/journeys/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const journey = await storage.getJourneyByCustomer(req.params.customerId, user.tenantId);

    if (!journey) {
      return res.status(404).json({ error: 'Journey not found for customer' });
    }

    res.json(journey);
  } catch (error) {
    log.error('Get journey by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch journey for customer' });
  }
});

// POST /api/customer-success/journeys/:id/advance-stage - Advance journey to next stage
router.post('/journeys/:id/advance-stage', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getJourney(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const { newStage } = req.body;
    if (!newStage) {
      return res.status(400).json({ error: 'newStage is required' });
    }

    const advanced = await storage.advanceJourneyStage(req.params.id, user.tenantId, newStage);
    res.json(advanced);
  } catch (error) {
    log.error('Advance journey stage error:', error);
    res.status(500).json({ error: 'Failed to advance journey stage' });
  }
});

// POST /api/customer-success/journeys/:id/record-touchpoint - Record a touchpoint
router.post('/journeys/:id/record-touchpoint', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getJourney(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const { touchpointType } = req.body;
    if (!touchpointType) {
      return res.status(400).json({ error: 'touchpointType is required' });
    }

    const updated = await storage.recordJourneyTouchpoint(
      req.params.id,
      user.tenantId,
      touchpointType,
    );
    res.json(updated);
  } catch (error) {
    log.error('Record journey touchpoint error:', error);
    res.status(500).json({ error: 'Failed to record journey touchpoint' });
  }
});

// GET /api/customer-success/journeys/needing-attention - Get journeys needing attention
router.get('/journeys/needing-attention', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const journeys = await storage.getJourneysNeedingAttention(user.tenantId);
    res.json(journeys);
  } catch (error) {
    log.error('Get journeys needing attention error:', error);
    res.status(500).json({ error: 'Failed to fetch journeys needing attention' });
  }
});

// ==================== Renewal Opportunities ====================

// GET /api/customer-success/renewals - List all renewal opportunities with filtering
router.get('/renewals', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { renewalStatus, renewalRisk, daysUntilMax } = req.query;

    const filters: any = {};
    if (renewalStatus) filters.renewalStatus = renewalStatus as string;
    if (renewalRisk) filters.renewalRisk = renewalRisk as string;
    if (daysUntilMax) filters.daysUntilMax = parseInt(daysUntilMax as string);

    const renewals = await storage.getRenewalOpportunities(user.tenantId, filters);
    res.json(renewals);
  } catch (error) {
    log.error('Get renewal opportunities error:', error);
    res.status(500).json({ error: 'Failed to fetch renewal opportunities' });
  }
});

// GET /api/customer-success/renewals/:id - Get specific renewal opportunity
router.get('/renewals/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const renewal = await storage.getRenewalOpportunity(req.params.id);

    if (!renewal || renewal.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Renewal opportunity not found' });
    }

    res.json(renewal);
  } catch (error) {
    log.error('Get renewal opportunity error:', error);
    res.status(500).json({ error: 'Failed to fetch renewal opportunity' });
  }
});

// POST /api/customer-success/renewals - Create new renewal opportunity
router.post('/renewals', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const renewalData = {
      ...req.body,
      tenantId: user.tenantId,
      createdBy: user.id,
    };

    const renewal = await storage.createRenewalOpportunity(renewalData);
    res.status(201).json(renewal);
  } catch (error) {
    log.error('Create renewal opportunity error:', error);
    res.status(500).json({ error: 'Failed to create renewal opportunity' });
  }
});

// PATCH /api/customer-success/renewals/:id - Update renewal opportunity
router.patch('/renewals/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getRenewalOpportunity(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Renewal opportunity not found' });
    }

    const updated = await storage.updateRenewalOpportunity(req.params.id, user.tenantId, req.body);
    res.json(updated);
  } catch (error) {
    log.error('Update renewal opportunity error:', error);
    res.status(500).json({ error: 'Failed to update renewal opportunity' });
  }
});

// GET /api/customer-success/renewals/customer/:customerId - Get renewals for customer
router.get('/renewals/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const renewals = await storage.getRenewalsByCustomer(req.params.customerId, user.tenantId);
    res.json(renewals);
  } catch (error) {
    log.error('Get renewals by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch renewals for customer' });
  }
});

// GET /api/customer-success/renewals/contract/:contractId - Get renewal for contract
router.get('/renewals/contract/:contractId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const renewal = await storage.getRenewalByContract(req.params.contractId, user.tenantId);

    if (!renewal) {
      return res.status(404).json({ error: 'Renewal opportunity not found for contract' });
    }

    res.json(renewal);
  } catch (error) {
    log.error('Get renewal by contract error:', error);
    res.status(500).json({ error: 'Failed to fetch renewal for contract' });
  }
});

// POST /api/customer-success/renewals/:id/assign-csm - Assign CSM to renewal
router.post('/renewals/:id/assign-csm', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to assign renewals' });
  }

  try {
    const existing = await storage.getRenewalOpportunity(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Renewal opportunity not found' });
    }

    const { csmId } = req.body;
    if (!csmId) {
      return res.status(400).json({ error: 'csmId is required' });
    }

    const assigned = await storage.assignRenewalCsm(req.params.id, user.tenantId, csmId);
    res.json(assigned);
  } catch (error) {
    log.error('Assign renewal CSM error:', error);
    res.status(500).json({ error: 'Failed to assign renewal CSM' });
  }
});

// POST /api/customer-success/renewals/:id/close - Close renewal (won or lost)
router.post('/renewals/:id/close', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getRenewalOpportunity(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Renewal opportunity not found' });
    }

    const { won, notes } = req.body;
    if (won === undefined) {
      return res.status(400).json({ error: 'won is required (boolean)' });
    }
    if (!notes) {
      return res.status(400).json({ error: 'notes is required' });
    }

    const closed = await storage.closeRenewal(req.params.id, user.tenantId, won, notes);
    res.json(closed);
  } catch (error) {
    log.error('Close renewal error:', error);
    res.status(500).json({ error: 'Failed to close renewal' });
  }
});

// GET /api/customer-success/renewals/upcoming/:days - Get upcoming renewals
router.get('/renewals/upcoming/:days', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const days = parseInt(req.params.days);
    if (isNaN(days)) {
      return res.status(400).json({ error: 'Invalid days parameter' });
    }

    const renewals = await storage.getUpcomingRenewals(user.tenantId, days);
    res.json(renewals);
  } catch (error) {
    log.error('Get upcoming renewals error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming renewals' });
  }
});

// GET /api/customer-success/renewals/high-value/:minMrr - Get high value renewals
router.get('/renewals/high-value/:minMrr', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const minMrr = parseFloat(req.params.minMrr);
    if (isNaN(minMrr)) {
      return res.status(400).json({ error: 'Invalid minMrr parameter' });
    }

    const renewals = await storage.getHighValueRenewals(user.tenantId, minMrr);
    res.json(renewals);
  } catch (error) {
    log.error('Get high value renewals error:', error);
    res.status(500).json({ error: 'Failed to fetch high value renewals' });
  }
});

export default router;
