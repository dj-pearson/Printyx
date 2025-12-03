import express, { Request, Response } from 'express';
import { z } from 'zod';
import { automatedBillingService } from '../services/automated-billing-service';
import { billingEngineService } from '../services/billing-engine-service';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { billingSchedules, invoiceGenerationLogs } from '@shared/schema';

const router = express.Router();

// Helper function to check if user has admin/manager role
function isAdminOrManager(user: any): boolean {
  if (!user?.role) return false;
  const role = user.role || '';
  const roleLower = role.toLowerCase();
  return roleLower.includes('admin') || roleLower.includes('manager') || roleLower.includes('executive');
}

// ==================== Billing Schedules ====================

// GET /api/automated-billing/schedules - List billing schedules
router.get('/schedules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { isActive, contractId, customerId } = req.query;

    let whereConditions = [eq(billingSchedules.tenantId, user.tenantId)];

    if (isActive !== undefined) {
      whereConditions.push(eq(billingSchedules.isActive, isActive === 'true'));
    }

    if (contractId) {
      whereConditions.push(eq(billingSchedules.contractId, contractId as string));
    }

    if (customerId) {
      whereConditions.push(eq(billingSchedules.customerId, customerId as string));
    }

    const schedules = await db
      .select()
      .from(billingSchedules)
      .where(and(...whereConditions))
      .orderBy(desc(billingSchedules.nextRunDate));

    res.json(schedules);
  } catch (error) {
    console.error('Get billing schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch billing schedules' });
  }
});

// GET /api/automated-billing/schedules/due - Get schedules due for execution
router.get('/schedules/due', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const dueSchedules = await automatedBillingService.getDueSchedules(user.tenantId);
    res.json(dueSchedules);
  } catch (error) {
    console.error('Get due schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch due schedules' });
  }
});

// POST /api/automated-billing/schedules - Create billing schedule
router.post('/schedules', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const scheduleSchema = z.object({
      scheduleName: z.string(),
      scheduleDescription: z.string().optional(),
      scheduleType: z.enum(['recurring', 'one_time']),
      frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']),
      contractId: z.string().optional(),
      customerId: z.string().optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      autoSendInvoice: z.boolean().optional(),
      autoApplyLateFees: z.boolean().optional(),
      notifyBeforeDays: z.number().optional(),
    });

    const data = scheduleSchema.parse(req.body);

    const schedule = await automatedBillingService.createBillingSchedule(
      user.tenantId,
      data,
      user.id
    );

    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create billing schedule error:', error);
    res.status(500).json({ error: 'Failed to create billing schedule' });
  }
});

// PUT /api/automated-billing/schedules/:id - Update billing schedule
router.put('/schedules/:id', async (req: Request, res: Response) => {
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
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.id, req.params.id),
          eq(billingSchedules.tenantId, user.tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const updateSchema = z.object({
      scheduleName: z.string().optional(),
      scheduleDescription: z.string().optional(),
      frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      autoSendInvoice: z.boolean().optional(),
      autoApplyLateFees: z.boolean().optional(),
      notifyBeforeDays: z.number().optional(),
      isActive: z.boolean().optional(),
    });

    const data = updateSchema.parse(req.body);

    const [updated] = await db
      .update(billingSchedules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(billingSchedules.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update billing schedule error:', error);
    res.status(500).json({ error: 'Failed to update billing schedule' });
  }
});

// DELETE /api/automated-billing/schedules/:id - Delete billing schedule
router.delete('/schedules/:id', async (req: Request, res: Response) => {
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
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.id, req.params.id),
          eq(billingSchedules.tenantId, user.tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await db.delete(billingSchedules).where(eq(billingSchedules.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Delete billing schedule error:', error);
    res.status(500).json({ error: 'Failed to delete billing schedule' });
  }
});

// ==================== Billing Execution ====================

// POST /api/automated-billing/schedules/:id/execute - Execute a scheduled billing run
router.post('/schedules/:id/execute', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const result = await automatedBillingService.executeScheduledRun(
      req.params.id,
      user.tenantId,
      user.id
    );

    res.json(result);
  } catch (error) {
    console.error('Execute billing schedule error:', error);
    res.status(500).json({ error: 'Failed to execute billing schedule' });
  }
});

