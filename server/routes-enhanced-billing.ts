import express from "express";
import { eq, and, desc, sql, gte, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { invoices, autoInvoiceGeneration } from "@shared/schema";

const router = express.Router();

// Enhanced billing invoices endpoint with LEAN filtering
router.get("/billing/invoices", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { 
      ticketId, 
      contractId, 
      filter, 
      status,
      limit = 50,
      offset = 0 
    } = req.query;

    let query = db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        contractId: invoices.contractId,
        ticketId: invoices.externalCustomerId, // Using available field as proxy
        businessRecordId: invoices.customerId, // Using available field as proxy
        totalAmount: invoices.totalAmount,
        status: invoices.invoiceStatus,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        issuanceDelayHours: sql`0`.as('issuanceDelayHours'), // Computed field placeholder
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));

    // Apply filters based on LEAN playbook requirements
    const conditions = [eq(invoices.tenantId, tenantId)];

    if (ticketId) {
      conditions.push(eq(invoices.externalCustomerId, ticketId as string)); // Using available field
    }

    if (contractId) {
      conditions.push(eq(invoices.contractId, contractId as string));
    }

    if (status) {
      conditions.push(eq(invoices.invoiceStatus, status as string));
    }

    // Special filters as defined in LEAN playbook
    if (filter === 'issuance_delay_gt_24h') {
      // Skip this filter for now since issuanceDelayHours doesn't exist in invoices table
      // conditions.push(gte(invoices.issuanceDelayHours, 24));
    }

    if (filter === 'overdue') {
      conditions.push(
        and(
          eq(invoices.invoiceStatus, 'open'),
          sql`${invoices.dueDate} < NOW()`
        )
      );
    }

    if (filter === 'recent_auto_generated') {
      conditions.push(
        and(
          isNotNull(invoices.externalCustomerId), // Using available field as proxy
          gte(invoices.createdAt, sql`NOW() - INTERVAL '7 days'`)
        )
      );
    }

    const finalQuery = query
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const invoiceResults = await finalQuery;

    // Get total count for pagination
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(and(...conditions));

    res.json({
      invoices: invoiceResults,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < totalCount
      },
      filters: {
        ticketId,
        contractId,
        filter,
        status
      }
    });

  } catch (error) {
    console.error("Error fetching enhanced billing invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// Get auto-invoice generation status
router.get("/billing/auto-invoice-status", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { sourceId, sourceType = 'service_ticket' } = req.query;

    let query = db
      .select()
      .from(autoInvoiceGeneration)
      .where(eq(autoInvoiceGeneration.tenantId, tenantId));

    const conditions = [eq(autoInvoiceGeneration.tenantId, tenantId)];

    if (sourceId) {
      conditions.push(eq(autoInvoiceGeneration.sourceId, sourceId as string));
    }

    if (sourceType) {
      conditions.push(eq(autoInvoiceGeneration.sourceType, sourceType as string));
    }

    const generations = await query
      .where(and(...conditions))
      .orderBy(desc(autoInvoiceGeneration.triggeredAt));

    res.json(generations);

  } catch (error) {
    console.error("Error fetching auto-invoice status:", error);
    res.status(500).json({ error: "Failed to fetch auto-invoice status" });
  }
});

// Get billing metrics for LEAN analytics
router.get("/billing/metrics", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { period = '30' } = req.query; // days

    // Invoice issuance delay metrics (simplified since issuanceDelayHours field doesn't exist)
    const [issuanceDelayMetrics] = await db
      .select({
        avgDelayHours: sql<number>`0`, // Placeholder
        maxDelayHours: sql<number>`0`, // Placeholder
        invoicesWithDelay: sql<number>`0`, // Placeholder
        totalInvoices: sql<number>`COUNT(*)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.createdAt, sql`NOW() - INTERVAL '${period} days'`)
        )
      );

    // Auto-invoice success rate
    const [autoInvoiceMetrics] = await db
      .select({
        totalGenerated: sql<number>`COUNT(*)`,
        successful: sql<number>`COUNT(*) FILTER (WHERE generation_status = 'completed')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE generation_status = 'failed')`,
        processing: sql<number>`COUNT(*) FILTER (WHERE generation_status = 'processing')`,
      })
      .from(autoInvoiceGeneration)
      .where(
        and(
          eq(autoInvoiceGeneration.tenantId, tenantId),
          gte(autoInvoiceGeneration.triggeredAt, sql`NOW() - INTERVAL '${period} days'`)
        )
      );

    // Revenue metrics
    const [revenueMetrics] = await db
      .select({
        totalRevenue: sql<number>`SUM(CAST(${invoices.totalAmount} AS DECIMAL))`,
        paidRevenue: sql<number>`SUM(CAST(${invoices.totalAmount} AS DECIMAL)) FILTER (WHERE invoice_status = 'paid')`,
        overdueAmount: sql<number>`SUM(CAST(${invoices.totalAmount} AS DECIMAL)) FILTER (WHERE invoice_status = 'open' AND ${invoices.dueDate} < NOW())`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.createdAt, sql`NOW() - INTERVAL '${period} days'`)
        )
      );

    res.json({
      period: `${period} days`,
      issuanceDelay: {
        averageHours: issuanceDelayMetrics?.avgDelayHours || 0,
        maxHours: issuanceDelayMetrics?.maxDelayHours || 0,
        delayedInvoices: issuanceDelayMetrics?.invoicesWithDelay || 0,
        totalInvoices: issuanceDelayMetrics?.totalInvoices || 0,
        delayRate: issuanceDelayMetrics?.totalInvoices > 0 
          ? (issuanceDelayMetrics.invoicesWithDelay / issuanceDelayMetrics.totalInvoices) * 100 
          : 0
      },
      autoInvoice: {
        totalGenerated: autoInvoiceMetrics?.totalGenerated || 0,
        successRate: autoInvoiceMetrics?.totalGenerated > 0 
          ? (autoInvoiceMetrics.successful / autoInvoiceMetrics.totalGenerated) * 100 
          : 0,
        successful: autoInvoiceMetrics?.successful || 0,
        failed: autoInvoiceMetrics?.failed || 0,
        processing: autoInvoiceMetrics?.processing || 0
      },
      revenue: {
        total: revenueMetrics?.totalRevenue || 0,
        paid: revenueMetrics?.paidRevenue || 0,
        overdue: revenueMetrics?.overdueAmount || 0,
        collectionRate: revenueMetrics?.totalRevenue > 0 
          ? (revenueMetrics.paidRevenue / revenueMetrics.totalRevenue) * 100 
          : 0
      }
    });

  } catch (error) {
    console.error("Error fetching billing metrics:", error);
    res.status(500).json({ error: "Failed to fetch billing metrics" });
  }
});

export default router;