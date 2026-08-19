/**
 * Renewal Auto-Quote Routes (US-SUPER-010).
 *
 * Generates renewal drafts ~90 days before a contract ends, re-tiered to the
 * customer's actual trailing-12-month usage (+ a growth buffer) so the rep just
 * reviews and sends. We NEVER auto-send.
 *
 * Endpoints:
 *   POST /api/renewal-autoquote/generate     — daily generator (cron-callable). ?force bypasses the toggle.
 *   GET  /api/renewal-autoquote              — list drafts (dashboard widget), ?status= ?underage=
 *   GET  /api/renewal-autoquote/stats        — counts + auto win rate (vs manual baseline stub)
 *   GET  /api/renewal-autoquote/settings
 *   PUT  /api/renewal-autoquote/settings
 *   GET  /api/renewal-autoquote/suppressions
 *   POST /api/renewal-autoquote/suppressions          — flag a customer "manual renewal only"
 *   DELETE /api/renewal-autoquote/suppressions/:customerId
 *   GET  /api/renewal-autoquote/:id          — detail (machine breakdown + re-tier)
 *   POST /api/renewal-autoquote/:id/mark-sent — flip to 'sent' (rep handed off to the send flow)
 *   POST /api/renewal-autoquote/:id/dismiss
 *   POST /api/renewal-autoquote/:id/outcome  — { outcome: won|lost, note }
 *
 * Schema: shared/renewal-autoquote-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + tenant scoping on every query.
 * TODO(rbac): requirePermission(['sales.renewal.manage']) once it exists.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  renewalAutoQuotes,
  renewalAutoquoteSettings,
  renewalSuppressions,
  contracts,
  equipment,
  meterReadings,
  cpcRates,
  businessRecords,
} from '@shared/schema';

const log = createModuleLogger('routes-renewal-autoquote');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export interface CpcTier {
  minVolume: number;
  maxVolume: number | null;
  cpc: number;
}

/** Pick the CPC tier whose volume band contains `vol`; fall back to the highest. */
// Exported so server/tests/unit/renewal-retier.test.ts can assert this and the
// Deno copy in supabase/functions/_shared/renewal-retier.ts stay identical.
export function pickTier(tiers: CpcTier[], vol: number): CpcTier | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minVolume - b.minVolume);
  for (const t of sorted) {
    const lo = t.minVolume ?? 0;
    const hi = t.maxVolume == null ? Number.POSITIVE_INFINITY : t.maxVolume;
    if (vol >= lo && vol <= hi) return t;
  }
  // Above every band → use the open-ended / highest tier.
  return sorted[sorted.length - 1];
}

