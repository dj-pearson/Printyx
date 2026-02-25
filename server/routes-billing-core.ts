/**
 * Billing Core Routes
 *
 * Consolidated billing routes extracted from routes.ts monolith.
 *
 * Covers:
 * - POST /api/billing/generate-invoices
 * - GET  /api/billing/contract-profitability
 * - GET  /api/billing/analytics
 * - GET  /api/billing/invoices
 * - GET  /api/billing/configurations
 * - POST /api/billing/configurations
 * - GET  /api/billing/cycles
 * - POST /api/billing/cycles/run
 * - GET  /api/billing/adjustments
 * - POST /api/billing/adjustments
 */

import type { Express } from 'express';
import { format } from 'date-fns';
import { db } from './db';
import { and, eq, sql, desc, inArray } from 'drizzle-orm';
import { contracts, invoices, contractTieredRates } from '@shared/schema';
import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
import { getUserId, getTenantId } from './utils/auth-helpers';
const log = createModuleLogger('routes-billing-core');

// Helper function to calculate tiered billing amounts
function calculateTieredAmount(totalCopies: number, tieredRates: any[], baseRate: number): number {
  if (!tieredRates || tieredRates.length === 0) {
    return totalCopies * baseRate;
  }

  let remainingCopies = totalCopies;
  let totalAmount = 0;

  for (let i = 0; i < tieredRates.length; i++) {
    const currentTier = tieredRates[i];
    const nextTier = tieredRates[i + 1];

    const tierMin = currentTier.minimumVolume;
    const tierMax = nextTier ? nextTier.minimumVolume : Infinity;
    const tierRate = parseFloat(currentTier.rate.toString());

    if (totalCopies > tierMin) {
      const copiesInTier = Math.min(remainingCopies, tierMax - tierMin);
      totalAmount += copiesInTier * tierRate;
      remainingCopies -= copiesInTier;

      if (remainingCopies <= 0) break;
    }
  }

  // If there are remaining copies not covered by tiers, use base rate
  if (remainingCopies > 0) {
    totalAmount += remainingCopies * baseRate;
  }

  return totalAmount;
}

