/**
 * Advanced billing: meter anomalies, disputes, credit memos, billing schedules
 * and invoice-generation logs. 39 endpoints over real tables.
 *
 * UNREACHABLE TODAY - DO NOT "FIX" THIS FILE WITHOUT READING PROD-008c.
 *
 * routes-registry mounts it at /api/billing, but /api/billing is in crmProxies,
 * and the proxy registers long before this mount. Every request under that
 * prefix goes to supabase/functions/billing/, which has handlers for invoices,
 * cycles, adjustments, configurations, payment-methods, service-entries and
 * analytics - and NONE for the five domains below. So these handlers never run,
 * on either host.
 *
 * Nothing calls them either: no page or component in client/src references a
 * dispute, credit memo, meter anomaly or billing schedule. This is a complete
 * back end - schema in shared/advanced-billing-schema.ts, storage methods in
 * server/storage.ts, Zod-validated handlers here - that was never connected to
 * anything.
 *
 * That is why it is still here rather than deleted with the other shadowed
 * routers: those were mocks or duplicates of live edge functions, and this is
 * real work with no replacement. Porting it is PROD-008c.
 */
import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('advanced-billing-routes');

import {
  insertMeterAnomalySchema,
  insertBillingDisputeSchema,
  insertInvoiceGenerationLogSchema,
  insertBillingScheduleSchema,
  insertCreditMemoSchema,
} from '@shared/advanced-billing-schema';

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

// ==================== Billing Rules — RETIRED (PROD-008b) ====================
//
// The seven /rules handlers that lived here are gone. /api/billing is proxied to
// supabase/functions/billing/, which serves the whole rules surface and serves it
// better: BillingRules.tsx toggles a rule with PATCH /rules/:id/activate, and
// Express never had a PATCH route at all. The edge list returns
// { rules, pagination }, which is what the page reads.
//
// The two by-relation reads (/rules/customer/:id, /rules/contract/:id) have no
// caller; the edge list covers the same ground with ?customerId= and
// ?contractId=.
//
// EVERYTHING BELOW STAYS, and is baselined rather than deleted. The anomalies,
// disputes, generation, schedules and credit-memo sections are a real feature:
// seven tables in shared/advanced-billing-schema.ts and ~40 storage methods
// behind them. They are unreachable — the proxy claims /api/billing and no edge
// counterpart exists — but no part of the frontend calls them either, so nothing
// is broken today and nothing is served by deleting working domain logic to move
// a counter. Wiring them up (edge handlers + a UI) is a feature story. This is
// the case the AC reserves: say so and leave it baselined.

// ==================== Meter Anomalies ====================

// GET /api/billing/anomalies - List all anomalies with filtering
router.get('/anomalies', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { anomalyType, severity, resolved, equipmentId, customerId } = req.query;

    const filters: any = {};
    if (anomalyType) filters.anomalyType = anomalyType as string;
    if (severity) filters.severity = severity as string;
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    if (equipmentId) filters.equipmentId = equipmentId as string;
    if (customerId) filters.customerId = customerId as string;

    const anomalies = await storage.getMeterAnomalies(user.tenantId, filters);
    res.json(anomalies);
  } catch (error) {
    log.error('Get meter anomalies error:', error);
    res.status(500).json({ error: 'Failed to fetch meter anomalies' });
  }
});

// GET /api/billing/anomalies/unresolved - Get unresolved anomalies
router.get('/anomalies/unresolved', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const anomalies = await storage.getUnresolvedAnomalies(user.tenantId);
    res.json(anomalies);
  } catch (error) {
    log.error('Get unresolved anomalies error:', error);
    res.status(500).json({ error: 'Failed to fetch unresolved anomalies' });
  }
});

// GET /api/billing/anomalies/:id - Get specific anomaly
router.get('/anomalies/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const anomaly = await storage.getMeterAnomaly(req.params.id);

    if (!anomaly || anomaly.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Meter anomaly not found' });
    }

    res.json(anomaly);
  } catch (error) {
    log.error('Get meter anomaly error:', error);
    res.status(500).json({ error: 'Failed to fetch meter anomaly' });
  }
});

