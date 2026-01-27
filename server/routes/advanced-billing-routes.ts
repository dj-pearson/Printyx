import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import {
  insertBillingRuleSchema,
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

// ==================== Billing Rules ====================

// GET /api/billing/rules - List all billing rules with filtering
router.get('/rules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { ruleType, ruleStatus, customerId, equipmentId, contractId } = req.query;

    const filters: any = {};
    if (ruleType) filters.ruleType = ruleType as string;
    if (ruleStatus) filters.ruleStatus = ruleStatus as string;
    if (customerId) filters.customerId = customerId as string;
    if (equipmentId) filters.equipmentId = equipmentId as string;
    if (contractId) filters.contractId = contractId as string;

    const rules = await storage.getBillingRules(user.tenant_id, filters);
    res.json(rules);
  } catch (error) {
    console.error('Get billing rules error:', error);
    res.status(500).json({ error: 'Failed to fetch billing rules' });
  }
});

// GET /api/billing/rules/:id - Get specific billing rule
router.get('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rule = await storage.getBillingRule(req.params.id);

    if (!rule || rule.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing rule not found' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Get billing rule error:', error);
    res.status(500).json({ error: 'Failed to fetch billing rule' });
  }
});

// POST /api/billing/rules - Create new billing rule (Admin/Manager only)
router.post('/rules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to create billing rules' });
  }

  try {
    const data = insertBillingRuleSchema.parse(req.body);
    const rule = await storage.createBillingRule({
      ...data,
      tenantId: user.tenant_id,
      createdBy: user.id,
    });

    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create billing rule error:', error);
    res.status(500).json({ error: 'Failed to create billing rule' });
  }
});

// PUT /api/billing/rules/:id - Update billing rule (Admin/Manager only)
router.put('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to update billing rules' });
  }

  try {
    const existing = await storage.getBillingRule(req.params.id);
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing rule not found' });
    }

    const data = insertBillingRuleSchema.partial().parse(req.body);
    const updated = await storage.updateBillingRule(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update billing rule error:', error);
    res.status(500).json({ error: 'Failed to update billing rule' });
  }
});

// DELETE /api/billing/rules/:id - Delete billing rule (Admin/Manager only)
router.delete('/rules/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to delete billing rules' });
  }

  try {
    const rule = await storage.getBillingRule(req.params.id);
    if (!rule || rule.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing rule not found' });
    }

    await storage.deleteBillingRule(req.params.id, user.tenant_id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete billing rule error:', error);
    res.status(500).json({ error: 'Failed to delete billing rule' });
  }
});

// GET /api/billing/rules/customer/:customerId - Get rules for customer
router.get('/rules/customer/:customerId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rules = await storage.getBillingRulesByCustomer(req.params.customerId, user.tenant_id);
    res.json(rules);
  } catch (error) {
    console.error('Get billing rules by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch billing rules for customer' });
  }
});