export function registerBillingCoreRoutes(app: Express) {
  // ─── Generate Invoices ─────────────────────────────────────────────
  // PERFORMANCE OPTIMIZED: Batch fetches contracts and tiered rates instead of N+1 queries

  app.post('/api/billing/generate-invoices', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get all pending meter readings
      const pendingReadings = await storage.getMeterReadingsByStatus(tenantId, 'pending');

      if (pendingReadings.length === 0) {
        return res.json({
          message: 'No pending meter readings to process',
          invoices: [],
        });
      }

      // Extract unique contract IDs from pending readings
      const contractIds = [
        ...new Set(pendingReadings.filter((r) => r.contractId).map((r) => String(r.contractId))),
      ];

      if (contractIds.length === 0) {
        return res.json({
          message: 'No meter readings with valid contracts',
          invoices: [],
        });
      }

      // PERFORMANCE FIX: Batch fetch all contracts in one query instead of N queries
      const allContracts = await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.tenantId, tenantId), inArray(contracts.id, contractIds)));

      // PERFORMANCE FIX: Batch fetch all tiered rates for these contracts in one query
      const allTieredRates = await db
        .select()
        .from(contractTieredRates)
        .where(inArray(contractTieredRates.contractId, contractIds))
        .orderBy(contractTieredRates.sortOrder);

      // Create lookup maps for O(1) access
      const contractMap = new Map(allContracts.map((c) => [c.id, c]));
      const tieredRatesMap = new Map<string, typeof allTieredRates>();
      for (const rate of allTieredRates) {
        const rates = tieredRatesMap.get(rate.contractId) || [];
        rates.push(rate);
        tieredRatesMap.set(rate.contractId, rates);
      }

      const generatedInvoices = [];
      const failedReadings = [];

      // Process each reading using the pre-fetched data
      for (const reading of pendingReadings) {
        try {
          if (!reading.contractId) continue;

          const contract = contractMap.get(String(reading.contractId));
          if (!contract) continue;

          // Get tiered rates from map (O(1) lookup)
          const tieredRates = tieredRatesMap.get(String(reading.contractId)) || [];

          let blackAmount = 0;
          let colorAmount = 0;

          // Calculate tiered billing for black & white copies
          if (reading.blackCopies && reading.blackCopies > 0) {
            const blackRates = tieredRates
              .filter((rate) => rate.colorType === 'black')
              .sort((a, b) => a.minimumVolume - b.minimumVolume);
            const blackCopiesNum = Number(reading.blackCopies || 0);
            blackAmount = calculateTieredAmount(
              blackCopiesNum,
              blackRates,
              parseFloat(contract.blackRate?.toString() || '0'),
            );
          }

          // Calculate tiered billing for color copies
          if (reading.colorCopies && reading.colorCopies > 0) {
            const colorRates = tieredRates
              .filter((rate) => rate.colorType === 'color')
              .sort((a, b) => a.minimumVolume - b.minimumVolume);
            const colorCopiesNum = Number(reading.colorCopies || 0);
            colorAmount = calculateTieredAmount(
              colorCopiesNum,
              colorRates,
              parseFloat(contract.colorRate?.toString() || '0'),
            );
          }

          const totalAmount =
            blackAmount + colorAmount + parseFloat(contract.monthlyBase?.toString() || '0');

          // Create invoice
          const invoice = await storage.createInvoice({
            tenantId: String(tenantId),
            customerId: String(contract.customerId),
            contractId: contract?.id ? String(contract.id) : null,
            invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            totalAmount: String(totalAmount),
            amountPaid: '0',
            balanceDue: String(totalAmount),
            invoiceStatus: 'open',
            paymentTerms: 'Net 30',
            invoiceNotes: `Meter billing for ${format(new Date(reading.readingDate), 'MMMM yyyy')}`,
            createdBy: String((req as any).user?.id || 'system'),
          } as any);

          // Update meter reading billing status
          await storage.updateMeterReading(
            reading.id,
            {
              billingStatus: 'processed',
              billingAmount: totalAmount.toString(),
              invoiceId: invoice.id,
            },
            tenantId,
          );

          generatedInvoices.push(invoice);
        } catch (readingError) {
          log.error(`Error processing reading ${reading.id}:`, readingError);
          failedReadings.push(reading.id);
        }
      }

      res.json({
        message: `Generated ${generatedInvoices.length} invoices`,
        invoices: generatedInvoices,
        ...(failedReadings.length > 0 && { failedReadingIds: failedReadings }),
      });
    } catch (error) {
      log.error('Error generating invoices:', error);
      res.status(500).json({ message: 'Failed to generate invoices' });
    }
  });

  // ─── Contract Profitability Analysis ───────────────────────────────
  // PERFORMANCE OPTIMIZED: Uses SQL JOIN and GROUP BY instead of O(n*m) in-memory filtering

  app.get(
    '/api/billing/contract-profitability',

    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        // Parse pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
        const offset = (page - 1) * pageSize;

        // PERFORMANCE FIX: Use SQL JOIN and GROUP BY for aggregation instead of loading all data
        const aggregatedData = await db
          .select({
            contractId: contracts.id,
            contractNumber: contracts.contractNumber,
            monthlyBase: contracts.monthlyBase,
            totalRevenue: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)`,
            totalPaid: sql<string>`COALESCE(SUM(${invoices.amountPaid}::numeric), 0)`,
            invoiceCount: sql<number>`COUNT(${invoices.id})::int`,
          })
          .from(contracts)
          .leftJoin(invoices, eq(contracts.id, invoices.contractId))
          .where(eq(contracts.tenantId, tenantId))
          .groupBy(contracts.id, contracts.contractNumber, contracts.monthlyBase)
          .orderBy(desc(sql`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)`))
          .limit(pageSize)
          .offset(offset);

        // Get total count for pagination
        const countResult = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${contracts.id})::int` })
          .from(contracts)
          .where(eq(contracts.tenantId, tenantId));
        const totalCount = countResult[0]?.count || 0;

        // Calculate profitability metrics for only the returned rows
        const profitabilityData = aggregatedData.map((row) => {
          const totalRevenue = parseFloat(String(row.totalRevenue || '0'));
          const totalPaid = parseFloat(String(row.totalPaid || '0'));
          const monthlyCosts = parseFloat(row.monthlyBase?.toString() || '0') * 12;
          const totalCosts = monthlyCosts;
          const grossProfit = totalRevenue - totalCosts;
          const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
          const invoiceCount = row.invoiceCount || 0;

          return {
            contractId: row.contractId,
            contractNumber: row.contractNumber,
            totalRevenue,
            totalPaid,
            totalCosts,
            grossProfit,
            marginPercent,
            invoiceCount,
            averageInvoiceAmount: invoiceCount > 0 ? totalRevenue / invoiceCount : 0,
          };
        });

        res.json({
          data: profitabilityData,
          pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
          },
        });
      } catch (error) {
        log.error('Error calculating contract profitability:', error);
        res.status(500).json({ message: 'Failed to calculate contract profitability' });
      }
    },
  );

  // ─── Billing Analytics ─────────────────────────────────────────────

  app.get(
    '/api/billing/analytics',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as total_invoices FROM billing_invoices WHERE tenant_id = $1`,
          `SELECT COALESCE(SUM(total_amount), 0) as total_revenue FROM billing_invoices WHERE tenant_id = $1 AND status = 'paid'`,
          `SELECT COALESCE(SUM(balance_due), 0) as outstanding_amount FROM billing_invoices WHERE tenant_id = $1 AND status != 'paid'`,
          `SELECT COUNT(*) as overdue_invoices FROM billing_invoices WHERE tenant_id = $1 AND status = 'overdue'`,
          `SELECT COALESCE(AVG(total_amount), 0) as average_invoice_amount FROM billing_invoices WHERE tenant_id = $1`,
          `SELECT COALESCE(SUM(total_amount), 0) as monthly_recurring FROM billing_invoices WHERE tenant_id = $1 AND billing_period_start >= date_trunc('month', CURRENT_DATE)`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId])),
        );

        const totalRevenue = parseFloat(results[1].rows[0].total_revenue);
        const outstandingAmount = parseFloat(results[2].rows[0].outstanding_amount);
        const monthlyRecurring = parseFloat(results[5].rows[0].monthly_recurring);

        res.json({
          totalInvoices: parseInt(results[0].rows[0].total_invoices),
          totalRevenue,
          outstandingAmount,
          overdueInvoices: parseInt(results[3].rows[0].overdue_invoices),
          averageInvoiceAmount: parseFloat(results[4].rows[0].average_invoice_amount),
          collectionRate: totalRevenue > 0 ? totalRevenue / (totalRevenue + outstandingAmount) : 0,
          monthlyRecurringRevenue: monthlyRecurring,
          annualRecurringRevenue: monthlyRecurring * 12,
        });
      } catch (error) {
        log.error('Error fetching billing analytics:', error);
        res.status(500).json({ error: 'Failed to fetch billing analytics' });
      }
    },
  );

  // ─── Billing Invoices ──────────────────────────────────────────────

  app.get('/api/billing/invoices', async (req: any, res) => {
    try {
      const status = String((req.query as any)?.status || '');
      const ticketId = String((req.query as any)?.ticketId || '');
      const contractId = String((req.query as any)?.contractId || '');
      const filter = String((req.query as any)?.filter || '');
      const tenantId = req.user.tenantId;

      let whereConditions = ['bi.tenantId = $1'];
      const queryParams: any[] = [tenantId];

      if (status && status !== 'all') {
        whereConditions.push(`bi.status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }

      if (ticketId) {
        whereConditions.push(`bi.ticketId = $${queryParams.length + 1}`);
        queryParams.push(ticketId);
      }

      if (contractId) {
        whereConditions.push(`bi.contractId = $${queryParams.length + 1}`);
        queryParams.push(contractId);
      }

      if (filter === 'issuance_delay_gt_24h') {
        whereConditions.push(`bi.createdAt > NOW() - INTERVAL '30 days'`);
        whereConditions.push(
          `(bi.issuance_delay_hours IS NOT NULL AND bi.issuance_delay_hours > 24)`,
        );
      }

      const query = `
        SELECT
          bi.*,
          br.companyName as business_record_name
        FROM billing_invoices bi
        LEFT JOIN business_records br ON bi.business_record_id = br.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY bi.createdAt DESC
        LIMIT 100
      `;

      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      log.error('Error fetching billing invoices:', error);
      res.status(500).json({ error: 'Failed to fetch billing invoices' });
    }
  });

  // ─── Billing Configurations ────────────────────────────────────────

  app.get(
    '/api/billing/configurations',

    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || '');
        const tenantId = req.user.tenantId;

        let whereConditions = ['tenant_id = $1'];
        const queryParams = [tenantId];

        if (type && type !== 'all') {
          whereConditions.push(`billing_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        const query = `
        SELECT *
        FROM billing_configurations
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_default DESC, configuration_name
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching billing configurations:', error);
        res.status(500).json({ error: 'Failed to fetch billing configurations' });
      }
    },
  );

  app.post(
    '/api/billing/configurations',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          configuration_name,
          billing_type,
          billing_frequency,
          billing_day,
          base_rate,
          minimum_charge,
          maximum_charge,
          overage_rate,
          setup_fee,
          maintenance_fee,
          tax_rate,
          tax_inclusive,
          contract_length_months,
          early_termination_fee,
          is_default,
        } = req.body;

        // If setting as default, unset other defaults first
        if (is_default) {
          await db.$client.query(
            'UPDATE billing_configurations SET is_default = false WHERE tenant_id = $1',
            [tenantId],
          );
        }

        const query = `
        INSERT INTO billing_configurations (
          tenant_id, configuration_name, billing_type, billing_frequency, billing_day,
          base_rate, minimum_charge, maximum_charge, overage_rate, setup_fee,
          maintenance_fee, tax_rate, tax_inclusive, contract_length_months,
          early_termination_fee, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          configuration_name,
          billing_type,
          billing_frequency,
          billing_day,
          base_rate,
          minimum_charge,
          maximum_charge,
          overage_rate,
          setup_fee,
          maintenance_fee,
          tax_rate,
          tax_inclusive,
          contract_length_months,
          early_termination_fee,
          is_default,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating billing configuration:', error);
        res.status(500).json({ error: 'Failed to create billing configuration' });
      }
    },
  );

  // ─── Billing Cycles ────────────────────────────────────────────────

  app.get('/api/billing/cycles', async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const query = `
        SELECT *
        FROM billing_cycles
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      log.error('Error fetching billing cycles:', error);
      res.status(500).json({ error: 'Failed to fetch billing cycles' });
    }
  });

  app.post(
    '/api/billing/cycles/run',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Create a new billing cycle
        const cycleDate = new Date().toISOString().split('T')[0];
        const cycleName = `Billing Cycle ${format(new Date(), 'MMM yyyy')}`;

        const cycleQuery = `
        INSERT INTO billing_cycles (
          tenant_id, cycle_name, cycle_date, status, started_at
        ) VALUES ($1, $2, $3, 'processing', NOW())
        RETURNING *
      `;

        const cycleResult = await db.$client.query(cycleQuery, [tenantId, cycleName, cycleDate]);

        const cycle = cycleResult.rows[0];

        // For demo purposes, create a few sample invoices
        const sampleInvoices = [
          {
            invoice_number: `INV-${Date.now()}-001`,
            business_record_id: 'adc117e7-611d-426a-b569-6c6c0b32e234',
            amount: 299.99,
          },
          {
            invoice_number: `INV-${Date.now()}-002`,
            business_record_id: 'adc117e7-611d-426a-b569-6c6c0b32e234',
            amount: 459.99,
          },
        ];

        let totalAmount = 0;
        let invoicesGenerated = 0;

        for (const invoice of sampleInvoices) {
          const invoiceQuery = `
          INSERT INTO billing_invoices (
            tenant_id, customer_id, invoice_number, created_at, due_date,
            billing_period_start, billing_period_end, subtotal, total_amount,
            balance_due, billing_cycle_id, auto_generated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        `;

          const invoiceDate = new Date();
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);

          const periodStart = new Date();
          periodStart.setMonth(periodStart.getMonth() - 1);
          const periodEnd = new Date();

          await db.$client.query(invoiceQuery, [
            tenantId,
            invoice.business_record_id,
            invoice.invoice_number,
            invoiceDate,
            dueDate,
            periodStart,
            periodEnd,
            invoice.amount,
            invoice.amount,
            invoice.amount,
            cycle.id,
          ]);

          totalAmount += invoice.amount;
          invoicesGenerated++;
        }

        // Update billing cycle with results
        await db.$client.query(
          `
        UPDATE billing_cycles
        SET status = 'completed',
            completed_at = NOW(),
            total_customers = $1,
            processed_customers = $2,
            total_invoices_generated = $3,
            total_amount = $4
        WHERE id = $5
      `,
          [sampleInvoices.length, sampleInvoices.length, invoicesGenerated, totalAmount, cycle.id],
        );

        res.status(201).json({
          message: 'Billing cycle completed successfully',
          cycle_id: cycle.id,
          invoices_generated: invoicesGenerated,
          total_amount: totalAmount,
        });
      } catch (error) {
        log.error('Error running billing cycle:', error);
        res.status(500).json({ error: 'Failed to run billing cycle' });
      }
    },
  );

  // ─── Billing Adjustments ───────────────────────────────────────────

  app.get(
    '/api/billing/adjustments',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const query = `
        SELECT
          ba.*,
          u1.name as requested_by_name,
          u2.name as approved_by_name
        FROM billing_adjustments ba
        LEFT JOIN users u1 ON ba.requestedBy = u1.id
        LEFT JOIN users u2 ON ba.approved_by = u2.id
        WHERE ba.tenantId = $1
        ORDER BY ba.createdAt DESC
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        log.error('Error fetching billing adjustments:', error);
        res.status(500).json({ error: 'Failed to fetch billing adjustments' });
      }
    },
  );

  app.post(
    '/api/billing/adjustments',

    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          adjustment_type,
          adjustment_reason,
          amount,
          description,
          invoice_id,
          business_record_id,
        } = req.body;

        const query = `
        INSERT INTO billing_adjustments (
          tenant_id, adjustment_type, adjustment_reason, amount, description,
          invoice_id, business_record_id, requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          adjustment_type,
          adjustment_reason,
          amount,
          description,
          invoice_id,
          business_record_id,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        log.error('Error creating billing adjustment:', error);
        res.status(500).json({ error: 'Failed to create billing adjustment' });
      }
    },
  );
}