// POST /api/billing/anomalies - Create anomaly (automated detection)
router.post('/anomalies', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertMeterAnomalySchema.parse(req.body);
    const anomaly = await storage.createMeterAnomaly({
      ...data,
      tenantId: user.tenantId,
    });

    res.status(201).json(anomaly);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create meter anomaly error:', error);
    res.status(500).json({ error: 'Failed to create meter anomaly' });
  }
});

// POST /api/billing/anomalies/:id/review - Review anomaly
router.post('/anomalies/:id/review', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getMeterAnomaly(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Meter anomaly not found' });
    }

    const { reviewNotes } = req.body;

    const reviewed = await storage.reviewAnomaly(
      req.params.id,
      user.tenantId,
      user.id,
      reviewNotes,
    );

    res.json(reviewed);
  } catch (error) {
    log.error('Review meter anomaly error:', error);
    res.status(500).json({ error: 'Failed to review meter anomaly' });
  }
});

// POST /api/billing/anomalies/:id/resolve - Resolve anomaly
router.post('/anomalies/:id/resolve', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getMeterAnomaly(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Meter anomaly not found' });
    }

    const { resolutionMethod, resolutionNotes, correctedBwReading, correctedColorReading } =
      req.body;

    const resolved = await storage.resolveAnomaly(
      req.params.id,
      user.tenantId,
      resolutionMethod,
      resolutionNotes,
      correctedBwReading,
      correctedColorReading,
    );

    res.json(resolved);
  } catch (error) {
    log.error('Resolve meter anomaly error:', error);
    res.status(500).json({ error: 'Failed to resolve meter anomaly' });
  }
});

// GET /api/billing/anomalies/equipment/:equipmentId - Get anomalies for equipment
router.get('/anomalies/equipment/:equipmentId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const anomalies = await storage.getAnomaliesByEquipment(req.params.equipmentId, user.tenantId);

    res.json(anomalies);
  } catch (error) {
    log.error('Get anomalies by equipment error:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies for equipment' });
  }
});

// ==================== Billing Disputes ====================

// GET /api/billing/disputes - List all disputes with filtering
router.get('/disputes', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { disputeType, disputeStatus, severity, customerId, invoiceId } = req.query;

    const filters: any = {};
    if (disputeType) filters.disputeType = disputeType as string;
    if (disputeStatus) filters.disputeStatus = disputeStatus as string;
    if (severity) filters.severity = severity as string;
    if (customerId) filters.customerId = customerId as string;
    if (invoiceId) filters.invoiceId = invoiceId as string;

    const disputes = await storage.getBillingDisputes(user.tenantId, filters);
    res.json(disputes);
  } catch (error) {
    log.error('Get billing disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch billing disputes' });
  }
});

// GET /api/billing/disputes/open - Get open disputes
router.get('/disputes/open', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const disputes = await storage.getOpenDisputes(user.tenantId);
    res.json(disputes);
  } catch (error) {
    log.error('Get open disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch open disputes' });
  }
});

// GET /api/billing/disputes/:id - Get specific dispute
router.get('/disputes/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const dispute = await storage.getBillingDispute(req.params.id);

    if (!dispute || dispute.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    res.json(dispute);
  } catch (error) {
    log.error('Get billing dispute error:', error);
    res.status(500).json({ error: 'Failed to fetch billing dispute' });
  }
});

// POST /api/billing/disputes - Create new dispute
router.post('/disputes', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertBillingDisputeSchema.parse(req.body);
    const dispute = await storage.createBillingDispute({
      ...data,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    res.status(201).json(dispute);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create billing dispute error:', error);
    res.status(500).json({ error: 'Failed to create billing dispute' });
  }
});

// PUT /api/billing/disputes/:id - Update dispute
router.put('/disputes/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getBillingDispute(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const data = insertBillingDisputeSchema.partial().parse(req.body);
    const updated = await storage.updateBillingDispute(req.params.id, user.tenantId, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update billing dispute error:', error);
    res.status(500).json({ error: 'Failed to update billing dispute' });
  }
});

// POST /api/billing/disputes/:id/assign - Assign dispute to user (Admin/Manager only)
router.post('/disputes/:id/assign', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to assign disputes' });
  }

  try {
    const existing = await storage.getBillingDispute(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ error: 'assignedTo is required' });
    }

    const assigned = await storage.assignDispute(req.params.id, user.tenantId, assignedTo);

    res.json(assigned);
  } catch (error) {
    log.error('Assign billing dispute error:', error);
    res.status(500).json({ error: 'Failed to assign billing dispute' });
  }
});

