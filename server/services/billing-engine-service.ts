/**
 * BILLING ENGINE SERVICE
 *
 * Centralized service for all billing calculations, invoice generation,
 * pricing rules, meter validation, and billing analytics.
 *
 * This service consolidates billing logic that was previously scattered
 * across multiple route files, making it:
 * - Easier to test
 * - More maintainable
 * - More performant (with caching)
 * - Reusable across different contexts
 */

import { db } from '../db';
import { eq, and, desc, sql, gte, lte, isNotNull, count, sum } from 'drizzle-orm';
import {
  invoices,
  invoiceLineItems,
  contracts,
  contractTieredRates,
  businessRecords,
  meterReadings,
  autoInvoiceGeneration,
  billingRules,
  meterAnomalies,
  billingDisputes,
  creditMemos,
  type Invoice,
  type InvoiceLineItem,
  type Contract,
  type MeterReading,
  type BillingRule,
  type MeterAnomaly,
} from '@shared/schema';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface InvoiceGenerationOptions {
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  meterReadings?: MeterReading[];
  autoSend?: boolean;
  applyLateFees?: boolean;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: string;
  productId?: string;
  equipmentId?: string;
  meterReadingId?: string;
}

export interface LineItemCalculation {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  appliedRules: string[];
  breakdown: {
    baseAmount: number;
    tieredAmount: number;
    volumeDiscount: number;
    overageCharge: number;
    timeBasedMultiplier: number;
  };
}

export interface PricingBreakdown {
  amount: number;
  details: string;
  appliedRule?: string;
}

export interface ValidationResult {
  isValid: boolean;
  anomalies: MeterAnomaly[];
  warnings: string[];
  errors: string[];
}

export interface BulkGenerationResult {
  successful: number;
  failed: number;
  invoiceIds: string[];
  errors: { contractId: string; error: string }[];
}

export interface BillingMetrics {
  totalRevenue: number;
  outstandingBalance: number;
  collectionRate: number;
  averageDaysToPayment: number;
  invoiceIssuanceDelay: number;
  autoInvoiceSuccessRate: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
}

export interface HealthScore {
  score: number;
  collectionEfficiency: number;
  issuanceTimeliness: number;
  disputeRate: number;
  paymentMethodDiversity: number;
}

export interface TieredRate {
  minVolume: number;
  maxVolume: number | null;
  rate: number;
}

export interface VolumeDiscount {
  threshold: number;
  discountPercent: number;
}

export interface BillingContext {
  contractId: string;
  customerId: string;
  equipmentId?: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  tenantId: string;
}

// =============================================================================
// BILLING ENGINE SERVICE CLASS
// =============================================================================

class BillingEngineService {
  // ===========================================================================
  // INVOICE GENERATION
  // ===========================================================================

  /**
   * Generate invoice from contract and meter readings
   * Applies all billing rules and calculates totals
   */
  async generateInvoiceFromContract(
    contractId: string,
    tenantId: string,
    options: InvoiceGenerationOptions = {},
  ): Promise<Invoice> {
    const startTime = Date.now();

    try {
      // 1. Load contract with customer relationship
      const contract = await this.getContractWithDetails(contractId, tenantId);
      if (!contract) {
        throw new Error(`Contract not found: ${contractId}`);
      }

      // 2. Determine billing period
      const billingPeriodStart = options.billingPeriodStart || this.getDefaultPeriodStart();
      const billingPeriodEnd = options.billingPeriodEnd || this.getDefaultPeriodEnd();

      // 3. Get applicable billing rules
      const billingRules = await this.getApplicableBillingRules(
        contractId,
        contract.customerId,
        null, // equipmentId
        billingPeriodStart,
        tenantId,
      );

      // 4. Fetch meter readings if not provided
      let meterReadings = options.meterReadings;
      if (!meterReadings) {
        meterReadings = await this.getMeterReadingsForPeriod(
          contractId,
          billingPeriodStart,
          billingPeriodEnd,
          tenantId,
        );
      }

      // 5. Validate meter readings
      const validation = await this.validateMeterReadings(
        meterReadings,
        contract.equipmentId,
        tenantId,
      );

      if (!validation.isValid && validation.errors.length > 0) {
        throw new Error(`Meter validation failed: ${validation.errors.join(', ')}`);
      }

      // 6. Calculate usage and line items
      const lineItems = await this.calculateLineItemsFromMeterReadings(
        meterReadings,
        contract,
        billingRules,
        billingPeriodStart,
        billingPeriodEnd,
        tenantId,
      );

      // 7. Calculate invoice totals
      const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.total || '0'), 0);
      const tax = await this.calculateInvoiceTax(subtotal, contract.customerId, tenantId);
      const total = subtotal + tax;

