/**
 * Deal Desk Copilot Routes (US-SUPER-008).
 *
 * Advisory, non-blocking sidebar shown on the quote (proposal) edit page. The
 * quote IS a proposal — `quoteId` is `proposals.id`. Every endpoint resolves the
 * proposal by id+tenant first (404 if missing); the customer is
 * `proposals.businessRecordId`.
 *
 * Endpoints:
 *   GET /api/deal-desk-copilot/settings           — getOrCreate
 *   PUT /api/deal-desk-copilot/settings           — { gpFloorPct?: 0..100 }
 *   GET /api/deal-desk-copilot/:quoteId/snapshot      — fast Postgres-only account snapshot (no AI)
 *   GET /api/deal-desk-copilot/:quoteId/similar-deals — top-5 closed-won comps (memoized 1h)
 *   GET /api/deal-desk-copilot/:quoteId/margin        — live GP$/GP% vs floor
 *   GET /api/deal-desk-copilot/:quoteId/objections    — Claude objections + deterministic fallback
 *
 * IMPORTANT: /settings (GET+PUT) is registered BEFORE the /:quoteId/* routes so
 * "settings" can never be captured as a quoteId.
 *
 * Schema: shared/deal-desk-copilot-schema.ts + shared/churn-risk-schema.ts
 * (both re-exported from shared/schema.ts).
 * Auth: requireAuth + tenant scoping on every query.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import ClaudeAIService from './services/claude-ai-service';
import {
  dealDeskCopilotSettings,
  customerChurnScores,
  proposals,
  proposalLineItems,
  businessRecords,
  serviceTickets,
  invoices,
} from '@shared/schema';
import {
  computeQuoteCost,
  computeMargin,
  headcountBand,
  machineClassOf,
  dealMatches,
} from '@shared/deal-desk-margin';

/** proposalType values that represent a financed/leased deal. */
const FINANCED_PROPOSAL_TYPES = new Set(['equipment_lease', 'lease', 'financed', 'fmv_lease']);
function isFinancedDeal(proposalType: string | null | undefined): boolean {
  return FINANCED_PROPOSAL_TYPES.has(String(proposalType ?? '').toLowerCase());
}