// POST /api/billing/disputes/:id/acknowledge - Acknowledge dispute
router.post('/disputes/:id/acknowledge', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getBillingDispute(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const acknowledged = await storage.acknowledgeDispute(req.params.id, user.tenantId, user.id);

    res.json(acknowledged);
  } catch (error) {
    log.error('Acknowledge billing dispute error:', error);
    res.status(500).json({ error: 'Failed to acknowledge billing dispute' });
  }
});

// POST /api/billing/disputes/:id/resolve - Resolve dispute (Admin/Manager only)
router.post('/disputes/:id/resolve', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to resolve disputes' });
  }

  try {
    const existing = await storage.getBillingDispute(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    // approved_credit_amount is a real column on billing_disputes and the resolution
    // is where it gets set, so accept it here.
    const { resolutionType, resolutionDescription, creditAmount } = req.body;
    if (!resolutionType) {
      return res.status(400).json({ error: 'resolutionType is required' });
    }

    const resolved = await storage.resolveDispute(req.params.id, user.tenantId, user.id, {
      resolutionType,
      resolutionDescription,
      creditAmount,
    });

    res.json(resolved);
  } catch (error) {
    log.error('Resolve billing dispute error:', error);
    res.status(500).json({ error: 'Failed to resolve billing dispute' });
  }
});

// POST /api/billing/disputes/:id/escalate - Escalate dispute (Admin/Manager only)
router.post('/disputes/:id/escalate', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to escalate disputes' });
  }

  try {
    const existing = await storage.getBillingDispute(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const { escalatedTo, escalationReason } = req.body;
    if (!escalatedTo) {
      return res.status(400).json({ error: 'escalatedTo is required' });
    }

    const escalated = await storage.escalateDispute(
      req.params.id,
      user.tenantId,
      escalatedTo,
      escalationReason,
    );

    res.json(escalated);
  } catch (error) {
    log.error('Escalate billing dispute error:', error);
    res.status(500).json({ error: 'Failed to escalate billing dispute' });
  }
});

// GET /api/billing/disputes/customer/:customerId - Get disputes for customer
router.get('/disputes/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const disputes = await storage.getDisputesByCustomer(req.params.customerId, user.tenantId);

    res.json(disputes);
  } catch (error) {
    log.error('Get disputes by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch disputes for customer' });
  }
});

// GET /api/billing/disputes/invoice/:invoiceId - Get disputes for invoice
router.get('/disputes/invoice/:invoiceId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const disputes = await storage.getDisputesByInvoice(req.params.invoiceId, user.tenantId);

    res.json(disputes);
  } catch (error) {
    log.error('Get disputes by invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch disputes for invoice' });
  }
});

// ==================== Invoice Generation ====================

// GET /api/billing/generation/logs - List invoice generation logs
router.get('/generation/logs', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { status, generationType, customerId, batchId } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (generationType) filters.generationType = generationType as string;
    if (customerId) filters.customerId = customerId as string;
    if (batchId) filters.batchId = batchId as string;

    const logs = await storage.getInvoiceGenerationLogs(user.tenantId, filters);
    res.json(logs);
  } catch (error) {
    log.error('Get invoice generation logs error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice generation logs' });
  }
});

// GET /api/billing/generation/logs/:id - Get specific log
router.get('/generation/logs/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const log = await storage.getInvoiceGenerationLog(req.params.id);

    if (!log || log.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Invoice generation log not found' });
    }

    res.json(log);
  } catch (error) {
    log.error('Get invoice generation log error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice generation log' });
  }
});

// POST /generation/generate and POST /generation/batch used to live here. They
// called storage.generateInvoice and storage.generateInvoiceBatch, neither of
// which has ever existed on DatabaseStorage — so both were a TypeError on the
// first request. The real meter-billing generator is
// supabase/functions/billing/handlers/generate-invoices.ts, reached at
// POST /api/billing/generate-invoices; PROD-008a tracks moving it into an atomic
// database function. Nothing is lost by removing two endpoints that could not run.

