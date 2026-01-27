/**
 * AUTOMATED BILLING SERVICE
 *
 * Handles scheduled invoice generation, billing automation,
 * and batch processing for meter-based billing.
 *
 * NOTE: This service is currently disabled as billingSchedules and
 * invoiceGenerationLogs tables need to be added to the schema.
 */

import { db } from '../db';
import { eq, and, lte, gte, isNull, sql, desc } from 'drizzle-orm';
import {
  invoices,
  invoiceLineItems,
  contracts,
  meterReadings,
  businessRecords,
  billingSchedules,
  invoiceGenerationLogs,
} from '@shared/schema';
import { billingEngine } from './billing-engine-service';

export interface ScheduledBillingRun {
  scheduleId: string;
  scheduleName: string;
  contractId?: string;
  customerId?: string;
  frequency: string;
  nextRunDate: Date;
}

export interface BatchBillingResult {
  runId: string;
  startTime: Date;
  endTime: Date;
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  invoicesGenerated: string[];
  errors: { customerId?: string; contractId?: string; error: string }[];
}

export interface MeterCollectionStatus {
  equipmentId: string;
  serialNumber?: string;
  lastReading?: Date;
  readingSource?: string;
  daysUntilDue: number;
  status: 'current' | 'due' | 'overdue' | 'missing';
}

