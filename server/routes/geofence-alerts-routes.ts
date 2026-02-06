import express, { Request, Response } from 'express';
import { z } from 'zod';
import { geofenceAlertsService } from '../services/geofence-alerts-service';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('geofence-alerts-routes');

import {
  geofenceAlertRules,
  geofenceAlerts,
  geofenceAlertSubscriptions,
  technicianDwellSessions,
  insertGeofenceAlertRuleSchema,
  insertGeofenceAlertSubscriptionSchema,
} from '@shared/geofence-alerts-schema';

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

// ==================== Alert Rules ====================

// GET /api/geofence-alerts/rules - List alert rules
router.get('/rules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { geofenceId, isActive, triggerType } = req.query;

    let whereConditions = [eq(geofenceAlertRules.tenantId, user.tenantId)];

    if (geofenceId) {
      whereConditions.push(eq(geofenceAlertRules.geofenceId, geofenceId as string));
    }

    if (isActive !== undefined) {
      whereConditions.push(eq(geofenceAlertRules.isActive, isActive === 'true'));
    }

    if (triggerType) {
      whereConditions.push(eq(geofenceAlertRules.triggerType, triggerType as string));
    }

    const rules = await db
      .select()
      .from(geofenceAlertRules)
      .where(and(...whereConditions))
      .orderBy(desc(geofenceAlertRules.priority));

    res.json(rules);
  } catch (error) {
    log.error('Get alert rules error:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

// GET /api/geofence-alerts/rules/:id - Get specific rule
router.get('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [rule] = await db
      .select()
      .from(geofenceAlertRules)
      .where(
        and(
          eq(geofenceAlertRules.id, req.params.id),
          eq(geofenceAlertRules.tenantId, user.tenantId),
        ),
      )
      .limit(1);

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    res.json(rule);
  } catch (error) {
    log.error('Get alert rule error:', error);
    res.status(500).json({ error: 'Failed to fetch alert rule' });
  }
});

// POST /api/geofence-alerts/rules - Create alert rule (Admin/Manager only)
router.post('/rules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const data = insertGeofenceAlertRuleSchema.parse({
      ...req.body,
      createdBy: user.id,
    });

    const [rule] = await db
      .insert(geofenceAlertRules)
      .values({
        ...data,
        tenantId: user.tenantId,
      })
      .returning();

    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create alert rule error:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