// GET /api/billing/generation/failed - Get failed generations
router.get('/generation/failed', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const failedLogs = await storage.getFailedGenerations(user.tenantId);
    res.json(failedLogs);
  } catch (error) {
    log.error('Get failed invoice generations error:', error);
    res.status(500).json({ error: 'Failed to fetch failed invoice generations' });
  }
});

// GET /api/billing/generation/stats - Get generation statistics
router.get('/generation/stats', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { startDate, endDate } = req.query;

    // getGenerationStats needs a bounded window; default to the last 30 days.
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const stats = await storage.getGenerationStats(user.tenantId, start, end);

    res.json(stats);
  } catch (error) {
    log.error('Get invoice generation stats error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice generation statistics' });
  }
});

// ==================== Billing Schedules ====================

// GET /api/billing/schedules - List all billing schedules
router.get('/schedules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { scheduleType, frequency, isActive, customerId } = req.query;

    const filters: any = {};
    if (scheduleType) filters.scheduleType = scheduleType as string;
    if (frequency) filters.frequency = frequency as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (customerId) filters.customerId = customerId as string;

    const schedules = await storage.getBillingSchedules(user.tenantId, filters);
    res.json(schedules);
  } catch (error) {
    log.error('Get billing schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch billing schedules' });
  }
});

// GET /api/billing/schedules/active - Get active schedules
router.get('/schedules/active', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const schedules = await storage.getActiveSchedules(user.tenantId);
    res.json(schedules);
  } catch (error) {
    log.error('Get active billing schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch active billing schedules' });
  }
});

// GET /api/billing/schedules/due - Get schedules due for execution
router.get('/schedules/due', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const schedules = await storage.getDueSchedules(user.tenantId, new Date());
    res.json(schedules);
  } catch (error) {
    log.error('Get due billing schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch due billing schedules' });
  }
});

// GET /api/billing/schedules/:id - Get specific schedule
router.get('/schedules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const schedule = await storage.getBillingSchedule(req.params.id);

    if (!schedule || schedule.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing schedule not found' });
    }

    res.json(schedule);
  } catch (error) {
    log.error('Get billing schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch billing schedule' });
  }
});

// POST /api/billing/schedules - Create new schedule (Admin/Manager only)
router.post('/schedules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to create billing schedules' });
  }

  try {
    const data = insertBillingScheduleSchema.parse(req.body);
    const schedule = await storage.createBillingSchedule({
      ...data,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create billing schedule error:', error);
    res.status(500).json({ error: 'Failed to create billing schedule' });
  }
});

// PUT /api/billing/schedules/:id - Update schedule (Admin/Manager only)
router.put('/schedules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to update billing schedules' });
  }

  try {
    const existing = await storage.getBillingSchedule(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing schedule not found' });
    }

    const data = insertBillingScheduleSchema.partial().parse(req.body);
    const updated = await storage.updateBillingSchedule(req.params.id, user.tenantId, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update billing schedule error:', error);
    res.status(500).json({ error: 'Failed to update billing schedule' });
  }
});

// DELETE /api/billing/schedules/:id - Delete schedule (Admin/Manager only)
router.delete('/schedules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to delete billing schedules' });
  }

  try {
    const schedule = await storage.getBillingSchedule(req.params.id);
    if (!schedule || schedule.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Billing schedule not found' });
    }

    await storage.deleteBillingSchedule(req.params.id, user.tenantId);
    res.status(204).send();
  } catch (error) {
    log.error('Delete billing schedule error:', error);
    res.status(500).json({ error: 'Failed to delete billing schedule' });
  }
});

// ==================== Credit Memos ====================

// GET /api/billing/credit-memos - List all credit memos
router.get('/credit-memos', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { creditStatus, customerId, invoiceId, disputeId } = req.query;

    const filters: any = {};
    if (creditStatus) filters.creditStatus = creditStatus as string;
    if (customerId) filters.customerId = customerId as string;
    if (invoiceId) filters.invoiceId = invoiceId as string;
    if (disputeId) filters.disputeId = disputeId as string;

    const creditMemos = await storage.getCreditMemos(user.tenantId, filters);
    res.json(creditMemos);
  } catch (error) {
    log.error('Get credit memos error:', error);
    res.status(500).json({ error: 'Failed to fetch credit memos' });
  }
});