// POST /api/automated-billing/execute-all-due - Execute all due billing schedules
router.post('/execute-all-due', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const dueSchedules = await automatedBillingService.getDueSchedules(user.tenantId);
    const results: any[] = [];

    for (const schedule of dueSchedules) {
      const result = await automatedBillingService.executeScheduledRun(
        schedule.scheduleId,
        user.tenantId,
        user.id
      );
      results.push({
        scheduleId: schedule.scheduleId,
        scheduleName: schedule.scheduleName,
        ...result,
      });
    }

    res.json({
      schedulesProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error('Execute all due schedules error:', error);
    res.status(500).json({ error: 'Failed to execute due schedules' });
  }
});

// ==================== Meter Processing ====================

// POST /api/automated-billing/process-pending-meters - Process pending meter readings
router.post('/process-pending-meters', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const result = await automatedBillingService.processPendingMeterReadings(
      user.tenantId,
      user.id
    );

    res.json(result);
  } catch (error) {
    console.error('Process pending meters error:', error);
    res.status(500).json({ error: 'Failed to process pending meter readings' });
  }
});

// GET /api/automated-billing/meter-status - Get meter collection status
router.get('/meter-status', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const status = await automatedBillingService.getMeterCollectionStatus(user.tenantId);
    res.json(status);
  } catch (error) {
    console.error('Get meter status error:', error);
    res.status(500).json({ error: 'Failed to get meter collection status' });
  }
});

// ==================== Dashboard & Analytics ====================

// GET /api/automated-billing/dashboard - Get billing dashboard metrics
router.get('/dashboard', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const metrics = await automatedBillingService.getBillingDashboardMetrics(user.tenantId);
    res.json(metrics);
  } catch (error) {
    console.error('Get billing dashboard error:', error);
    res.status(500).json({ error: 'Failed to get billing dashboard metrics' });
  }
});

// GET /api/automated-billing/generation-logs - Get invoice generation logs
router.get('/generation-logs', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { status, batchId, limit } = req.query;

    let whereConditions = [eq(invoiceGenerationLogs.tenantId, user.tenantId)];

    if (status) {
      whereConditions.push(eq(invoiceGenerationLogs.status, status as string));
    }

    if (batchId) {
      whereConditions.push(eq(invoiceGenerationLogs.batchId, batchId as string));
    }

    let query = db
      .select()
      .from(invoiceGenerationLogs)
      .where(and(...whereConditions))
      .orderBy(desc(invoiceGenerationLogs.createdAt));

    if (limit) {
      query = query.limit(parseInt(limit as string)) as any;
    }

    const logs = await query;
    res.json(logs);
  } catch (error) {
    console.error('Get generation logs error:', error);
    res.status(500).json({ error: 'Failed to fetch generation logs' });
  }
});

// ==================== Manual Invoice Generation ====================

// POST /api/automated-billing/generate-invoice - Generate invoice for contract
router.post('/generate-invoice', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const generateSchema = z.object({
      contractId: z.string(),
      billingPeriodStart: z.coerce.date().optional(),
      billingPeriodEnd: z.coerce.date().optional(),
      autoSend: z.boolean().optional(),
      applyLateFees: z.boolean().optional(),
    });

    const data = generateSchema.parse(req.body);

    const invoice = await billingEngineService.generateInvoiceFromContract(
      data.contractId,
      user.tenantId,
      {
        billingPeriodStart: data.billingPeriodStart,
        billingPeriodEnd: data.billingPeriodEnd,
        autoSend: data.autoSend,
        applyLateFees: data.applyLateFees,
      }
    );

    res.status(201).json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Generate invoice error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// POST /api/automated-billing/bulk-generate - Bulk generate invoices
router.post('/bulk-generate', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const bulkSchema = z.object({
      contractIds: z.array(z.string()),
      billingPeriodStart: z.coerce.date().optional(),
      billingPeriodEnd: z.coerce.date().optional(),
      autoSend: z.boolean().optional(),
    });

    const data = bulkSchema.parse(req.body);

    const result = await billingEngineService.generateBulkInvoices(
      data.contractIds,
      user.tenantId,
      {
        billingPeriodStart: data.billingPeriodStart,
        billingPeriodEnd: data.billingPeriodEnd,
        autoSend: data.autoSend,
      }
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Bulk generate invoices error:', error);
    res.status(500).json({ error: 'Failed to bulk generate invoices' });
  }
});

export default router;