// PUT /api/geofence-alerts/rules/:id - Update alert rule (Admin/Manager only)
router.put('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const [existing] = await db
      .select()
      .from(geofenceAlertRules)
      .where(
        and(
          eq(geofenceAlertRules.id, req.params.id),
          eq(geofenceAlertRules.tenantId, user.tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const data = insertGeofenceAlertRuleSchema.partial().parse(req.body);

    const [updated] = await db
      .update(geofenceAlertRules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(geofenceAlertRules.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update alert rule error:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

// DELETE /api/geofence-alerts/rules/:id - Delete alert rule (Admin/Manager only)
router.delete('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const [existing] = await db
      .select()
      .from(geofenceAlertRules)
      .where(
        and(
          eq(geofenceAlertRules.id, req.params.id),
          eq(geofenceAlertRules.tenantId, user.tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    await db.delete(geofenceAlertRules).where(eq(geofenceAlertRules.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    log.error('Delete alert rule error:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// ==================== Alerts ====================

// GET /api/geofence-alerts/alerts - List alerts
router.get('/alerts', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, geofenceId, severity, isAcknowledged, isResolved, limit } = req.query;

    let whereConditions = [eq(geofenceAlerts.tenantId, user.tenantId)];

    if (technicianId) {
      whereConditions.push(eq(geofenceAlerts.technicianId, technicianId as string));
    }

    if (geofenceId) {
      whereConditions.push(eq(geofenceAlerts.geofenceId, geofenceId as string));
    }

    if (severity) {
      whereConditions.push(eq(geofenceAlerts.severity, severity as string));
    }

    if (isAcknowledged !== undefined) {
      whereConditions.push(eq(geofenceAlerts.isAcknowledged, isAcknowledged === 'true'));
    }

    if (isResolved !== undefined) {
      whereConditions.push(eq(geofenceAlerts.isResolved, isResolved === 'true'));
    }

    let query = db
      .select()
      .from(geofenceAlerts)
      .where(and(...whereConditions))
      .orderBy(desc(geofenceAlerts.triggeredAt));

    if (limit) {
      query = query.limit(parseInt(limit as string)) as any;
    }

    const alerts = await query;
    res.json(alerts);
  } catch (error) {
    log.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/geofence-alerts/alerts/unacknowledged - Get unacknowledged alerts
router.get('/alerts/unacknowledged', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { severity, limit } = req.query;

    const alerts = await geofenceAlertsService.getUnacknowledgedAlerts(user.tenantId, {
      severity: severity as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(alerts);
  } catch (error) {
    log.error('Get unacknowledged alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch unacknowledged alerts' });
  }
});

// GET /api/geofence-alerts/alerts/:id - Get specific alert
router.get('/alerts/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [alert] = await db
      .select()
      .from(geofenceAlerts)
      .where(and(eq(geofenceAlerts.id, req.params.id), eq(geofenceAlerts.tenantId, user.tenantId)))
      .limit(1);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    log.error('Get alert error:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// POST /api/geofence-alerts/alerts/:id/acknowledge - Acknowledge alert
router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const ackSchema = z.object({
      notes: z.string().optional(),
    });

    const { notes } = ackSchema.parse(req.body);

    const alert = await geofenceAlertsService.acknowledgeAlert(
      req.params.id,
      user.tenantId,
      user.id,
      notes,
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Acknowledge alert error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// POST /api/geofence-alerts/alerts/:id/resolve - Resolve alert
router.post('/alerts/:id/resolve', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const resolveSchema = z.object({
      resolutionType: z.enum(['auto_resolved', 'manual_resolved', 'false_alarm', 'escalated']),
      notes: z.string().optional(),
    });

    const { resolutionType, notes } = resolveSchema.parse(req.body);

    const alert = await geofenceAlertsService.resolveAlert(
      req.params.id,
      user.tenantId,
      user.id,
      resolutionType,
      notes,
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// POST /api/geofence-alerts/alerts/:id/escalate - Escalate alert
router.post('/alerts/:id/escalate', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const escalateSchema = z.object({
      escalatedTo: z.string(),
      reason: z.string(),
    });

    const { escalatedTo, reason } = escalateSchema.parse(req.body);

    const alert = await geofenceAlertsService.escalateAlert(
      req.params.id,
      user.tenantId,
      escalatedTo,
      reason,
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Escalate alert error:', error);
    res.status(500).json({ error: 'Failed to escalate alert' });
  }
});

// ==================== Process Events ====================

// POST /api/geofence-alerts/process-event - Process geofence event and trigger alerts
router.post('/process-event', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const eventSchema = z.object({
      technicianId: z.string(),
      geofenceId: z.string(),
      eventType: z.enum(['entry', 'exit', 'dwell']),
      location: z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string().optional(),
      }),
      ticketId: z.string().optional(),
      customerId: z.string().optional(),
      routeId: z.string().optional(),
      dwellDurationMinutes: z.number().optional(),
    });

    const data = eventSchema.parse(req.body);

    const alerts = await geofenceAlertsService.processGeofenceEvent(
      user.tenantId,
      data.technicianId,
      data.geofenceId,
      data.eventType,
      data.location,
      {
        ticketId: data.ticketId,
        customerId: data.customerId,
        routeId: data.routeId,
        dwellDurationMinutes: data.dwellDurationMinutes,
      },
    );

    res.json({ alertsTriggered: alerts.length, alerts });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Process geofence event error:', error);
    res.status(500).json({ error: 'Failed to process geofence event' });
  }
});

// POST /api/geofence-alerts/check-dwell - Check all active dwell sessions for alerts
router.post('/check-dwell', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const alerts = await geofenceAlertsService.checkDwellAlerts(user.tenantId);
    res.json({ alertsTriggered: alerts.length, alerts });
  } catch (error) {
    log.error('Check dwell alerts error:', error);
    res.status(500).json({ error: 'Failed to check dwell alerts' });
  }
});

// ==================== Dwell Sessions ====================

// GET /api/geofence-alerts/dwell-sessions - Get dwell sessions
router.get('/dwell-sessions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, geofenceId, isActive } = req.query;

    let whereConditions = [eq(technicianDwellSessions.tenantId, user.tenantId)];

    if (technicianId) {
      whereConditions.push(eq(technicianDwellSessions.technicianId, technicianId as string));
    }

    if (geofenceId) {
      whereConditions.push(eq(technicianDwellSessions.geofenceId, geofenceId as string));
    }

    if (isActive !== undefined) {
      whereConditions.push(eq(technicianDwellSessions.isActive, isActive === 'true'));
    }

    const sessions = await db
      .select()
      .from(technicianDwellSessions)
      .where(and(...whereConditions))
      .orderBy(desc(technicianDwellSessions.entryTime));

    res.json(sessions);
  } catch (error) {
    log.error('Get dwell sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch dwell sessions' });
  }
});

// POST /api/geofence-alerts/dwell-sessions/start - Start dwell session
router.post('/dwell-sessions/start', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const startSchema = z.object({
      technicianId: z.string(),
      geofenceId: z.string(),
      entryLocation: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      entryEventId: z.string().optional(),
      ticketId: z.string().optional(),
      customerId: z.string().optional(),
      routeId: z.string().optional(),
      expectedDwellMinutes: z.number().optional(),
    });

    const data = startSchema.parse(req.body);

    const session = await geofenceAlertsService.startDwellSession(
      user.tenantId,
      data.technicianId,
      data.geofenceId,
      data.entryLocation,
      data.entryEventId,
      {
        ticketId: data.ticketId,
        customerId: data.customerId,
        routeId: data.routeId,
        expectedDwellMinutes: data.expectedDwellMinutes,
      },
    );

    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Start dwell session error:', error);
    res.status(500).json({ error: 'Failed to start dwell session' });
  }
});

// POST /api/geofence-alerts/dwell-sessions/end - End dwell session
router.post('/dwell-sessions/end', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const endSchema = z.object({
      technicianId: z.string(),
      geofenceId: z.string(),
      exitLocation: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      exitEventId: z.string().optional(),
    });

    const data = endSchema.parse(req.body);

    const session = await geofenceAlertsService.endDwellSession(
      user.tenantId,
      data.technicianId,
      data.geofenceId,
      data.exitLocation,
      data.exitEventId,
    );

    if (!session) {
      return res.status(404).json({ error: 'No active dwell session found' });
    }

    res.json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('End dwell session error:', error);
    res.status(500).json({ error: 'Failed to end dwell session' });
  }
});

// ==================== Subscriptions ====================

// GET /api/geofence-alerts/subscriptions - Get user's subscriptions
router.get('/subscriptions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const subscriptions = await db
      .select()
      .from(geofenceAlertSubscriptions)
      .where(
        and(
          eq(geofenceAlertSubscriptions.tenantId, user.tenantId),
          eq(geofenceAlertSubscriptions.userId, user.id),
        ),
      );

    res.json(subscriptions);
  } catch (error) {
    log.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// POST /api/geofence-alerts/subscriptions - Create subscription
router.post('/subscriptions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertGeofenceAlertSubscriptionSchema.parse({
      ...req.body,
      userId: user.id,
    });

    const [subscription] = await db
      .insert(geofenceAlertSubscriptions)
      .values({
        ...data,
        tenantId: user.tenantId,
      })
      .returning();

    res.status(201).json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// DELETE /api/geofence-alerts/subscriptions/:id - Delete subscription
router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [existing] = await db
      .select()
      .from(geofenceAlertSubscriptions)
      .where(
        and(
          eq(geofenceAlertSubscriptions.id, req.params.id),
          eq(geofenceAlertSubscriptions.tenantId, user.tenantId),
          eq(geofenceAlertSubscriptions.userId, user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await db
      .delete(geofenceAlertSubscriptions)
      .where(eq(geofenceAlertSubscriptions.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    log.error('Delete subscription error:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// ==================== Statistics ====================

// GET /api/geofence-alerts/statistics - Get alert statistics
router.get('/statistics', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const statistics = await geofenceAlertsService.getAlertStatistics(
      user.tenantId,
      new Date(startDate as string),
      new Date(endDate as string),
    );

    res.json(statistics);
  } catch (error) {
    log.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