class AutomatedBillingService {
  /**
   * Get all billing schedules due for execution
   */
  async getDueSchedules(tenantId: string): Promise<ScheduledBillingRun[]> {
    const now = new Date();

    const schedules = await db
      .select()
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.tenant_id, tenantId),
          eq(billingSchedules.isActive, true),
          lte(billingSchedules.nextRunDate, now),
        ),
      );

    return schedules.map((s) => ({
      scheduleId: s.id,
      scheduleName: s.scheduleName,
      contractId: s.contractId || undefined,
      customerId: s.customerId || undefined,
      frequency: s.frequency,
      nextRunDate: new Date(s.nextRunDate),
    }));
  }

  /**
   * Execute a scheduled billing run
   */
  async executeScheduledRun(
    scheduleId: string,
    tenantId: string,
    triggeredBy: string,
  ): Promise<BatchBillingResult> {
    const startTime = new Date();
    const runId = `BR-${startTime
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .substring(0, 14)}`;
    const invoicesGenerated: string[] = [];
    const errors: { customerId?: string; contractId?: string; error: string }[] = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    try {
      // Get schedule details
      const [schedule] = await db
        .select()
        .from(billingSchedules)
        .where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenant_id, tenantId)))
        .limit(1);

      if (!schedule) {
        throw new Error(`Schedule not found: ${scheduleId}`);
      }

      // Determine billing period
      const billingPeriodEnd = new Date();
      billingPeriodEnd.setHours(23, 59, 59, 999);

      const billingPeriodStart = this.calculatePeriodStart(schedule.frequency, billingPeriodEnd);

      // Get contracts to process
      let contractsToProcess: any[] = [];

      if (schedule.contractId) {
        // Single contract billing
        const [contract] = await db
          .select()
          .from(contracts)
          .where(and(eq(contracts.id, schedule.contractId), eq(contracts.tenant_id, tenantId)))
          .limit(1);

        if (contract) {
          contractsToProcess = [contract];
        }
      } else if (schedule.customerId) {
        // All contracts for a customer
        contractsToProcess = await db
          .select()
          .from(contracts)
          .where(
            and(
              eq(contracts.customerId, schedule.customerId),
              eq(contracts.tenant_id, tenantId),
              eq(contracts.status, 'active'),
            ),
          );
      } else {
        // All active contracts for the tenant
        contractsToProcess = await db
          .select()
          .from(contracts)
          .where(and(eq(contracts.tenant_id, tenantId), eq(contracts.status, 'active')));
      }

      // Process each contract
      for (const contract of contractsToProcess) {
        try {
          // Check if contract needs billing
          const shouldBill = await this.shouldBillContract(
            contract,
            billingPeriodStart,
            billingPeriodEnd,
            tenantId,
          );

          if (!shouldBill.bill) {
            skipped++;
            continue;
          }

          // Generate invoice
          const invoice = await billingEngine.generateInvoiceFromContract(contract.id, tenantId, {
            billingPeriodStart,
            billingPeriodEnd,
            autoSend: schedule.autoSendInvoice || false,
            applyLateFees: schedule.autoApplyLateFees || false,
          });

          invoicesGenerated.push(invoice.id);
          successful++;

          // Log generation
          await this.logInvoiceGeneration(
            tenantId,
            runId,
            invoice.id,
            contract.id,
            contract.customerId,
            billingPeriodStart,
            billingPeriodEnd,
            'success',
            triggeredBy,
          );
        } catch (error: any) {
          failed++;
          errors.push({
            customerId: contract.customerId,
            contractId: contract.id,
            error: error.message,
          });

          // Log failure
          await this.logInvoiceGeneration(
            tenantId,
            runId,
            null,
            contract.id,
            contract.customerId,
            billingPeriodStart,
            billingPeriodEnd,
            'failed',
            triggeredBy,
            error.message,
          );
        }
      }

      // Update schedule's next run date
      const nextRunDate = this.calculateNextRunDate(schedule.frequency, new Date());
      await db
        .update(billingSchedules)
        .set({
          lastRunDate: new Date(),
          nextRunDate,
          updatedAt: new Date(),
        })
        .where(eq(billingSchedules.id, scheduleId));
    } catch (error: any) {
      errors.push({ error: error.message });
    }

    return {
      runId,
      startTime,
      endTime: new Date(),
      totalProcessed: successful + failed + skipped,
      successful,
      failed,
      skipped,
      invoicesGenerated,
      errors,
    };
  }

  /**
   * Check if a contract should be billed
   */
  private async shouldBillContract(
    contract: any,
    periodStart: Date,
    periodEnd: Date,
    tenantId: string,
  ): Promise<{ bill: boolean; reason?: string }> {
    // Check contract status
    if (contract.status !== 'active') {
      return { bill: false, reason: 'Contract not active' };
    }

    // Check if already billed for this period
    const existingInvoice = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.tenant_id, tenantId),
          eq(invoices.contractId, contract.id),
          gte(invoices.billingPeriodStart, periodStart),
          lte(invoices.billingPeriodEnd, periodEnd),
        ),
      )
      .limit(1);

    if (existingInvoice.length > 0) {
      return { bill: false, reason: 'Already billed for this period' };
    }

    // Check if there are meter readings to bill
    const readings = await db
      .select()
      .from(meterReadings)
      .where(
        and(
          eq(meterReadings.tenant_id, tenantId),
          eq(meterReadings.contractId, contract.id),
          gte(meterReadings.readingDate, periodStart),
          lte(meterReadings.readingDate, periodEnd),
          eq(meterReadings.billingStatus, 'pending'),
        ),
      )
      .limit(1);

    if (readings.length === 0 && !contract.hasBaseCharge) {
      return { bill: false, reason: 'No meter readings and no base charge' };
    }

    return { bill: true };
  }

  /**
   * Calculate billing period start based on frequency
   */
  private calculatePeriodStart(frequency: string, periodEnd: Date): Date {
    const start = new Date(periodEnd);

    switch (frequency) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        start.setDate(1);
        break;
      case 'annual':
        start.setFullYear(start.getFullYear() - 1);
        start.setMonth(0);
        start.setDate(1);
        break;
      default:
        start.setMonth(start.getMonth() - 1);
    }

    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Calculate next run date based on frequency
   */
  private calculateNextRunDate(frequency: string, currentDate: Date): Date {
    const next = new Date(currentDate);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'annual':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }

    next.setHours(9, 0, 0, 0); // Default to 9 AM
    return next;
  }

  /**
   * Log invoice generation attempt
   */
  private async logInvoiceGeneration(
    tenantId: string,
    batchId: string,
    invoiceId: string | null,
    contractId: string,
    customerId: string,
    periodStart: Date,
    periodEnd: Date,
    status: 'success' | 'failed' | 'partial' | 'skipped',
    triggeredBy: string,
    errorMessage?: string,
  ): Promise<void> {
    await db.insert(invoiceGenerationLogs).values({
      tenantId,
      batchId,
      generationType: 'automated',
      invoiceId,
      contractId,
      customerId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      status,
      triggeredBy,
      triggeredByEvent: 'scheduled_run',
      errorOccurred: status === 'failed',
      errorMessage: errorMessage || null,
    });
  }

  /**
   * Get meter collection status for equipment
   */
  async getMeterCollectionStatus(tenantId: string): Promise<MeterCollectionStatus[]> {
    // Get all active equipment with contracts
    const equipment = await db.execute(sql`
      SELECT
        e.id as equipment_id,
        e.serial_number,
        e.model,
        mr.reading_date as last_reading,
        mr.collection_method as reading_source,
        c.billing_cycle
      FROM equipment e
      LEFT JOIN contracts c ON e.id = c.equipment_id AND c.status = 'active'
      LEFT JOIN LATERAL (
        SELECT reading_date, collection_method
        FROM meter_readings
        WHERE equipment_id = e.id AND tenant_id = ${tenantId}
        ORDER BY reading_date DESC
        LIMIT 1
      ) mr ON true
      WHERE e.tenant_id = ${tenantId}
      AND c.id IS NOT NULL
    `);

    const results: MeterCollectionStatus[] = [];
    const now = new Date();

    for (const row of equipment.rows as any[]) {
      const lastReading = row.last_reading ? new Date(row.last_reading) : null;
      const billingCycle = row.billing_cycle || 'monthly';

      // Calculate days until reading is due
      let daysUntilDue = 30; // Default monthly
      if (billingCycle === 'weekly') daysUntilDue = 7;
      if (billingCycle === 'quarterly') daysUntilDue = 90;

      let daysSinceReading = lastReading
        ? Math.floor((now.getTime() - lastReading.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let status: 'current' | 'due' | 'overdue' | 'missing';
      if (!lastReading) {
        status = 'missing';
      } else if (daysSinceReading > daysUntilDue + 7) {
        status = 'overdue';
      } else if (daysSinceReading > daysUntilDue - 3) {
        status = 'due';
      } else {
        status = 'current';
      }

      results.push({
        equipmentId: row.equipment_id,
        serialNumber: row.serial_number,
        lastReading: lastReading || undefined,
        readingSource: row.reading_source,
        daysUntilDue: daysUntilDue - daysSinceReading,
        status,
      });
    }

    return results;
  }

  /**
   * Process pending meter readings for billing
   */
  async processPendingMeterReadings(
    tenantId: string,
    triggeredBy: string,
  ): Promise<{ processed: number; billed: number; errors: number }> {
    let processed = 0;
    let billed = 0;
    let errors = 0;

    // Get pending meter readings grouped by contract
    const pendingReadings = await db
      .select()
      .from(meterReadings)
      .where(and(eq(meterReadings.tenant_id, tenantId), eq(meterReadings.billingStatus, 'pending')))
      .orderBy(meterReadings.contractId, meterReadings.readingDate);

    // Group by contract
    const byContract = new Map<string, any[]>();
    for (const reading of pendingReadings) {
      if (!reading.contractId) continue;
      if (!byContract.has(reading.contractId)) {
        byContract.set(reading.contractId, []);
      }
      byContract.get(reading.contractId)!.push(reading);
    }

    // Process each contract's readings
    for (const [contractId, readings] of byContract) {
      processed += readings.length;

      try {
        // Check if we have enough readings to generate an invoice
        if (readings.length === 0) continue;

        // Get the latest reading for billing
        const latestReading = readings[readings.length - 1];

        // Generate invoice
        const invoice = await billingEngine.generateInvoiceFromContract(contractId, tenantId, {
          meterReadings: readings,
        });

        // Mark readings as billed
        for (const reading of readings) {
          await db
            .update(meterReadings)
            .set({
              billingStatus: 'billed',
              updatedAt: new Date(),
            })
            .where(eq(meterReadings.id, reading.id));
        }

        billed++;
      } catch (error: any) {
        errors++;
        console.error(`Error processing readings for contract ${contractId}:`, error);
      }
    }

    return { processed, billed, errors };
  }

  /**
   * Create a billing schedule
   */
  async createBillingSchedule(
    tenantId: string,
    data: {
      scheduleName: string;
      scheduleDescription?: string;
      scheduleType: 'recurring' | 'one_time';
      frequency: string;
      contractId?: string;
      customerId?: string;
      dayOfMonth?: number;
      dayOfWeek?: number;
      autoSendInvoice?: boolean;
      autoApplyLateFees?: boolean;
      notifyBeforeDays?: number;
    },
    createdBy: string,
  ): Promise<any> {
    const nextRunDate = this.calculateNextRunDate(data.frequency, new Date());

    const [schedule] = await db
      .insert(billingSchedules)
      .values({
        tenantId,
        scheduleName: data.scheduleName,
        scheduleDescription: data.scheduleDescription,
        scheduleType: data.scheduleType,
        frequency: data.frequency,
        contractId: data.contractId,
        customerId: data.customerId,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        nextRunDate,
        isActive: true,
        autoSendInvoice: data.autoSendInvoice || false,
        autoApplyLateFees: data.autoApplyLateFees || false,
        notifyBeforeDays: data.notifyBeforeDays || 3,
        createdBy,
      })
      .returning();

    return schedule;
  }

  /**
   * Get billing dashboard metrics
   */
  async getBillingDashboardMetrics(tenantId: string): Promise<{
    pendingInvoices: number;
    overdueInvoices: number;
    pendingMeterReadings: number;
    scheduledRuns: number;
    recentGenerations: any[];
    collectionStatus: MeterCollectionStatus[];
  }> {
    const now = new Date();

    // Get pending invoices count
    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(eq(invoices.tenant_id, tenantId), eq(invoices.status, 'open')));

    // Get overdue invoices count
    const [overdueResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(eq(invoices.tenant_id, tenantId), eq(invoices.status, 'overdue')));

    // Get pending meter readings count
    const [pendingReadingsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(meterReadings)
      .where(
        and(eq(meterReadings.tenant_id, tenantId), eq(meterReadings.billingStatus, 'pending')),
      );

    // Get scheduled runs count (due in next 7 days)
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const [scheduledResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.tenant_id, tenantId),
          eq(billingSchedules.isActive, true),
          lte(billingSchedules.nextRunDate, weekFromNow),
        ),
      );

    // Get recent generation logs
    const recentGenerations = await db
      .select()
      .from(invoiceGenerationLogs)
      .where(eq(invoiceGenerationLogs.tenant_id, tenantId))
      .orderBy(desc(invoiceGenerationLogs.created_at))
      .limit(10);

    // Get meter collection status
    const collectionStatus = await this.getMeterCollectionStatus(tenantId);

    return {
      pendingInvoices: Number(pendingResult.count) || 0,
      overdueInvoices: Number(overdueResult.count) || 0,
      pendingMeterReadings: Number(pendingReadingsResult.count) || 0,
      scheduledRuns: Number(scheduledResult.count) || 0,
      recentGenerations,
      collectionStatus,
    };
  }
}

export const automatedBillingService = new AutomatedBillingService();