// GET /api/billing/rules/contract/:contractId - Get rules for contract
router.get('/rules/contract/:contractId', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rules = await storage.getBillingRulesByContract(req.params.contractId, user.tenant_id);
    res.json(rules);
  } catch (error) {
    console.error('Get billing rules by contract error:', error);
    res.status(500).json({ error: 'Failed to fetch billing rules for contract' });
  }
});

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

    const anomalies = await storage.getMeterAnomalies(user.tenant_id, filters);
    res.json(anomalies);
  } catch (error) {
    console.error('Get meter anomalies error:', error);
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
    const anomalies = await storage.getUnresolvedMeterAnomalies(user.tenant_id);
    res.json(anomalies);
  } catch (error) {
    console.error('Get unresolved anomalies error:', error);
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

    if (!anomaly || anomaly.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Meter anomaly not found' });
    }

    res.json(anomaly);
  } catch (error) {
    console.error('Get meter anomaly error:', error);
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
      tenantId: user.tenant_id,
    });

    res.status(201).json(anomaly);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create meter anomaly error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Meter anomaly not found' });
    }

    const { reviewNotes } = req.body;

    const reviewed = await storage.reviewMeterAnomaly(
      req.params.id,
      user.tenant_id,
      user.id,
      reviewNotes,
    );

    res.json(reviewed);
  } catch (error) {
    console.error('Review meter anomaly error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Meter anomaly not found' });
    }

    const { resolutionMethod, resolutionNotes, correctedBwReading, correctedColorReading } =
      req.body;

    const resolved = await storage.resolveMeterAnomaly(
      req.params.id,
      user.tenant_id,
      resolutionMethod,
      resolutionNotes,
      correctedBwReading,
      correctedColorReading,
    );

    res.json(resolved);
  } catch (error) {
    console.error('Resolve meter anomaly error:', error);
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
    const anomalies = await storage.getAnomaliesByEquipment(req.params.equipmentId, user.tenant_id);

    res.json(anomalies);
  } catch (error) {
    console.error('Get anomalies by equipment error:', error);
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

    const disputes = await storage.getBillingDisputes(user.tenant_id, filters);
    res.json(disputes);
  } catch (error) {
    console.error('Get billing disputes error:', error);
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
    const disputes = await storage.getOpenBillingDisputes(user.tenant_id);
    res.json(disputes);
  } catch (error) {
    console.error('Get open disputes error:', error);
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

    if (!dispute || dispute.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    res.json(dispute);
  } catch (error) {
    console.error('Get billing dispute error:', error);
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
      tenantId: user.tenant_id,
      createdBy: user.id,
    });

    res.status(201).json(dispute);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create billing dispute error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const data = insertBillingDisputeSchema.partial().parse(req.body);
    const updated = await storage.updateBillingDispute(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update billing dispute error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ error: 'assignedTo is required' });
    }

    const assigned = await storage.assignBillingDispute(req.params.id, user.tenant_id, assignedTo);

    res.json(assigned);
  } catch (error) {
    console.error('Assign billing dispute error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const acknowledged = await storage.acknowledgeBillingDispute(req.params.id, user.tenant_id);

    res.json(acknowledged);
  } catch (error) {
    console.error('Acknowledge billing dispute error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const { resolutionType, resolutionDescription } = req.body;
    if (!resolutionType) {
      return res.status(400).json({ error: 'resolutionType is required' });
    }

    const resolved = await storage.resolveBillingDispute(
      req.params.id,
      user.tenant_id,
      user.id,
      resolutionType,
      resolutionDescription,
    );

    res.json(resolved);
  } catch (error) {
    console.error('Resolve billing dispute error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing dispute not found' });
    }

    const { escalatedTo, escalationReason } = req.body;
    if (!escalatedTo) {
      return res.status(400).json({ error: 'escalatedTo is required' });
    }

    const escalated = await storage.escalateBillingDispute(
      req.params.id,
      user.tenant_id,
      escalatedTo,
      escalationReason,
    );

    res.json(escalated);
  } catch (error) {
    console.error('Escalate billing dispute error:', error);
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
    const disputes = await storage.getBillingDisputesByCustomer(
      req.params.customerId,
      user.tenant_id,
    );

    res.json(disputes);
  } catch (error) {
    console.error('Get disputes by customer error:', error);
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
    const disputes = await storage.getBillingDisputesByInvoice(
      req.params.invoiceId,
      user.tenant_id,
    );

    res.json(disputes);
  } catch (error) {
    console.error('Get disputes by invoice error:', error);
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

    const logs = await storage.getInvoiceGenerationLogs(user.tenant_id, filters);
    res.json(logs);
  } catch (error) {
    console.error('Get invoice generation logs error:', error);
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

    if (!log || log.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Invoice generation log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Get invoice generation log error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice generation log' });
  }
});

// POST /api/billing/generation/generate - Generate invoices (manual trigger)
router.post('/generation/generate', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to generate invoices' });
  }

  try {
    const { customerId, contractId, billingPeriodStart, billingPeriodEnd } = req.body;

    if (!customerId || !billingPeriodStart || !billingPeriodEnd) {
      return res.status(400).json({
        error: 'customerId, billingPeriodStart, and billingPeriodEnd are required',
      });
    }

    const result = await storage.generateInvoice(
      user.tenant_id,
      customerId,
      contractId,
      new Date(billingPeriodStart),
      new Date(billingPeriodEnd),
      user.id,
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// POST /api/billing/generation/batch - Generate batch of invoices
router.post('/generation/batch', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to generate invoice batches' });
  }

  try {
    const { customerIds, billingPeriodStart, billingPeriodEnd } = req.body;

    if (!customerIds || !Array.isArray(customerIds) || !billingPeriodStart || !billingPeriodEnd) {
      return res.status(400).json({
        error: 'customerIds (array), billingPeriodStart, and billingPeriodEnd are required',
      });
    }

    const results = await storage.generateInvoiceBatch(
      user.tenant_id,
      customerIds,
      new Date(billingPeriodStart),
      new Date(billingPeriodEnd),
      user.id,
    );

    res.status(201).json(results);
  } catch (error) {
    console.error('Generate invoice batch error:', error);
    res.status(500).json({ error: 'Failed to generate invoice batch' });
  }
});