function audit(
  action:
    | 'GENERATE'
    | 'MARK_SENT'
    | 'DISMISS'
    | 'OUTCOME'
    | 'UPDATE_SETTINGS'
    | 'SUPPRESS'
    | 'UNSUPPRESS',
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
    '[AUDIT] renewal-autoquote',
  );
}

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.renewalAutoquoteSettings.findFirst({
    where: eq(renewalAutoquoteSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(renewalAutoquoteSettings)
    .values({ tenantId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.renewalAutoquoteSettings.findFirst({
    where: eq(renewalAutoquoteSettings.tenantId, tenantId),
  });
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  daysWindowStart: z.number().int().min(1).max(365).optional(),
  daysWindowEnd: z.number().int().min(1).max(400).optional(),
  growthBufferPct: z.number().int().min(0).max(100).optional(),
  underageThresholdPct: z.number().int().min(0).max(100).optional(),
  expirationDays: z.number().int().min(1).max(180).optional(),
  autoGenerateEnabled: z.boolean().optional(),
});

const suppressSchema = z.object({
  customerId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

const outcomeSchema = z.object({
  outcome: z.enum(['won', 'lost']),
  note: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerRenewalAutoQuoteRoutes(app: Express) {
  /**
   * POST /api/renewal-autoquote/generate
   * Find active contracts ending in the configured window, re-tier from actual
   * 12-month usage, and create renewal_draft rows. Never auto-sends.
   */
  app.post('/api/renewal-autoquote/generate', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const settings = await getOrCreateSettings(tenantId);
      if (!settings) return res.status(500).json({ message: 'Failed to load settings' });

      const force = req.body?.force === true || req.query?.force === 'true';
      if (!settings.autoGenerateEnabled && !force) {
        return res.json({ skipped: true, reason: 'auto-generate disabled for tenant' });
      }

      const now = Date.now();
      const windowStart = new Date(now + settings.daysWindowStart * 86_400_000);
      const windowEnd = new Date(now + settings.daysWindowEnd * 86_400_000);
      const twelveMonthsAgo = new Date(now - 365 * 86_400_000);
      const buffer = 1 + settings.growthBufferPct / 100;

      // Contracts ending in the window.
      const candidates = await db
        .select({
          id: contracts.id,
          customerId: contracts.customerId,
          endDate: contracts.endDate,
          blackRate: contracts.blackRate,
          colorRate: contracts.colorRate,
          monthlyBase: contracts.monthlyBase,
        })
        .from(contracts)
        .where(
          and(
            eq(contracts.tenantId, tenantId),
            eq(contracts.status, 'active'),
            gte(contracts.endDate, windowStart),
            lte(contracts.endDate, windowEnd),
          ),
        );

      // Suppressed customers + already-drafted contracts (dedupe).
      const suppressions = await db
        .select({ customerId: renewalSuppressions.customerId })
        .from(renewalSuppressions)
        .where(eq(renewalSuppressions.tenantId, tenantId));
      const suppressed = new Set(suppressions.map((s) => s.customerId));

      const existingDrafts = await db
        .select({ contractId: renewalAutoQuotes.contractId })
        .from(renewalAutoQuotes)
        .where(
          and(
            eq(renewalAutoQuotes.tenantId, tenantId),
            inArray(renewalAutoQuotes.status, ['renewal_draft', 'sent']),
          ),
        );
      const alreadyDrafted = new Set(existingDrafts.map((d) => d.contractId));

      // CPC tier catalog (re-tier source).
      const allTiers = await db
        .select({
          colorMode: cpcRates.colorMode,
          minVolume: cpcRates.minVolume,
          maxVolume: cpcRates.maxVolume,
          cpc: cpcRates.cpc,
        })
        .from(cpcRates)
        .where(eq(cpcRates.tenantId, tenantId));
      const blackTiers: CpcTier[] = allTiers
        .filter((t) => (t.colorMode ?? '').toLowerCase().includes('b'))
        .map((t) => ({ minVolume: t.minVolume ?? 0, maxVolume: t.maxVolume, cpc: num(t.cpc) }));
      const colorTiers: CpcTier[] = allTiers
        .filter((t) => (t.colorMode ?? '').toLowerCase().includes('color'))
        .map((t) => ({ minVolume: t.minVolume ?? 0, maxVolume: t.maxVolume, cpc: num(t.cpc) }));

      let generated = 0;
      let skippedSuppressed = 0;
      let skippedExisting = 0;
      let skippedNoUsage = 0;

      for (const c of candidates) {
        if (suppressed.has(c.customerId)) {
          skippedSuppressed++;
          continue;
        }
        if (alreadyDrafted.has(c.id)) {
          skippedExisting++;
          continue;
        }

        // Per-machine 12-month usage for this contract (via meter_readings.contract_id;
        // fall back to the customer's equipment when readings aren't contract-linked).
        const machineRows = await db
          .select({
            equipmentId: equipment.id,
            serial: equipment.serialNumber,
            model: equipment.modelNumber,
            black: sql<number>`COALESCE(SUM(COALESCE(${meterReadings.blackCopies}, 0)), 0)`,
            color: sql<number>`COALESCE(SUM(COALESCE(${meterReadings.colorCopies}, 0)), 0)`,
          })
          .from(meterReadings)
          .innerJoin(equipment, eq(equipment.id, meterReadings.equipmentId))
          .where(
            and(
              eq(meterReadings.tenantId, tenantId),
              eq(meterReadings.contractId, c.id),
              gte(meterReadings.readingDate, twelveMonthsAgo),
            ),
          )
          .groupBy(equipment.id, equipment.serialNumber, equipment.modelNumber);

        const machineBreakdown = machineRows.map((m) => ({
          equipmentId: m.equipmentId,
          serial: m.serial ?? null,
          model: m.model ?? null,
          black: num(m.black),
          color: num(m.color),
        }));

        const totalBlack = machineBreakdown.reduce((a, m) => a + m.black, 0);
        const totalColor = machineBreakdown.reduce((a, m) => a + m.color, 0);
        if (totalBlack === 0 && totalColor === 0) {
          skippedNoUsage++;
          continue;
        }

        // Peak month by total volume.
        const peakRows = await db.execute(sql`
          SELECT to_char(date_trunc('month', reading_date), 'YYYY-MM') AS ym,
                 COALESCE(SUM(COALESCE(black_copies,0) + COALESCE(color_copies,0)),0) AS vol
          FROM meter_readings
          WHERE tenant_id = ${tenantId} AND contract_id = ${c.id}
            AND reading_date >= ${twelveMonthsAgo.toISOString()}
          GROUP BY 1
          ORDER BY vol DESC
          LIMIT 1
        `);
        const peak = ((peakRows as any).rows ?? (peakRows as any) ?? [])[0];
        const peakMonth = peak?.ym ?? null;
        const peakVolume = num(peak?.vol);

        const monthlyAvgBlack = totalBlack / 12;
        const monthlyAvgColor = totalColor / 12;

        // Re-tier with growth buffer.
        const blackTier = pickTier(blackTiers, monthlyAvgBlack * buffer);
        const colorTier = pickTier(colorTiers, monthlyAvgColor * buffer);
        const currentBlackRate = num(c.blackRate);
        const currentColorRate = num(c.colorRate);
        const currentMonthlyBase = num(c.monthlyBase);
        const recBlackRate = blackTier ? blackTier.cpc : currentBlackRate;
        const recColorRate = colorTier ? colorTier.cpc : currentColorRate;
        const recMonthlyBase = currentMonthlyBase;

        const currentMonthlyRevenue =
          monthlyAvgBlack * currentBlackRate +
          monthlyAvgColor * currentColorRate +
          currentMonthlyBase;
        const recommendedMonthlyRevenue =
          monthlyAvgBlack * recBlackRate + monthlyAvgColor * recColorRate + recMonthlyBase;
        const isUnderage =
          currentMonthlyRevenue > 0 &&
          recommendedMonthlyRevenue >=
            currentMonthlyRevenue * (1 + settings.underageThresholdPct / 100);

        const lineItems = [
          {
            type: 'base',
            description: 'Monthly base charge',
            quantity: 1,
            rate: recMonthlyBase,
            amount: recMonthlyBase,
          },
          {
            type: 'cpc_black',
            description: 'B/W cost-per-copy (projected monthly volume)',
            quantity: Math.round(monthlyAvgBlack),
            rate: recBlackRate,
            amount: monthlyAvgBlack * recBlackRate,
          },
          {
            type: 'cpc_color',
            description: 'Color cost-per-copy (projected monthly volume)',
            quantity: Math.round(monthlyAvgColor),
            rate: recColorRate,
            amount: monthlyAvgColor * recColorRate,
          },
        ];

        const expirationDate = new Date(now + settings.expirationDays * 86_400_000);

        // Look up the assigned rep from the customer record.
        const customer = await db.query.businessRecords.findFirst({
          where: and(eq(businessRecords.id, c.customerId), eq(businessRecords.tenantId, tenantId)),
          columns: { assignedSalesRep: true },
        });

        await db.insert(renewalAutoQuotes).values({
          tenantId,
          contractId: c.id,
          parentContractId: c.id,
          customerId: c.customerId,
          status: 'renewal_draft',
          assignedSalesRep: customer?.assignedSalesRep ?? null,
          contractEndDate: c.endDate,
          expirationDate,
          totalBlackPages: Math.round(totalBlack),
          totalColorPages: Math.round(totalColor),
          monthlyAvgBlack,
          monthlyAvgColor,
          peakMonth,
          peakVolume: Math.round(peakVolume),
          machineBreakdown,
          currentBlackRate,
          currentColorRate,
          currentMonthlyBase,
          recommendedBlackRate: recBlackRate,
          recommendedColorRate: recColorRate,
          recommendedMonthlyBase: recMonthlyBase,
          currentMonthlyRevenue,
          recommendedMonthlyRevenue,
          isUnderage,
          retierDetail: {
            growthBufferPct: settings.growthBufferPct,
            blackTier,
            colorTier,
            note:
              blackTier || colorTier
                ? 'Re-tiered from cpc_rates volume bands.'
                : 'No cpc_rates tiers found; kept current rates.',
          },
          lineItems,
          quoteValue: recommendedMonthlyRevenue * 12,
        });
        generated++;
      }

      audit('GENERATE', {
        tenantId,
        userId,
        extra: {
          scanned: candidates.length,
          generated,
          skippedSuppressed,
          skippedExisting,
          skippedNoUsage,
        },
      });

      res.json({
        scanned: candidates.length,
        generated,
        skippedSuppressed,
        skippedExisting,
        skippedNoUsage,
      });
    } catch (error: any) {
      log.error('Renewal generation failed:', error);
      res.status(500).json({ message: 'Failed to generate renewals', error: error?.message });
    }
  });

  /** GET /api/renewal-autoquote — list drafts for the dashboard widget. */
  app.get('/api/renewal-autoquote', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const onlyUnderage = req.query.underage === 'true';

      const conditions = [eq(renewalAutoQuotes.tenantId, tenantId)];
      if (status) conditions.push(eq(renewalAutoQuotes.status, status));
      if (onlyUnderage) conditions.push(eq(renewalAutoQuotes.isUnderage, true));

      const rows = await db
        .select()
        .from(renewalAutoQuotes)
        .where(and(...conditions))
        .orderBy(desc(renewalAutoQuotes.isUnderage), desc(renewalAutoQuotes.quoteValue))
        .limit(500);

      // Attach customer names.
      const customerIds = Array.from(new Set(rows.map((r) => r.customerId)));
      const names = customerIds.length
        ? await db
            .select({ id: businessRecords.id, companyName: businessRecords.companyName })
            .from(businessRecords)
            .where(
              and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, customerIds)),
            )
        : [];
      const nameMap = new Map(names.map((n) => [n.id, n.companyName]));

      const data = rows.map((r) => ({ ...r, companyName: nameMap.get(r.customerId) ?? null }));
      const reviewCount = rows.filter((r) => r.status === 'renewal_draft').length;

      res.json({ data, total: data.length, reviewCount });
    } catch (error: any) {
      log.error('Failed to list renewals:', error);
      res.status(500).json({ message: 'Failed to list renewals', error: error?.message });
    }
  });

  /**
   * GET /api/renewal-autoquote/stats
   * Auto-generated renewal win rate vs a manual baseline. The auto figures are
   * real; the manual baseline is a STUB until manual-renewal outcomes are tracked.
   */
  app.get('/api/renewal-autoquote/stats', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const rows = await db
        .select({ outcome: renewalAutoQuotes.outcome, status: renewalAutoQuotes.status })
        .from(renewalAutoQuotes)
        .where(eq(renewalAutoQuotes.tenantId, tenantId));

      const autoWon = rows.filter((r) => r.outcome === 'won').length;
      const autoLost = rows.filter((r) => r.outcome === 'lost').length;
      const decided = autoWon + autoLost;
      const autoWinRate = decided > 0 ? Math.round((autoWon / decided) * 1000) / 10 : null;

      res.json({
        totalDrafts: rows.length,
        pendingReview: rows.filter((r) => r.status === 'renewal_draft').length,
        sent: rows.filter((r) => r.status === 'sent').length,
        autoWon,
        autoLost,
        autoWinRate,
        // STUB: requires tracking outcomes of manually-created renewals.
        manualBaselineWinRate: null,
        manualBaselineNote:
          'Manual-renewal win-rate baseline not yet tracked; wire once manual renewals record outcomes.',
      });
    } catch (error: any) {
      log.error('Failed to load renewal stats:', error);
      res.status(500).json({ message: 'Failed to load stats', error: error?.message });
    }
  });

  /** GET /api/renewal-autoquote/settings */
  app.get('/api/renewal-autoquote/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      res.json(await getOrCreateSettings(tenantId));
    } catch (error: any) {
      log.error('Failed to load settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /** PUT /api/renewal-autoquote/settings */
  app.put('/api/renewal-autoquote/settings', requireAuth, resolveTenant, async (req: any, res) => {
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
        .update(renewalAutoquoteSettings)
        .set({ ...parsed.data, updatedByUserId: userId, updatedAt: new Date() })
        .where(eq(renewalAutoquoteSettings.tenantId, tenantId))
        .returning();

      audit('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.data });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /** GET /api/renewal-autoquote/suppressions */
  app.get(
    '/api/renewal-autoquote/suppressions',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        const rows = await db
          .select({
            id: renewalSuppressions.id,
            customerId: renewalSuppressions.customerId,
            reason: renewalSuppressions.reason,
            createdAt: renewalSuppressions.createdAt,
            companyName: businessRecords.companyName,
          })
          .from(renewalSuppressions)
          .leftJoin(
            businessRecords,
            and(
              eq(businessRecords.id, renewalSuppressions.customerId),
              eq(businessRecords.tenantId, tenantId),
            ),
          )
          .where(eq(renewalSuppressions.tenantId, tenantId));
        res.json({ data: rows, total: rows.length });
      } catch (error: any) {
        log.error('Failed to list suppressions:', error);
        res.status(500).json({ message: 'Failed to list suppressions', error: error?.message });
      }
    },
  );

  /** POST /api/renewal-autoquote/suppressions — flag a customer "manual renewal only". */
  app.post(
    '/api/renewal-autoquote/suppressions',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = suppressSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        const [row] = await db
          .insert(renewalSuppressions)
          .values({
            tenantId,
            customerId: parsed.data.customerId,
            reason: parsed.data.reason ?? null,
            createdByUserId: userId,
          })
          .onConflictDoNothing()
          .returning();

        audit('SUPPRESS', { tenantId, userId, extra: { customerId: parsed.data.customerId } });
        res
          .status(201)
          .json(row ?? { customerId: parsed.data.customerId, alreadySuppressed: true });
      } catch (error: any) {
        log.error('Failed to suppress customer:', error);
        res.status(500).json({ message: 'Failed to suppress customer', error: error?.message });
      }
    },
  );

  /** DELETE /api/renewal-autoquote/suppressions/:customerId */
  app.delete(
    '/api/renewal-autoquote/suppressions/:customerId',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        await db
          .delete(renewalSuppressions)
          .where(
            and(
              eq(renewalSuppressions.tenantId, tenantId),
              eq(renewalSuppressions.customerId, req.params.customerId),
            ),
          );
        audit('UNSUPPRESS', { tenantId, userId, extra: { customerId: req.params.customerId } });
        res.json({ success: true });
      } catch (error: any) {
        log.error('Failed to remove suppression:', error);
        res.status(500).json({ message: 'Failed to remove suppression', error: error?.message });
      }
    },
  );

  /** GET /api/renewal-autoquote/:id — full detail. */
  app.get('/api/renewal-autoquote/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const row = await db.query.renewalAutoQuotes.findFirst({
        where: and(
          eq(renewalAutoQuotes.id, req.params.id),
          eq(renewalAutoQuotes.tenantId, tenantId),
        ),
      });
      if (!row) return res.status(404).json({ message: 'Renewal draft not found' });

      const customer = await db.query.businessRecords.findFirst({
        where: and(eq(businessRecords.id, row.customerId), eq(businessRecords.tenantId, tenantId)),
        columns: { companyName: true },
      });

      res.json({ ...row, companyName: customer?.companyName ?? null });
    } catch (error: any) {
      log.error('Failed to load renewal:', error);
      res.status(500).json({ message: 'Failed to load renewal', error: error?.message });
    }
  });

  /**
   * POST /api/renewal-autoquote/:id/mark-sent
   * Flip a draft to 'sent' after the rep hands it to the quote send flow.
   * TODO: promote into the canonical proposals/quote send flow rather than
   * just flagging; kept decoupled to avoid mutating that schema in this slice.
   */
  app.post(
    '/api/renewal-autoquote/:id/mark-sent',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const [row] = await db
          .update(renewalAutoQuotes)
          .set({ status: 'sent', updatedAt: new Date() })
          .where(
            and(eq(renewalAutoQuotes.id, req.params.id), eq(renewalAutoQuotes.tenantId, tenantId)),
          )
          .returning();
        if (!row) return res.status(404).json({ message: 'Renewal draft not found' });

        audit('MARK_SENT', { tenantId, userId, extra: { id: req.params.id } });
        res.json(row);
      } catch (error: any) {
        log.error('Failed to mark sent:', error);
        res.status(500).json({ message: 'Failed to mark sent', error: error?.message });
      }
    },
  );

  /** POST /api/renewal-autoquote/:id/dismiss */
  app.post(
    '/api/renewal-autoquote/:id/dismiss',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const [row] = await db
          .update(renewalAutoQuotes)
          .set({ status: 'dismissed', updatedAt: new Date() })
          .where(
            and(eq(renewalAutoQuotes.id, req.params.id), eq(renewalAutoQuotes.tenantId, tenantId)),
          )
          .returning();
        if (!row) return res.status(404).json({ message: 'Renewal draft not found' });

        audit('DISMISS', { tenantId, userId, extra: { id: req.params.id } });
        res.json(row);
      } catch (error: any) {
        log.error('Failed to dismiss renewal:', error);
        res.status(500).json({ message: 'Failed to dismiss renewal', error: error?.message });
      }
    },
  );

  /** POST /api/renewal-autoquote/:id/outcome — { outcome: won|lost, note }. */
  app.post(
    '/api/renewal-autoquote/:id/outcome',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = outcomeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        const [row] = await db
          .update(renewalAutoQuotes)
          .set({
            outcome: parsed.data.outcome,
            outcomeNote: parsed.data.note ?? null,
            outcomeAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(eq(renewalAutoQuotes.id, req.params.id), eq(renewalAutoQuotes.tenantId, tenantId)),
          )
          .returning();
        if (!row) return res.status(404).json({ message: 'Renewal draft not found' });

        audit('OUTCOME', {
          tenantId,
          userId,
          extra: { id: req.params.id, outcome: parsed.data.outcome },
        });
        res.json(row);
      } catch (error: any) {
        log.error('Failed to record outcome:', error);
        res.status(500).json({ message: 'Failed to record outcome', error: error?.message });
      }
    },
  );
}
