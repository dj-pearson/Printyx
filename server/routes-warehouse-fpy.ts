import express from 'express';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { billingEngine } from './services/billing-engine-service';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-warehouse-fpy');

import { autoInvoiceGeneration } from '@shared/warehouse-fpy-schema';

const router = express.Router();

// WF-L-05: the kitting and FPY handlers that were here are GONE.
//
// Four kitting endpoints and /fpy-metrics, all with real Zod CRUD over
// warehouse_kitting_operations, and no caller in any of the seven client trees.
// They would have 404'd in production regardless: nothing proxied this prefix
// and no edge function served it. They now live in
// supabase/functions/warehouse-operations under /kitting and /fpy-metrics, which
// IS proxied, so the Build and Serial Numbers tabs reach the same handler on
// both hosts.
//
// Two things went wrong here that the port fixes rather than carries over. Every
// handler read `req.headers['x-tenant-id']` straight into the query, so the
// tenant was whatever the caller asked for - the SEC-TENANT-003 hole; the edge
// function resolves it from the verified JWT. And /fpy-metrics returned a 0%
// yield when nothing had been built in the window, which on a quality dashboard
// reads as every build failing QA; it answers null now and says why.
//
// WHAT STAYS: /auto-invoice and /auto-invoices. They delegate to
// server/services/billing-engine-service and have no edge counterpart, so this
// is the PROD-008c shape - a real feature nobody wired up, where deleting is a
// decision rather than cleanup.

// Trigger auto-invoice generation using billing engine service
// NOTE: This endpoint now delegates to the centralized billing engine
router.post('/auto-invoice/:sourceType/:sourceId', async (req, res) => {
  try {
    const { sourceType, sourceId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    // Use centralized billing engine service for auto-invoice generation
    let invoice;

    if (sourceType === 'service_ticket') {
      invoice = await billingEngine.autoGenerateFromServiceTicket(sourceId, tenantId);
    } else if (sourceType === 'warehouse_operation') {
      invoice = await billingEngine.autoGenerateFromWarehouseOperation(sourceId, tenantId);
    } else {
      return res
        .status(400)
        .json({ error: 'Invalid sourceType. Must be service_ticket or warehouse_operation' });
    }

    res.status(201).json(invoice);
  } catch (error: any) {
    log.error('Error creating auto-invoice:', error);
    res.status(500).json({
      error: 'Failed to create auto-invoice',
      message: error.message,
    });
  }
});

// Get auto-invoice status
router.get('/auto-invoice/:sourceType/:sourceId', async (req, res) => {
  try {
    const { sourceType, sourceId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const [autoInvoice] = await db
      .select()
      .from(autoInvoiceGeneration)
      .where(
        and(
          eq(autoInvoiceGeneration.tenantId, tenantId),
          eq(autoInvoiceGeneration.sourceType, sourceType),
          eq(autoInvoiceGeneration.sourceId, sourceId),
        ),
      )
      .limit(1);

    if (!autoInvoice) {
      return res.status(404).json({ error: 'Auto-invoice not found' });
    }

    res.json(autoInvoice);
  } catch (error) {
    log.error('Error fetching auto-invoice:', error);
    res.status(500).json({ error: 'Failed to fetch auto-invoice' });
  }
});

// Get auto-invoice list with filtering
router.get('/auto-invoices', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { status, fromDate, toDate, delayFilter } = req.query;

    // QUALITY-002: see the kitting-operations note above. Same defect, same fix.
    const conditions = [eq(autoInvoiceGeneration.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(autoInvoiceGeneration.generationStatus, status as string));
    }

    if (fromDate) {
      conditions.push(gte(autoInvoiceGeneration.triggeredAt, new Date(fromDate as string)));
    }

    if (toDate) {
      conditions.push(lte(autoInvoiceGeneration.triggeredAt, new Date(toDate as string)));
    }

    // Filter for issuance delay > 24 hours
    if (delayFilter === 'gt_24h') {
      conditions.push(sql`${autoInvoiceGeneration.issuanceDelayHours} > 24`);
    }

    const invoices = await db
      .select()
      .from(autoInvoiceGeneration)
      .where(and(...conditions))
      .orderBy(desc(autoInvoiceGeneration.triggeredAt));

    res.json(invoices);
  } catch (error) {
    log.error('Error fetching auto-invoices:', error);
    res.status(500).json({ error: 'Failed to fetch auto-invoices' });
  }
});

export default router;