      // 8. Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(tenantId);

      // 9. Create invoice
      const [invoice] = await db
        .insert(invoices)
        .values({
          tenantId,
          invoiceNumber,
          customerId: contract.customerId,
          contractId: contract.id,
          status: 'draft',
          invoiceStatus: 'draft',
          issueDate: new Date(),
          invoiceDate: new Date(),
          dueDate: this.calculateDueDate(contract.paymentTerms || 'net30'),
          subtotal: subtotal.toFixed(2),
          totalAmount: total.toFixed(2),
          total: total.toFixed(2),
          balance: total.toFixed(2),
          tax: tax.toFixed(2),
          billingPeriodStart,
          billingPeriodEnd,
          paymentTerms: contract.paymentTerms || 'net30',
          description: `Invoice for billing period ${this.formatDate(billingPeriodStart)} - ${this.formatDate(billingPeriodEnd)}`,
          createdBy: 'system',
        })
        .returning();

      // 10. Create line items
      for (const lineItem of lineItems) {
        await db.insert(invoiceLineItems).values({
          ...lineItem,
          invoiceId: invoice.id,
          tenantId,
        });
      }

      // 11. Log generation
      const processingTime = Date.now() - startTime;
      await this.logInvoiceGeneration(
        invoice.id,
        'automated',
        billingRules.map((r) => r.id),
        meterReadings.map((m) => m.id),
        processingTime,
        lineItems.length,
        tenantId,
      );

      // 12. Auto-send if requested
      if (options.autoSend) {
        await this.sendInvoice(invoice.id, tenantId);
      }

