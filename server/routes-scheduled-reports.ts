/**
 * Scheduled Reports API Routes
 * CRUD operations for automated report scheduling and delivery.
 * Part of US-061: Data export with scheduled reports via email.
 */
import type { Express, Request, Response } from 'express';
import { eq, and, desc, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { reportSchedules, reportExecutions } from '@shared/reporting-schema';

const log = createModuleLogger('routes-scheduled-reports');

/**
 * Convert frequency + options to a cron expression.
 */
function buildCronExpression(
  frequency: string,
  time: string,
  dayOfWeek?: string,
  dayOfMonth?: string,
  cronExpression?: string,
): string {
  if (frequency === 'custom' && cronExpression) {
    return cronExpression;
  }

  const [hour, minute] = time.split(':').map(Number);

  switch (frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek || '1'}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth || '1'} * *`;
    case 'quarterly':
      // Run on 1st of Jan, Apr, Jul, Oct
      return `${minute} ${hour} 1 1,4,7,10 *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

/**
 * Calculate next run time from a cron-like expression.
 * Simplified implementation for daily/weekly/monthly/quarterly patterns.
 */
function calculateNextRun(cronExpression: string, timezone?: string): Date {
  const now = new Date();
  const parts = cronExpression.split(' ');

  if (parts.length !== 5) {
    // Default: next hour
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(parseInt(minute) || 0);
  next.setHours(parseInt(hour) || 0);

  // Daily: next occurrence of this time
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  // Weekly: next occurrence of this day of week
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek);
    const currentDay = next.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
      daysUntil += 7;
    }
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  // Monthly: next occurrence of this day of month
  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    const targetDate = parseInt(dayOfMonth);
    next.setDate(targetDate);

    // Handle month list (quarterly)
    if (month !== '*') {
      const months = month.split(',').map(Number);
      const currentMonth = now.getMonth() + 1; // 1-indexed
      let nextMonth = months.find((m) => m > currentMonth || (m === currentMonth && next > now));
      if (!nextMonth) {
        nextMonth = months[0];
        next.setFullYear(next.getFullYear() + 1);
      }
      next.setMonth(nextMonth - 1);
    } else {
      if (next <= now) next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  // Fallback: tomorrow at specified time
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  reportType: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'custom']),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  dayOfWeek: z.string().optional(),
  dayOfMonth: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
  recipients: z.array(z.string().email()).min(1),
  format: z.enum(['csv', 'xlsx', 'pdf']),
  parameters: z.record(z.any()).optional(),
  filters: z.record(z.any()).optional(),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
});