const log = createModuleLogger('routes-deal-desk-copilot');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function audit(
  action: 'UPDATE_SETTINGS' | 'SNAPSHOT' | 'SIMILAR_DEALS' | 'MARGIN' | 'OBJECTIONS',
  ctx: { tenantId: string; userId: string | undefined; extra?: unknown },
) {
  log.info(
    {
      audit: true,
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    },
    '[AUDIT] deal-desk-copilot',
  );
}

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.dealDeskCopilotSettings.findFirst({
    where: eq(dealDeskCopilotSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(dealDeskCopilotSettings)
    .values({ tenantId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.dealDeskCopilotSettings.findFirst({
    where: eq(dealDeskCopilotSettings.tenantId, tenantId),
  });
}

/** Resolve a proposal by id+tenant. Returns null if missing (caller 404s). */
async function resolveProposal(tenantId: string, quoteId: string) {
  return db.query.proposals.findFirst({
    where: and(eq(proposals.id, quoteId), eq(proposals.tenantId, tenantId)),
  });
}

// ---------------------------------------------------------------------------
// Similar-deals memo cache (module-level, 1-hour TTL)
// ---------------------------------------------------------------------------

interface SimilarDealsResult {
  closeRate: number | null;
  avgDiscount: number | null;
  avgDealSize: number | null;
  cohortSize: number;
  deals: Array<{
    id: string;
    proposalNumber: string;
    totalAmount: number;
    discountPercentage: number;
    updatedAt: Date | null;
  }>;
  matching: {
    territory: string | null;
    proposalType: string | null;
    sizeBandLow: number;
    sizeBandHigh: number;
    /** Quote's derived machine class (from equipment line names). */
    machineClass: string;
    /** Quote's customer headcount band (from Account.NumberOfEmployees). */
    headcountBand: string;
  };
}

const similarDealsCache = new Map<string, { value: SimilarDealsResult; expires: number }>();
const SIMILAR_DEALS_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  gpFloorPct: z.number().min(0).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerDealDeskCopilotRoutes(app: Express) {
  // -------------------------------------------------------------------------
  // SETTINGS — registered BEFORE /:quoteId/* so "settings" isn't a quoteId.
  // -------------------------------------------------------------------------

  /** GET /api/deal-desk-copilot/settings */
  app.get('/api/deal-desk-copilot/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      res.json(await getOrCreateSettings(tenantId));
    } catch (error: any) {
      log.error('Failed to load settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /** PUT /api/deal-desk-copilot/settings — { gpFloorPct?: 0..100 } */
  app.put('/api/deal-desk-copilot/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      await getOrCreateSettings(tenantId);

      const [updated] = await db
        .update(dealDeskCopilotSettings)
        .set({ ...parsed.data, updatedByUserId: userId, updatedAt: new Date() })
        .where(eq(dealDeskCopilotSettings.tenantId, tenantId))
        .returning();

      audit('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.data });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  // -------------------------------------------------------------------------
  // 1) SNAPSHOT — fast Postgres only (no AI).
  // -------------------------------------------------------------------------

  app.get(
    '/api/deal-desk-copilot/:quoteId/snapshot',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const proposal = await resolveProposal(tenantId, req.params.quoteId);
        if (!proposal) return res.status(404).json({ message: 'Quote not found' });
        const customerId = proposal.businessRecordId;

        // --- Open service tickets: count + by-priority. ---
        const openTicketRows = await db
          .select({ priority: serviceTickets.priority, status: serviceTickets.status })
          .from(serviceTickets)
          .where(
            and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.customerId, customerId)),
          );
        const CLOSED = new Set(['completed', 'closed', 'resolved', 'cancelled']);
        const open = openTicketRows.filter((t) => !CLOSED.has((t.status ?? '').toLowerCase()));
        const byPriority: Record<string, number> = {};
        for (const t of open) {
          const p = (t.priority ?? 'unknown').toLowerCase();
          byPriority[p] = (byPriority[p] ?? 0) + 1;
        }

        // --- AR aging buckets (positive balances only). ---
        const invoiceRows = await db
          .select({ balanceDue: invoices.balanceDue, dueDate: invoices.dueDate })
          .from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.customerId, customerId)));
        const now = Date.now();
        const arAging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
        for (const inv of invoiceRows) {
          const bal = num(inv.balanceDue);
          if (bal <= 0) continue;
          const due = inv.dueDate ? new Date(inv.dueDate).getTime() : now;
          const daysPastDue = Math.floor((now - due) / 86_400_000);
          if (daysPastDue <= 0) arAging.current += bal;
          else if (daysPastDue <= 30) arAging.d1_30 += bal;
          else if (daysPastDue <= 60) arAging.d31_60 += bal;
          else if (daysPastDue <= 90) arAging.d61_90 += bal;
          else arAging.d90_plus += bal;
        }
        const arTotal =
          arAging.current + arAging.d1_30 + arAging.d31_60 + arAging.d61_90 + arAging.d90_plus;
        const arPastDue = arAging.d1_30 + arAging.d31_60 + arAging.d61_90 + arAging.d90_plus;

        // --- Last 3 quote outcomes (this customer's OTHER proposals). ---
        const lastQuotes = await db
          .select({
            proposalNumber: proposals.proposalNumber,
            status: proposals.status,
            totalAmount: proposals.totalAmount,
            updatedAt: proposals.updatedAt,
          })
          .from(proposals)
          .where(
            and(
              eq(proposals.tenantId, tenantId),
              eq(proposals.businessRecordId, customerId),
              ne(proposals.id, proposal.id),
            ),
          )
          .orderBy(desc(proposals.updatedAt))
          .limit(3);

        // --- Latest churn score for the customer. ---
        const churnRow = await db
          .select({ score: customerChurnScores.score, band: customerChurnScores.band })
          .from(customerChurnScores)
          .where(
            and(
              eq(customerChurnScores.tenantId, tenantId),
              eq(customerChurnScores.customerId, customerId),
            ),
          )
          .orderBy(desc(customerChurnScores.calculatedAt))
          .limit(1);

        res.json({
          customerId,
          openTickets: { total: open.length, byPriority },
          arAging: {
            ...arAging,
            total: arTotal,
            pastDue: arPastDue,
          },
          lastQuotes: lastQuotes.map((q) => ({
            proposalNumber: q.proposalNumber,
            status: q.status,
            totalAmount: num(q.totalAmount),
            updatedAt: q.updatedAt,
          })),
          churn: churnRow[0] ? { score: num(churnRow[0].score), band: churnRow[0].band } : null,
        });
      } catch (error: any) {
        log.error('Failed to build snapshot:', error);
        res.status(500).json({ message: 'Failed to build snapshot', error: error?.message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // 2) SIMILAR DEALS — top-5 closed-won comps, memoized 1h.
  // -------------------------------------------------------------------------

  app.get(
    '/api/deal-desk-copilot/:quoteId/similar-deals',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const proposal = await resolveProposal(tenantId, req.params.quoteId);
        if (!proposal) return res.status(404).json({ message: 'Quote not found' });
        const customerId = proposal.businessRecordId;

        // Customer territory + headcount drive region/size matching.
        const customer = await db.query.businessRecords.findFirst({
          where: and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)),
          columns: { territory: true, employeeCount: true },
        });
        const territory = customer?.territory ?? null;
        const proposalType = proposal.proposalType ?? null;
        const thisSize = num(proposal.totalAmount) || num(proposal.subtotal);
        const sizeBandLow = thisSize * 0.5;
        const sizeBandHigh = thisSize > 0 ? thisSize * 1.5 : Number.POSITIVE_INFINITY;
        const sizeBandKey =
          thisSize > 0 ? `${Math.round(sizeBandLow)}-${Math.round(sizeBandHigh)}` : 'any';

        // Quote's own machine class (from its equipment line names) + headcount band.
        const thisLines = await db
          .select({
            itemType: proposalLineItems.itemType,
            productName: proposalLineItems.productName,
          })
          .from(proposalLineItems)
          .where(
            and(
              eq(proposalLineItems.tenantId, tenantId),
              eq(proposalLineItems.proposalId, proposal.id),
            ),
          );
        const quoteMachineClass = machineClassOf(thisLines, proposalType);
        const quoteHeadcountBand = headcountBand(customer?.employeeCount);
        const quoteProfile = {
          machineClass: quoteMachineClass,
          headcountBand: quoteHeadcountBand,
          territory,
        };

        const cacheKey = `${tenantId}:${territory ?? '-'}:${sizeBandKey}:${proposalType ?? '-'}:${quoteMachineClass}:${quoteHeadcountBand}`;
        const cached = similarDealsCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          return res.json(cached.value);
        }

        // Cohort: tenant proposals matched on machine class + customer headcount
        // band + region (territory) + size band. We pull a candidate set then
        // classify + filter in JS so the joins stay simple and resilient.
        const cohortConditions = [eq(proposals.tenantId, tenantId)];
        if (proposalType) cohortConditions.push(eq(proposals.proposalType, proposalType));

        const candidates = await db
          .select({
            id: proposals.id,
            proposalNumber: proposals.proposalNumber,
            status: proposals.status,
            totalAmount: proposals.totalAmount,
            discountPercentage: proposals.discountPercentage,
            updatedAt: proposals.updatedAt,
            businessRecordId: proposals.businessRecordId,
            proposalType: proposals.proposalType,
          })
          .from(proposals)
          .where(and(...cohortConditions))
          .limit(2000);

        // Resolve candidate customers' territory + headcount (for region/size match).
        const custIds = Array.from(
          new Set(candidates.map((c) => c.businessRecordId).filter(Boolean)),
        );
        const custRows = custIds.length
          ? await db
              .select({
                id: businessRecords.id,
                territory: businessRecords.territory,
                employeeCount: businessRecords.employeeCount,
              })
              .from(businessRecords)
              .where(
                and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, custIds)),
              )
          : [];
        const custById = new Map(custRows.map((r) => [r.id, r]));

        // Classify each candidate's machine class from its equipment line names.
        const candidateIds = candidates.map((c) => c.id);
        const candLines = candidateIds.length
          ? await db
              .select({
                proposalId: proposalLineItems.proposalId,
                itemType: proposalLineItems.itemType,
                productName: proposalLineItems.productName,
              })
              .from(proposalLineItems)
              .where(
                and(
                  eq(proposalLineItems.tenantId, tenantId),
                  inArray(proposalLineItems.proposalId, candidateIds),
                ),
              )
          : [];
        const linesByProposal = new Map<
          string,
          Array<{ itemType: string | null; productName: string | null }>
        >();
        for (const l of candLines) {
          const arr = linesByProposal.get(l.proposalId) ?? [];
          arr.push({ itemType: l.itemType, productName: l.productName });
          linesByProposal.set(l.proposalId, arr);
        }

        // Machine class + headcount band + region + size-band cohort.
        const cohort = candidates.filter((c) => {
          const cust = custById.get(c.businessRecordId);
          const candProfile = {
            machineClass: machineClassOf(linesByProposal.get(c.id) ?? [], c.proposalType),
            headcountBand: headcountBand(cust?.employeeCount),
            territory: cust?.territory ?? null,
          };
          if (!dealMatches(quoteProfile, candProfile)) return false;
          const amt = num(c.totalAmount);
          if (thisSize > 0 && (amt < sizeBandLow || amt > sizeBandHigh)) return false;
          return true;
        });

        const accepted = cohort.filter((c) => c.status === 'accepted');
        const decided = cohort.filter((c) =>
          ['accepted', 'rejected', 'expired'].includes(c.status ?? ''),
        );
        const closeRate =
          decided.length > 0 ? Math.round((accepted.length / decided.length) * 1000) / 10 : null;

        const avgDiscount =
          cohort.length > 0
            ? Math.round(
                (cohort.reduce((a, c) => a + num(c.discountPercentage), 0) / cohort.length) * 10,
              ) / 10
            : null;
        const avgDealSize =
          cohort.length > 0
            ? Math.round(cohort.reduce((a, c) => a + num(c.totalAmount), 0) / cohort.length)
            : null;

        // Top-5 closed-won deals by size (most relevant comps).
        const topDeals = [...accepted]
          .sort((a, b) => num(b.totalAmount) - num(a.totalAmount))
          .slice(0, 5)
          .map((d) => ({
            id: d.id,
            proposalNumber: d.proposalNumber,
            totalAmount: num(d.totalAmount),
            discountPercentage: num(d.discountPercentage),
            updatedAt: d.updatedAt,
          }));

        const result: SimilarDealsResult = {
          closeRate,
          avgDiscount,
          avgDealSize,
          cohortSize: cohort.length,
          deals: topDeals,
          matching: {
            territory,
            proposalType,
            sizeBandLow,
            sizeBandHigh: Number.isFinite(sizeBandHigh) ? sizeBandHigh : 0,
            machineClass: quoteMachineClass,
            headcountBand: quoteHeadcountBand,
          },
        };

        similarDealsCache.set(cacheKey, {
          value: result,
          expires: Date.now() + SIMILAR_DEALS_TTL_MS,
        });

        res.json(result);
      } catch (error: any) {
        log.error('Failed to find similar deals:', error);
        res.status(500).json({ message: 'Failed to find similar deals', error: error?.message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // 3) MARGIN — live GP$/GP% vs floor.
  // TODO(rbac): requirePermission(['sales.quote.view_margin']) (default MANAGER+OWNER)
  // -------------------------------------------------------------------------

  app.get(
    '/api/deal-desk-copilot/:quoteId/margin',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const proposal = await resolveProposal(tenantId, req.params.quoteId);
        if (!proposal) return res.status(404).json({ message: 'Quote not found' });

        const revenue = num(proposal.totalAmount) || num(proposal.subtotal);

        // Cost = parts + projected service-delivery + financing carry. See
        // shared/deal-desk-margin.ts for the model (unit-tested).
        const lines = await db
          .select({
            itemType: proposalLineItems.itemType,
            unitCost: proposalLineItems.unitCost,
            unitPrice: proposalLineItems.unitPrice,
            quantity: proposalLineItems.quantity,
          })
          .from(proposalLineItems)
          .where(
            and(
              eq(proposalLineItems.tenantId, tenantId),
              eq(proposalLineItems.proposalId, proposal.id),
            ),
          );
        const costLines = lines.map((l) => ({
          itemType: l.itemType,
          unitCost: num(l.unitCost),
          unitPrice: num(l.unitPrice),
          quantity: l.quantity ?? 1,
        }));

        const settings = await getOrCreateSettings(tenantId);
        const gpFloorPct = settings ? num(settings.gpFloorPct) : 30;
        const financed = isFinancedDeal(proposal.proposalType);
        const cost = computeQuoteCost(costLines, { revenue, financed });
        const margin = computeMargin({ revenue, cost, gpFloorPct });

        res.json({
          revenue: margin.revenue,
          // Backward-compatible scalar (now the full modeled cost, not parts-only).
          cost: margin.totalCost,
          grossProfit: margin.grossProfit,
          gpPercent: margin.gpPercent,
          gpFloorPct: margin.gpFloorPct,
          belowFloor: margin.belowFloor,
          financed,
          costBreakdown: {
            partsCost: margin.partsCost,
            serviceCost: margin.serviceCost,
            financingCost: margin.financingCost,
          },
        });
      } catch (error: any) {
        log.error('Failed to compute margin:', error);
        res.status(500).json({ message: 'Failed to compute margin', error: error?.message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // 4) OBJECTIONS — Claude objections + deterministic fallback.
  // -------------------------------------------------------------------------

  app.get(
    '/api/deal-desk-copilot/:quoteId/objections',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const proposal = await resolveProposal(tenantId, req.params.quoteId);
        if (!proposal) return res.status(404).json({ message: 'Quote not found' });
        const customerId = proposal.businessRecordId;

        // Gather the same real signals the snapshot/margin use.
        const [customer, ticketRows, invoiceRows, lineRows, lastQuotes] = await Promise.all([
          db.query.businessRecords.findFirst({
            where: and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)),
            columns: { companyName: true, industry: true, territory: true },
          }),
          db
            .select({ status: serviceTickets.status, priority: serviceTickets.priority })
            .from(serviceTickets)
            .where(
              and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.customerId, customerId)),
            ),
          db
            .select({ balanceDue: invoices.balanceDue, dueDate: invoices.dueDate })
            .from(invoices)
            .where(and(eq(invoices.tenantId, tenantId), eq(invoices.customerId, customerId))),
          db
            .select({
              productName: proposalLineItems.productName,
              unitCost: proposalLineItems.unitCost,
              quantity: proposalLineItems.quantity,
            })
            .from(proposalLineItems)
            .where(
              and(
                eq(proposalLineItems.tenantId, tenantId),
                eq(proposalLineItems.proposalId, proposal.id),
              ),
            ),
          db
            .select({ status: proposals.status, validUntil: proposals.validUntil })
            .from(proposals)
            .where(
              and(
                eq(proposals.tenantId, tenantId),
                eq(proposals.businessRecordId, customerId),
                ne(proposals.id, proposal.id),
              ),
            )
            .orderBy(desc(proposals.updatedAt))
            .limit(3),
        ]);

        const CLOSED = new Set(['completed', 'closed', 'resolved', 'cancelled']);
        const openTickets = ticketRows.filter(
          (t) => !CLOSED.has((t.status ?? '').toLowerCase()),
        ).length;

        const now = Date.now();
        let pastDue = 0;
        for (const inv of invoiceRows) {
          const bal = num(inv.balanceDue);
          if (bal <= 0) continue;
          const due = inv.dueDate ? new Date(inv.dueDate).getTime() : now;
          if (due < now) pastDue += bal;
        }

        const revenue = num(proposal.totalAmount) || num(proposal.subtotal);
        const cost = lineRows.reduce((a, l) => a + num(l.unitCost) * (l.quantity ?? 1), 0);
        const gpPercent = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
        const settings = await getOrCreateSettings(tenantId);
        const gpFloorPct = settings ? num(settings.gpFloorPct) : 30;
        const belowFloor = revenue > 0 && gpPercent < gpFloorPct;

        const hasExpiredPrior = lastQuotes.some(
          (q) =>
            q.status === 'expired' ||
            (q.validUntil ? new Date(q.validUntil).getTime() < now : false),
        );

        // Deterministic fallback derived from real signals.
        const fallback: Array<{ objection: string; response: string }> = [];
        if (openTickets > 0) {
          fallback.push({
            objection: `Concern about current service responsiveness (${openTickets} open ticket${openTickets === 1 ? '' : 's'}).`,
            response:
              'Acknowledge the open tickets, share the resolution plan/SLA, and tie the proposal to improved service coverage.',
          });
        }
        if (pastDue > 0) {
          fallback.push({
            objection: `Budget / payment-terms hesitation (about $${Math.round(pastDue).toLocaleString()} past due on the account).`,
            response:
              'Offer flexible payment terms or a payment plan, and confirm AR is current before close to de-risk the deal.',
          });
        }
        if (belowFloor) {
          fallback.push({
            objection: 'Price pushback / request for a deeper discount.',
            response:
              'Reinforce total value and TCO; the margin is already below floor, so anchor on outcomes rather than cutting price further.',
          });
        }
        if (hasExpiredPrior) {
          fallback.push({
            objection: 'Timing — a prior quote already expired without a decision.',
            response:
              'Surface what changed since the last quote and add a clear, time-bound incentive to drive a decision now.',
          });
        }
        // Always provide a generic competitive objection so we return >=3.
        fallback.push({
          objection: 'Evaluating competing vendors / staying with the incumbent.',
          response:
            'Differentiate on local service, response times, and bundled value; offer references and a side-by-side comparison.',
        });
        if (fallback.length < 3) {
          fallback.push({
            objection: 'Need to involve additional stakeholders before deciding.',
            response:
              'Offer to present to the broader buying committee and provide an executive summary tailored to each role.',
          });
        }
        const deterministic = fallback.slice(0, 5);

        // Try Claude; fall back deterministically on any failure.
        try {
          const lineSummary = lineRows
            .slice(0, 20)
            .map((l) => `- ${l.productName ?? 'item'} x${l.quantity ?? 1}`)
            .join('\n');
          const prompt =
            `You are a deal-desk advisor for a copier/MFP dealer. Predict the buyer's likely ` +
            `objections to this quote and give a concise suggested rep response for each.\n\n` +
            `Customer: ${customer?.companyName ?? 'Unknown'} (industry: ${customer?.industry ?? 'n/a'}, territory: ${customer?.territory ?? 'n/a'}).\n` +
            `Open service tickets: ${openTickets}. Past-due AR: $${Math.round(pastDue)}.\n` +
            `Quote total: $${Math.round(revenue)}; gross margin: ${gpPercent.toFixed(1)}% (floor ${gpFloorPct}%${belowFloor ? ', BELOW floor' : ''}).\n` +
            `Prior expired quote: ${hasExpiredPrior ? 'yes' : 'no'}.\n` +
            `Quote line items:\n${lineSummary || '- (none)'}\n\n` +
            `Return ONLY a JSON array of 3-5 objects, each {"objection": string, "response": string}. No prose.`;

          const text = await ClaudeAIService.generateCompletion({
            max_tokens: 900,
            messages: [{ role: 'user', content: prompt }],
          });

          const match = text.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (
              Array.isArray(parsed) &&
              parsed.length > 0 &&
              parsed.every(
                (x) => x && typeof x.objection === 'string' && typeof x.response === 'string',
              )
            ) {
              audit('OBJECTIONS', {
                tenantId,
                userId,
                extra: { source: 'ai', quoteId: proposal.id },
              });
              return res.json({
                objections: parsed
                  .slice(0, 5)
                  .map((x: any) => ({ objection: x.objection, response: x.response })),
                source: 'ai',
              });
            }
          }
        } catch (aiError: any) {
          log.warn({ err: aiError?.message }, 'Objections AI failed; using fallback');
        }

        audit('OBJECTIONS', {
          tenantId,
          userId,
          extra: { source: 'fallback', quoteId: proposal.id },
        });
        res.json({ objections: deterministic, source: 'fallback' });
      } catch (error: any) {
        log.error('Failed to generate objections:', error);
        res.status(500).json({ message: 'Failed to generate objections', error: error?.message });
      }
    },
  );
}