// GET /api/billing/generation/failed - Get failed generations
router.get('/generation/failed', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const failedLogs = await storage.getFailedInvoiceGenerations(user.tenant_id);
    res.json(failedLogs);
  } catch (error) {
    console.error('Get failed invoice generations error:', error);
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

    const stats = await storage.getInvoiceGenerationStats(
      user.tenant_id,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
    );

    res.json(stats);
  } catch (error) {
    console.error('Get invoice generation stats error:', error);
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

    const schedules = await storage.getBillingSchedules(user.tenant_id, filters);
    res.json(schedules);
  } catch (error) {
    console.error('Get billing schedules error:', error);
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
    const schedules = await storage.getActiveBillingSchedules(user.tenant_id);
    res.json(schedules);
  } catch (error) {
    console.error('Get active billing schedules error:', error);
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
    const schedules = await storage.getDueBillingSchedules(user.tenant_id);
    res.json(schedules);
  } catch (error) {
    console.error('Get due billing schedules error:', error);
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

    if (!schedule || schedule.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing schedule not found' });
    }

    res.json(schedule);
  } catch (error) {
    console.error('Get billing schedule error:', error);
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
      tenantId: user.tenant_id,
      createdBy: user.id,
    });

    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create billing schedule error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing schedule not found' });
    }

    const data = insertBillingScheduleSchema.partial().parse(req.body);
    const updated = await storage.updateBillingSchedule(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update billing schedule error:', error);
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
    if (!schedule || schedule.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Billing schedule not found' });
    }

    await storage.deleteBillingSchedule(req.params.id, user.tenant_id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete billing schedule error:', error);
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

    const creditMemos = await storage.getCreditMemos(user.tenant_id, filters);
    res.json(creditMemos);
  } catch (error) {
    console.error('Get credit memos error:', error);
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
    const creditMemos = await storage.getPendingCreditMemos(user.tenant_id);
    res.json(creditMemos);
  } catch (error) {
    console.error('Get pending credit memos error:', error);
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

    if (!creditMemo || creditMemo.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    res.json(creditMemo);
  } catch (error) {
    console.error('Get credit memo error:', error);
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
      tenantId: user.tenant_id,
      createdBy: user.id,
    });

    res.status(201).json(creditMemo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create credit memo error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const data = insertCreditMemoSchema.partial().parse(req.body);
    const updated = await storage.updateCreditMemo(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update credit memo error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const approved = await storage.approveCreditMemo(req.params.id, user.tenant_id, user.id);

    res.json(approved);
  } catch (error) {
    console.error('Approve credit memo error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const issued = await storage.issueCreditMemo(req.params.id, user.tenant_id);

    res.json(issued);
  } catch (error) {
    console.error('Issue credit memo error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: 'invoiceId is required' });
    }

    const applied = await storage.applyCreditMemo(req.params.id, user.tenant_id, invoiceId);

    res.json(applied);
  } catch (error) {
    console.error('Apply credit memo error:', error);
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
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Credit memo not found' });
    }

    const { voidReason } = req.body;
    if (!voidReason) {
      return res.status(400).json({ error: 'voidReason is required' });
    }

    const voided = await storage.voidCreditMemo(req.params.id, user.tenant_id, user.id, voidReason);

    res.json(voided);
  } catch (error) {
    console.error('Void credit memo error:', error);
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
      user.tenant_id,
    );
    res.json(creditMemos);
  } catch (error) {
    console.error('Get credit memos by customer error:', error);
    res.status(500).json({ error: 'Failed to fetch credit memos for customer' });
  }
});

export default router;