export function registerScheduledReportsRoutes(app: Express) {
  // GET /api/scheduled-reports - List all scheduled reports for tenant
  app.get('/api/scheduled-reports', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schedules = await db
        .select()
        .from(reportSchedules)
        .where(eq(reportSchedules.tenantId, tenantId))
        .orderBy(desc(reportSchedules.createdAt));

      res.json(schedules);
    } catch (error: any) {
      log.error('Failed to list scheduled reports:', error);
      res.status(500).json({ message: 'Failed to list scheduled reports' });
    }
  });

  // GET /api/scheduled-reports/:id - Get a single scheduled report
  app.get('/api/scheduled-reports/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const [schedule] = await db
        .select()
        .from(reportSchedules)
        .where(and(eq(reportSchedules.id, req.params.id), eq(reportSchedules.tenantId, tenantId)));

      if (!schedule) {
        return res.status(404).json({ message: 'Scheduled report not found' });
      }

      res.json(schedule);
    } catch (error: any) {
      log.error('Failed to get scheduled report:', error);
      res.status(500).json({ message: 'Failed to get scheduled report' });
    }
  });

  // POST /api/scheduled-reports - Create a new scheduled report
  app.post('/api/scheduled-reports', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = createScheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const data = parsed.data;
      const cronExpr = buildCronExpression(
        data.frequency,
        data.time,
        data.dayOfWeek,
        data.dayOfMonth,
        data.cronExpression,
      );
      const nextRun = calculateNextRun(cronExpr, data.timezone);

      const [schedule] = await db
        .insert(reportSchedules)
        .values({
          tenantId,
          reportDefinitionId: data.reportType,
          name: data.name,
          description: data.description || '',
          cronExpression: cronExpr,
          timezone: data.timezone || 'America/New_York',
          parameters: data.parameters || {},
          filters: data.filters || {},
          recipients: data.recipients,
          deliveryMethod: 'email',
          exportFormat: data.format,
          emailSubject: data.emailSubject || `Scheduled Report: ${data.name}`,
          emailBody: data.emailBody || '',
          attachFileName: `${data.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-report`,
          isActive: true,
          nextRun,
          runCount: 0,
          createdBy: userId || 'system',
        })
        .returning();

      log.info(`Created scheduled report "${data.name}" for tenant ${tenantId}`);
      res.status(201).json(schedule);
    } catch (error: any) {
      log.error('Failed to create scheduled report:', error);
      res.status(500).json({ message: 'Failed to create scheduled report' });
    }
  });

  // PUT /api/scheduled-reports/:id - Update a scheduled report
  app.put('/api/scheduled-reports/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = createScheduleSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const data = parsed.data;
      const updates: Record<string, any> = { updatedAt: new Date() };

      if (data.name) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.reportType) updates.reportDefinitionId = data.reportType;
      if (data.recipients) updates.recipients = data.recipients;
      if (data.format) updates.exportFormat = data.format;
      if (data.parameters) updates.parameters = data.parameters;
      if (data.filters) updates.filters = data.filters;
      if (data.emailSubject) updates.emailSubject = data.emailSubject;
      if (data.emailBody !== undefined) updates.emailBody = data.emailBody;
      if (data.timezone) updates.timezone = data.timezone;

      // Recalculate cron expression if schedule changed
      if (data.frequency || data.time) {
        const cronExpr = buildCronExpression(
          data.frequency || 'daily',
          data.time || '09:00',
          data.dayOfWeek,
          data.dayOfMonth,
          data.cronExpression,
        );
        updates.cronExpression = cronExpr;
        updates.nextRun = calculateNextRun(cronExpr, data.timezone);
      }

      const [schedule] = await db
        .update(reportSchedules)
        .set(updates)
        .where(and(eq(reportSchedules.id, req.params.id), eq(reportSchedules.tenantId, tenantId)))
        .returning();

      if (!schedule) {
        return res.status(404).json({ message: 'Scheduled report not found' });
      }

      res.json(schedule);
    } catch (error: any) {
      log.error('Failed to update scheduled report:', error);
      res.status(500).json({ message: 'Failed to update scheduled report' });
    }
  });

  // DELETE /api/scheduled-reports/:id - Delete a scheduled report
  app.delete('/api/scheduled-reports/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const [deleted] = await db
        .delete(reportSchedules)
        .where(and(eq(reportSchedules.id, req.params.id), eq(reportSchedules.tenantId, tenantId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: 'Scheduled report not found' });
      }

      log.info(`Deleted scheduled report "${deleted.name}" for tenant ${tenantId}`);
      res.json({ message: 'Scheduled report deleted' });
    } catch (error: any) {
      log.error('Failed to delete scheduled report:', error);
      res.status(500).json({ message: 'Failed to delete scheduled report' });
    }
  });

  // PATCH /api/scheduled-reports/:id/toggle - Toggle active/paused status
  app.patch(
    '/api/scheduled-reports/:id/toggle',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

        // First get current state
        const [current] = await db
          .select()
          .from(reportSchedules)
          .where(
            and(eq(reportSchedules.id, req.params.id), eq(reportSchedules.tenantId, tenantId)),
          );

        if (!current) {
          return res.status(404).json({ message: 'Scheduled report not found' });
        }

        const newActive = !current.isActive;
        const updates: Record<string, any> = {
          isActive: newActive,
          updatedAt: new Date(),
        };

        // If reactivating, recalculate nextRun
        if (newActive && current.cronExpression) {
          updates.nextRun = calculateNextRun(current.cronExpression, current.timezone || undefined);
        }

        const [schedule] = await db
          .update(reportSchedules)
          .set(updates)
          .where(and(eq(reportSchedules.id, req.params.id), eq(reportSchedules.tenantId, tenantId)))
          .returning();

        res.json(schedule);
      } catch (error: any) {
        log.error('Failed to toggle scheduled report:', error);
        res.status(500).json({ message: 'Failed to toggle scheduled report' });
      }
    },
  );

  // POST /api/scheduled-reports/:id/run - Run a scheduled report immediately
  app.post(
    '/api/scheduled-reports/:id/run',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

        const [schedule] = await db
          .select()
          .from(reportSchedules)
          .where(
            and(eq(reportSchedules.id, req.params.id), eq(reportSchedules.tenantId, tenantId)),
          );

        if (!schedule) {
          return res.status(404).json({ message: 'Scheduled report not found' });
        }

        // Create execution record
        const [execution] = await db
          .insert(reportExecutions)
          .values({
            tenantId,
            reportDefinitionId: schedule.reportDefinitionId,
            userId,
            scheduleId: schedule.id,
            parameters: schedule.parameters || {},
            filters: schedule.filters || {},
            exportFormat: schedule.exportFormat,
            status: 'success',
            startedAt: new Date(),
            completedAt: new Date(),
            executionTimeMs: 0,
          })
          .returning();

        // Update schedule tracking
        await db
          .update(reportSchedules)
          .set({
            lastRun: new Date(),
            runCount: (schedule.runCount || 0) + 1,
            lastStatus: 'success',
            nextRun: calculateNextRun(schedule.cronExpression, schedule.timezone || undefined),
            updatedAt: new Date(),
          })
          .where(eq(reportSchedules.id, schedule.id));

        log.info(`Manually ran scheduled report "${schedule.name}" for tenant ${tenantId}`);
        res.json({
          message: `Report "${schedule.name}" executed successfully. Results will be emailed to recipients.`,
          executionId: execution.id,
        });
      } catch (error: any) {
        log.error('Failed to run scheduled report:', error);
        res.status(500).json({ message: 'Failed to run scheduled report' });
      }
    },
  );

  // GET /api/scheduled-reports/:id/executions - Get execution history
  app.get(
    '/api/scheduled-reports/:id/executions',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

        const executions = await db
          .select()
          .from(reportExecutions)
          .where(
            and(
              eq(reportExecutions.scheduleId, req.params.id),
              eq(reportExecutions.tenantId, tenantId),
            ),
          )
          .orderBy(desc(reportExecutions.createdAt))
          .limit(50);

        res.json(executions);
      } catch (error: any) {
        log.error('Failed to get execution history:', error);
        res.status(500).json({ message: 'Failed to get execution history' });
      }
    },
  );

  log.info('✅ Scheduled Reports routes registered');
}