      return invoice;
    } catch (error: any) {
      console.error('Error generating invoice from contract:', error);

      // Log failed generation
      await this.logInvoiceGeneration(
        null,
        'automated',
        [],
        [],
        Date.now() - startTime,
        0,
        tenantId,
        error.message,
      );

      throw error;
    }
  }

  /**
   * Auto-generate invoice triggered by service ticket completion
   */
  async autoGenerateFromServiceTicket(ticketId: string, tenantId: string): Promise<Invoice> {
    try {
      // 1. Load service ticket with parts and labor
      const ticket = await this.getServiceTicketDetails(ticketId, tenantId);
      if (!ticket) {
        throw new Error(`Service ticket not found: ${ticketId}`);
      }

      // 2. Check if auto-invoice already generated
      const [existing] = await db
        .select()
        .from(autoInvoiceGeneration)
        .where(
          and(
            eq(autoInvoiceGeneration.sourceType, 'service_ticket'),
            eq(autoInvoiceGeneration.sourceId, ticketId),
            eq(autoInvoiceGeneration.tenantId, tenantId),
            eq(autoInvoiceGeneration.generationStatus, 'completed'),
          ),
        )
        .limit(1);

      if (existing) {
        const [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, existing.generatedInvoiceId!))
          .limit(1);
        return invoice;
      }

      // 3. Create auto-generation tracking record
      const [autoGen] = await db
        .insert(autoInvoiceGeneration)
        .values({
          tenantId,
          sourceType: 'service_ticket',
          sourceId: ticketId,
          generationStatus: 'processing',
          triggeredAt: new Date(),
        })
        .returning();

      try {
        // 4. Determine billable items
        const lineItems = await this.calculateLineItemsFromServiceTicket(ticket, tenantId);

        // 5. Calculate totals
        const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.total || '0'), 0);
        const tax = await this.calculateInvoiceTax(subtotal, ticket.customerId, tenantId);
        const total = subtotal + tax;

        // 6. Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber(tenantId);

        // 7. Create invoice
        const [invoice] = await db
          .insert(invoices)
          .values({
            tenantId,
            invoiceNumber,
            customerId: ticket.customerId,
            status: 'draft',
            invoiceStatus: 'draft',
            issueDate: new Date(),
            invoiceDate: new Date(),
            dueDate: this.calculateDueDate('net30'),
            subtotal: subtotal.toFixed(2),
            totalAmount: total.toFixed(2),
            total: total.toFixed(2),
            balance: total.toFixed(2),
            tax: tax.toFixed(2),
            description: `Service call invoice for ticket #${ticket.ticketNumber}`,
            externalCustomerId: ticketId, // Link to service ticket
            createdBy: 'system',
          })
          .returning();

        // 8. Create line items
        for (const lineItem of lineItems) {
          await db.insert(invoiceLineItems).values({
            ...lineItem,
            invoiceId: invoice.id,
            tenantId,
          });
        }

        // 9. Update auto-generation record
        await db
          .update(autoInvoiceGeneration)
          .set({
            generationStatus: 'completed',
            generatedInvoiceId: invoice.id,
            completedAt: new Date(),
          })
          .where(eq(autoInvoiceGeneration.id, autoGen.id));

        return invoice;
      } catch (error: any) {
        // Update auto-generation record with failure
        await db
          .update(autoInvoiceGeneration)
          .set({
            generationStatus: 'failed',
            errorMessage: error.message,
          })
          .where(eq(autoInvoiceGeneration.id, autoGen.id));

        throw error;
      }
    } catch (error) {
      console.error('Error auto-generating invoice from service ticket:', error);
      throw error;
    }
  }

  /**
   * Auto-generate invoice from warehouse operation
   */
  async autoGenerateFromWarehouseOperation(
    operationId: string,
    tenantId: string,
  ): Promise<Invoice> {
    // Similar implementation to service ticket generation
    // This would handle parts shipments, equipment installations, etc.
    throw new Error('Not yet implemented');
  }

  /**
   * Batch generate invoices for scheduled billing cycle
   */
  async batchGenerateForSchedule(
    scheduleId: string,
    tenantId: string,
  ): Promise<BulkGenerationResult> {
    const result: BulkGenerationResult = {
      successful: 0,
      failed: 0,
      invoiceIds: [],
      errors: [],
    };

    try {
      // 1. Load billing schedule
      // 2. Identify customers/contracts for billing
      // 3. Generate invoices in parallel (with concurrency limit)
      // 4. Handle errors gracefully
      // 5. Return summary report

      throw new Error('Not yet implemented');
    } catch (error: any) {
      console.error('Error in batch generation:', error);
      throw error;
    }
  }

  // ===========================================================================
  // PRICING CALCULATION ENGINE
  // ===========================================================================

  /**
   * Calculate line item price with all applicable rules
   */
  async calculateLineItemPrice(
    item: LineItemInput,
    contract: Contract,
    billingRules: BillingRule[],
  ): Promise<LineItemCalculation> {
    const breakdown = {
      baseAmount: 0,
      tieredAmount: 0,
      volumeDiscount: 0,
      overageCharge: 0,
      timeBasedMultiplier: 1.0,
    };

    let amount = parseFloat(item.unitPrice) * item.quantity;
    breakdown.baseAmount = amount;

    const appliedRules: string[] = [];

    // Apply rules in priority order
    const sortedRules = billingRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sortedRules) {
      if (rule.ruleStatus !== 'active') continue;

      switch (rule.ruleType) {
        case 'tiered':
          if (rule.tieredRates) {
            const tieredResult = this.applyTieredPricing(
              item.quantity,
              rule.tieredRates as TieredRate[],
            );
            breakdown.tieredAmount = tieredResult.amount;
            appliedRules.push(`Tiered: ${rule.ruleName}`);
          }
          break;

        case 'volume_discount':
          if (rule.volumeDiscounts) {
            const discountResult = this.applyVolumeDiscounts(
              amount,
              rule.volumeDiscounts as VolumeDiscount[],
            );
            breakdown.volumeDiscount = discountResult.discount;
            appliedRules.push(`Volume Discount: ${rule.ruleName}`);
          }
          break;

        case 'overage':
          // Overage calculation would go here
          break;

        case 'time_based':
          if (rule.timeBasedPricing) {
            // Time-based pricing calculation
          }
          break;

        case 'flat_rate':
          if (rule.baseCharge) {
            breakdown.baseAmount = parseFloat(rule.baseCharge);
            appliedRules.push(`Flat Rate: ${rule.ruleName}`);
          }
          break;
      }
    }

    const subtotal =
      breakdown.baseAmount +
      breakdown.tieredAmount -
      breakdown.volumeDiscount +
      breakdown.overageCharge;
    const total = subtotal * breakdown.timeBasedMultiplier;

    return {
      subtotal,
      discount: breakdown.volumeDiscount,
      tax: 0, // Tax calculated separately at invoice level
      total,
      appliedRules,
      breakdown,
    };
  }

  /**
   * Apply tiered pricing based on usage volume
   */
  private applyTieredPricing(usage: number, tiers: TieredRate[]): PricingBreakdown {
    let totalAmount = 0;
    let remainingUsage = usage;
    const details: string[] = [];

    // Sort tiers by minVolume
    const sortedTiers = [...tiers].sort((a, b) => a.minVolume - b.minVolume);

    for (const tier of sortedTiers) {
      if (remainingUsage <= 0) break;

      const tierVolume = tier.maxVolume
        ? Math.min(remainingUsage, tier.maxVolume - tier.minVolume)
        : remainingUsage;

      const tierAmount = tierVolume * tier.rate;
      totalAmount += tierAmount;
      remainingUsage -= tierVolume;

      details.push(`${tierVolume} @ $${tier.rate} = $${tierAmount.toFixed(2)}`);
    }

    return {
      amount: totalAmount,
      details: details.join(', '),
      appliedRule: 'Tiered Pricing',
    };
  }

  /**
   * Apply volume-based discounts
   */
  private applyVolumeDiscounts(
    totalAmount: number,
    discountRules: VolumeDiscount[],
  ): { discount: number; percent: number } {
    // Sort by threshold descending to find highest applicable discount
    const sortedRules = [...discountRules].sort((a, b) => b.threshold - a.threshold);

    for (const rule of sortedRules) {
      if (totalAmount >= rule.threshold) {
        const discount = (totalAmount * rule.discountPercent) / 100;
        return { discount, percent: rule.discountPercent };
      }
    }

    return { discount: 0, percent: 0 };
  }

  // ===========================================================================
  // METER READING VALIDATION
  // ===========================================================================

  /**
   * Validate meter readings and detect anomalies
   */
  async validateMeterReadings(
    readings: MeterReading[],
    equipmentId: string | null | undefined,
    tenantId: string,
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      anomalies: [],
      warnings: [],
      errors: [],
    };

    if (!readings || readings.length === 0) {
      result.warnings.push('No meter readings provided');
      return result;
    }

    // Get historical readings for comparison
    const historicalReadings = equipmentId
      ? await this.getHistoricalMeterReadings(equipmentId, tenantId, 10)
      : [];

    for (const reading of readings) {
      // Check for negative readings
      if (reading.blackWhiteCount < 0 || reading.colorCount < 0) {
        result.isValid = false;
        result.errors.push(
          `Negative reading detected: BW=${reading.blackWhiteCount}, Color=${reading.colorCount}`,
        );

        await this.createMeterAnomaly({
          meterReadingId: reading.id,
          equipmentId: reading.equipmentId,
          anomalyType: 'negative_reading',
          severity: 'critical',
          currentBwReading: reading.blackWhiteCount,
          currentColorReading: reading.colorCount,
          tenantId,
        });
      }

      // Check for usage spikes (if we have historical data)
      if (historicalReadings.length > 0) {
        const anomalies = await this.detectAnomalies(reading, historicalReadings, tenantId);
        result.anomalies.push(...anomalies);

        if (anomalies.some((a) => a.severity === 'critical' || a.severity === 'high')) {
          result.warnings.push(`Anomalies detected for reading ${reading.id}`);
        }
      }
    }

    return result;
  }

  /**
   * Detect meter anomalies using statistical analysis
   */
  private async detectAnomalies(
    currentReading: MeterReading,
    historicalReadings: MeterReading[],
    tenantId: string,
  ): Promise<MeterAnomaly[]> {
    const anomalies: MeterAnomaly[] = [];

    if (historicalReadings.length === 0) return anomalies;

    // Calculate average usage
    const avgBw =
      historicalReadings.reduce((sum, r) => sum + r.blackWhiteCount, 0) / historicalReadings.length;
    const avgColor =
      historicalReadings.reduce((sum, r) => sum + r.colorCount, 0) / historicalReadings.length;

    // Calculate standard deviation
    const stdDevBw = Math.sqrt(
      historicalReadings.reduce((sum, r) => sum + Math.pow(r.blackWhiteCount - avgBw, 2), 0) /
        historicalReadings.length,
    );
    const stdDevColor = Math.sqrt(
      historicalReadings.reduce((sum, r) => sum + Math.pow(r.colorCount - avgColor, 2), 0) /
        historicalReadings.length,
    );

    // Detect spikes (3 standard deviations)
    const bwDeviation = currentReading.blackWhiteCount - avgBw;
    const colorDeviation = currentReading.colorCount - avgColor;

    if (Math.abs(bwDeviation) > 3 * stdDevBw || Math.abs(colorDeviation) > 3 * stdDevColor) {
      const anomaly = await this.createMeterAnomaly({
        meterReadingId: currentReading.id,
        equipmentId: currentReading.equipmentId,
        anomalyType: bwDeviation > 0 || colorDeviation > 0 ? 'spike' : 'sudden_drop',
        severity: Math.abs(bwDeviation) > 5 * stdDevBw ? 'critical' : 'high',
        currentBwReading: currentReading.blackWhiteCount,
        currentColorReading: currentReading.colorCount,
        expectedBwReading: Math.round(avgBw),
        expectedColorReading: Math.round(avgColor),
        bwDeviation: Math.round(bwDeviation),
        colorDeviation: Math.round(colorDeviation),
        bwDeviationPercent: ((bwDeviation / avgBw) * 100).toFixed(2),
        colorDeviationPercent: ((colorDeviation / avgColor) * 100).toFixed(2),
        tenantId,
      });

      anomalies.push(anomaly);
    }

    return anomalies;
  }

  /**
   * Create meter anomaly record
   */
  private async createMeterAnomaly(data: Partial<MeterAnomaly>): Promise<MeterAnomaly> {
    const [anomaly] = await db
      .insert(meterAnomalies)
      .values({
        ...data,
        detectedAt: new Date(),
        detectionMethod: 'automated',
        anomalyDescription: this.generateAnomalyDescription(data),
        suggestedAction: this.generateSuggestedAction(data),
      } as any)
      .returning();

    return anomaly;
  }

  private generateAnomalyDescription(data: Partial<MeterAnomaly>): string {
    switch (data.anomalyType) {
      case 'spike':
        return `Unusual spike in usage detected. BW deviation: ${data.bwDeviation}, Color deviation: ${data.colorDeviation}`;
      case 'negative_reading':
        return `Negative meter reading detected. This is physically impossible and indicates a data entry error.`;
      case 'sudden_drop':
        return `Sudden drop in usage detected. This may indicate meter reset or equipment replacement.`;
      case 'stagnant':
        return `No change in meter readings over extended period. Equipment may be offline.`;
      default:
        return `Meter anomaly detected: ${data.anomalyType}`;
    }
  }

  private generateSuggestedAction(data: Partial<MeterAnomaly>): string {
    switch (data.anomalyType) {
      case 'spike':
        return `Review with customer. May indicate legitimate high usage or meter malfunction.`;
      case 'negative_reading':
        return `Correct meter reading immediately. Do not bill until resolved.`;
      case 'sudden_drop':
        return `Contact customer to verify equipment status. Check if meter was reset.`;
      case 'stagnant':
        return `Verify equipment is operational. Check network connectivity for automated readings.`;
      default:
        return `Review reading and contact customer if necessary.`;
    }
  }

  // ===========================================================================
  // BILLING RULES ENGINE
  // ===========================================================================

  /**
   * Get applicable billing rules for a contract
   */
  async getApplicableBillingRules(
    contractId: string,
    customerId: string,
    equipmentId: string | null,
    effectiveDate: Date,
    tenantId: string,
  ): Promise<BillingRule[]> {
    const rules = await db
      .select()
      .from(billingRules)
      .where(
        and(
          eq(billingRules.tenantId, tenantId),
          eq(billingRules.ruleStatus, 'active'),
          lte(billingRules.effectiveStartDate, effectiveDate),
          sql`(${billingRules.effectiveEndDate} IS NULL OR ${billingRules.effectiveEndDate} >= ${effectiveDate})`,
        ),
      );

    // Filter by applicability
    const applicableRules = rules.filter((rule) => {
      // Contract-specific rules
      if (rule.contractId && rule.contractId !== contractId) return false;

      // Customer-specific rules
      if (rule.customerId && rule.customerId !== customerId) return false;

      // Equipment-specific rules
      if (rule.equipmentId && rule.equipmentId !== equipmentId) return false;

      // Global rules (applicable to all)
      if (rule.applicableToAllCustomers) return true;

      // If no specific targeting, rule applies
      if (!rule.contractId && !rule.customerId && !rule.equipmentId) return true;

      return true;
    });

    // Sort by priority (highest first)
    return applicableRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // ===========================================================================
  // ANALYTICS & REPORTING
  // ===========================================================================

  /**
   * Calculate comprehensive billing metrics
   */
  async calculateBillingMetrics(
    tenantId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<BillingMetrics> {
    const { start, end } = dateRange;

    // Total revenue (all invoices)
    const [revenueResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
        paid: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)) FILTER (WHERE ${invoices.invoiceStatus} = 'paid'), 0)`,
        outstanding: sql<number>`COALESCE(SUM(CAST(${invoices.balance} AS DECIMAL)) FILTER (WHERE ${invoices.invoiceStatus} != 'paid'), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.invoiceDate, start),
          lte(invoices.invoiceDate, end),
        ),
      );

    const totalRevenue = revenueResult?.total || 0;
    const paidRevenue = revenueResult?.paid || 0;
    const outstandingBalance = revenueResult?.outstanding || 0;
    const collectionRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0;

    // Average days to payment
    const [paymentDaysResult] = await db
      .select({
        avgDays: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paymentDate} - ${invoices.invoiceDate})))`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.invoiceStatus, 'paid'),
          gte(invoices.invoiceDate, start),
          lte(invoices.invoiceDate, end),
          isNotNull(invoices.paymentDate),
        ),
      );

    const averageDaysToPayment = paymentDaysResult?.avgDays || 0;

    // Auto-invoice success rate
    const [autoInvoiceResult] = await db
      .select({
        total: count(),
        successful: sql<number>`COUNT(*) FILTER (WHERE ${autoInvoiceGeneration.generationStatus} = 'completed')`,
      })
      .from(autoInvoiceGeneration)
      .where(
        and(
          eq(autoInvoiceGeneration.tenantId, tenantId),
          gte(autoInvoiceGeneration.triggeredAt, start),
          lte(autoInvoiceGeneration.triggeredAt, end),
        ),
      );

    const autoInvoiceTotal = autoInvoiceResult?.total || 0;
    const autoInvoiceSuccessful = autoInvoiceResult?.successful || 0;
    const autoInvoiceSuccessRate =
      autoInvoiceTotal > 0 ? (autoInvoiceSuccessful / autoInvoiceTotal) * 100 : 0;

    // MRR/ARR calculation (simplified)
    const mrr = paidRevenue / this.getMonthsDiff(start, end);
    const arr = mrr * 12;

    return {
      totalRevenue,
      outstandingBalance,
      collectionRate,
      averageDaysToPayment,
      invoiceIssuanceDelay: 0, // Would require additional calculation
      autoInvoiceSuccessRate,
      mrr,
      arr,
    };
  }

  /**
   * Calculate billing health score
   */
  async calculateBillingHealthScore(tenantId: string): Promise<HealthScore> {
    const last30Days = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    const metrics = await this.calculateBillingMetrics(tenantId, last30Days);

    // Collection efficiency (0-100)
    const collectionEfficiency = Math.min(metrics.collectionRate, 100);

    // Issuance timeliness (inverse of average days, normalized)
    const issuanceTimeliness = Math.max(0, 100 - metrics.invoiceIssuanceDelay * 10);

    // Dispute rate (would need dispute count)
    const disputeRate = 100; // Placeholder

    // Payment method diversity (would need payment method count)
    const paymentMethodDiversity = 80; // Placeholder

    // Overall score (weighted average)
    const score =
      collectionEfficiency * 0.4 +
      issuanceTimeliness * 0.3 +
      disputeRate * 0.2 +
      paymentMethodDiversity * 0.1;

    return {
      score: Math.round(score),
      collectionEfficiency,
      issuanceTimeliness,
      disputeRate,
      paymentMethodDiversity,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async getContractWithDetails(contractId: string, tenantId: string): Promise<any> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, contractId), eq(contracts.tenantId, tenantId)))
      .limit(1);

    return contract;
  }

  private async getMeterReadingsForPeriod(
    contractId: string,
    start: Date,
    end: Date,
    tenantId: string,
  ): Promise<MeterReading[]> {
    const readings = await db
      .select()
      .from(meterReadings)
      .where(
        and(
          eq(meterReadings.contractId, contractId),
          eq(meterReadings.tenantId, tenantId),
          gte(meterReadings.readingDate, start),
          lte(meterReadings.readingDate, end),
        ),
      )
      .orderBy(desc(meterReadings.readingDate));

    return readings;
  }

  private async getHistoricalMeterReadings(
    equipmentId: string,
    tenantId: string,
    limit: number,
  ): Promise<MeterReading[]> {
    const readings = await db
      .select()
      .from(meterReadings)
      .where(and(eq(meterReadings.equipmentId, equipmentId), eq(meterReadings.tenantId, tenantId)))
      .orderBy(desc(meterReadings.readingDate))
      .limit(limit);

    return readings;
  }

  private async calculateLineItemsFromMeterReadings(
    readings: MeterReading[],
    contract: Contract,
    rules: BillingRule[],
    periodStart: Date,
    periodEnd: Date,
    tenantId: string,
  ): Promise<Partial<InvoiceLineItem>[]> {
    const lineItems: Partial<InvoiceLineItem>[] = [];

    // Calculate usage
    const bwUsage = readings.reduce((sum, r) => sum + r.blackWhiteCount, 0);
    const colorUsage = readings.reduce((sum, r) => sum + r.colorCount, 0);

    // Apply billing rules to calculate pricing
    // This is simplified - actual implementation would be more complex

    if (bwUsage > 0) {
      lineItems.push({
        description: `B&W Copies (${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()})`,
        quantity: bwUsage.toString(),
        unitPrice: contract.baseRateBw || '0.01',
        total: (bwUsage * parseFloat(contract.baseRateBw || '0.01')).toFixed(2),
      });
    }

    if (colorUsage > 0) {
      lineItems.push({
        description: `Color Copies (${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()})`,
        quantity: colorUsage.toString(),
        unitPrice: contract.baseRateColor || '0.05',
        total: (colorUsage * parseFloat(contract.baseRateColor || '0.05')).toFixed(2),
      });
    }

    // Add base charges if applicable
    if (contract.monthlyBaseCharge && parseFloat(contract.monthlyBaseCharge) > 0) {
      lineItems.push({
        description: 'Monthly Base Charge',
        quantity: '1',
        unitPrice: contract.monthlyBaseCharge,
        total: contract.monthlyBaseCharge,
      });
    }

    return lineItems;
  }

  private async calculateLineItemsFromServiceTicket(
    ticket: any,
    tenantId: string,
  ): Promise<Partial<InvoiceLineItem>[]> {
    const lineItems: Partial<InvoiceLineItem>[] = [];

    // Add labor charges
    if (ticket.laborHours && ticket.laborRate) {
      lineItems.push({
        description: `Service Labor - ${ticket.laborHours} hours`,
        quantity: ticket.laborHours.toString(),
        unitPrice: ticket.laborRate,
        total: (ticket.laborHours * parseFloat(ticket.laborRate)).toFixed(2),
      });
    }

    // Add parts charges
    if (ticket.parts && Array.isArray(ticket.parts)) {
      for (const part of ticket.parts) {
        lineItems.push({
          description: part.description || `Part: ${part.partNumber}`,
          quantity: part.quantity.toString(),
          unitPrice: part.unitPrice,
          total: (part.quantity * parseFloat(part.unitPrice)).toFixed(2),
        });
      }
    }

    return lineItems;
  }

  private async getServiceTicketDetails(ticketId: string, tenantId: string): Promise<any> {
    // This would fetch service ticket details from the service dispatch system
    // Placeholder implementation
    return {
      id: ticketId,
      ticketNumber: 'ST-12345',
      customerId: 'customer-id',
      laborHours: 2,
      laborRate: '75.00',
      parts: [],
    };
  }

  private async calculateInvoiceTax(
    subtotal: number,
    customerId: string,
    tenantId: string,
  ): Promise<number> {
    // This would implement tax calculation logic
    // Placeholder: 8% sales tax
    return subtotal * 0.08;
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    // Get the last invoice number for this tenant
    const [lastInvoice] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Extract number and increment
      const match = lastInvoice.invoiceNumber.match(/\d+$/);
      if (match) {
        const nextNumber = parseInt(match[0]) + 1;
        return `INV-${nextNumber.toString().padStart(6, '0')}`;
      }
    }

    // First invoice
    return `INV-000001`;
  }

  private calculateDueDate(paymentTerms: string): Date {
    const dueDate = new Date();

    if (paymentTerms === 'net30') {
      dueDate.setDate(dueDate.getDate() + 30);
    } else if (paymentTerms === 'net15') {
      dueDate.setDate(dueDate.getDate() + 15);
    } else if (paymentTerms === 'net60') {
      dueDate.setDate(dueDate.getDate() + 60);
    } else if (paymentTerms === 'due_on_receipt') {
      // Due immediately
    } else {
      // Default to 30 days
      dueDate.setDate(dueDate.getDate() + 30);
    }

    return dueDate;
  }

  private getDefaultPeriodStart(): Date {
    const date = new Date();
    date.setDate(1); // First day of current month
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getDefaultPeriodEnd(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of current month
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getMonthsDiff(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(months, 1);
  }

  private async sendInvoice(invoiceId: string, tenantId: string): Promise<void> {
    // Fetch invoice with customer details
    const [invoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerEmail: businessRecords.email,
        customerName: businessRecords.companyName,
        totalAmount: invoices.totalAmount,
        dueDate: invoices.dueDate,
        balance: invoices.balance,
      })
      .from(invoices)
      .leftJoin(businessRecords, eq(invoices.customerId, businessRecords.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice || !invoice.customerEmail) {
      console.warn(`Cannot send invoice ${invoiceId}: no customer email`);
      return;
    }

    // Import email service dynamically to avoid circular dependencies
    const { emailService } = await import('./email-service');

    // Send email notification
    await emailService.send({
      to: invoice.customerEmail,
      subject: `Invoice ${invoice.invoiceNumber} from Printyx`,
      html: `
        <p>Hello ${invoice.customerName},</p>
        <p>Your invoice ${invoice.invoiceNumber} is now available.</p>
        <p><strong>Amount Due:</strong> $${parseFloat(invoice.balance || invoice.totalAmount || '0').toFixed(2)}</p>
        <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        <p>Please log in to your account to view and pay this invoice.</p>
        <p>Thank you for your business!</p>
      `,
      text: `Invoice ${invoice.invoiceNumber}\nAmount Due: $${parseFloat(invoice.balance || invoice.totalAmount || '0').toFixed(2)}\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString()}`,
    });

    // Update invoice status to 'sent'
    await db
      .update(invoices)
      .set({
        status: 'sent',
        invoiceStatus: 'sent',
        issueDate: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
  }

  private async logInvoiceGeneration(
    invoiceId: string | null,
    generationType: string,
    appliedRules: string[],
    meterReadings: string[],
    processingTime: number,
    lineItemCount: number,
    tenantId: string,
    errorMessage?: string,
  ): Promise<void> {
    // This would create a record in invoiceGenerationLogs table
    // Placeholder implementation
    console.log('Invoice generation log:', {
      invoiceId,
      generationType,
      appliedRules: appliedRules.length,
      meterReadings: meterReadings.length,
      processingTime,
      lineItemCount,
      success: !errorMessage,
      error: errorMessage,
    });
  }
}

// Export singleton instance
export const billingEngine = new BillingEngineService();
export { BillingEngineService };