// GET /api/billing/credit-memos/pending - Get pending credit memos
router.get('/credit-memos/pending', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const creditMemos = await storage.getPendingCreditMemos(user.tenantId);
    res.json(creditMemos);
  } catch (error) {
    log.error('Get pending credit memos error:', error);
    res.status(500).json({ error: 'Failed to fetch pending credit memos' });
  }
});

// GET /api/billing/credit-memos/:id - Get specific credit memo
router.get('/credit-memos/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const creditMemo = await storage.getCreditMemo(req.params.id);

    if (!creditMemo || creditMemo.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    res.json(creditMemo);
  } catch (error) {
    log.error('Get credit memo error:', error);
    res.status(500).json({ error: 'Failed to fetch credit memo' });
  }
});

// POST /api/billing/credit-memos - Create new credit memo (Admin/Manager only)
router.post('/credit-memos', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to create credit memos' });
  }

  try {
    const data = insertCreditMemoSchema.parse(req.body);
    const creditMemo = await storage.createCreditMemo({
      ...data,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    res.status(201).json(creditMemo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create credit memo error:', error);
    res.status(500).json({ error: 'Failed to create credit memo' });
  }
});

// PUT /api/billing/credit-memos/:id - Update credit memo
router.put('/credit-memos/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getCreditMemo(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const data = insertCreditMemoSchema.partial().parse(req.body);
    const updated = await storage.updateCreditMemo(req.params.id, user.tenantId, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update credit memo error:', error);
    res.status(500).json({ error: 'Failed to update credit memo' });
  }
});

// POST /api/billing/credit-memos/:id/approve - Approve credit memo (Admin/Manager only)
router.post('/credit-memos/:id/approve', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to approve credit memos' });
  }

  try {
    const existing = await storage.getCreditMemo(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const approved = await storage.approveCreditMemo(req.params.id, user.tenantId, user.id);

    res.json(approved);
  } catch (error) {
    log.error('Approve credit memo error:', error);
    res.status(500).json({ error: 'Failed to approve credit memo' });
  }
});

// POST /api/billing/credit-memos/:id/issue - Issue credit memo
router.post('/credit-memos/:id/issue', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to issue credit memos' });
  }

  try {
    const existing = await storage.getCreditMemo(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const issued = await storage.issueCreditMemo(req.params.id, user.tenantId);

    res.json(issued);
  } catch (error) {
    log.error('Issue credit memo error:', error);
    res.status(500).json({ error: 'Failed to issue credit memo' });
  }
});

// POST /api/billing/credit-memos/:id/apply - Apply credit to invoice
router.post('/credit-memos/:id/apply', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to apply credit memos' });
  }

  try {
    const existing = await storage.getCreditMemo(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: 'invoiceId is required' });
    }

    const applied = await storage.applyCreditToInvoice(req.params.id, user.tenantId, invoiceId);

    res.json(applied);
  } catch (error) {
    log.error('Apply credit memo error:', error);
    res.status(500).json({ error: 'Failed to apply credit memo' });
  }
});

// POST /api/billing/credit-memos/:id/void - Void credit memo (Admin only)
router.post('/credit-memos/:id/void', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Stricter check - only admin can void
  const isAdmin = user.role && user.role.toLowerCase().includes('admin');
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin role required to void credit memos' });
  }

  try {
    const existing = await storage.getCreditMemo(req.params.id);
    if (!existing || existing.tenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const { voidReason } = req.body;
    if (!voidReason) {
      return res.status(400).json({ error: 'voidReason is required' });
    }

    const voided = await storage.voidCreditMemo(req.params.id, user.tenantId, user.id, voidReason);

    res.json(voided);
  } catch (error) {
    log.error('Void credit memo error:', error);
    res.status(500).json({ error: 'Failed to void credit memo' });
  }
});

// GET /api/billing/credit-memos/customer/:customerId - Get credit memos for customer
router.get('/credit-memos/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const creditMemos = await storage.getCreditMemosByCustomer(
      req.params.customerId,
      user.tenantId,
    );
    res.json(creditMemos);
  } catch (error) {
    log.error('Get credit memos by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch credit memos for customer' });
  }
});

export default router;
