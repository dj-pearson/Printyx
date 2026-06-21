/**
 * Predictive Parts Truck-Stocking Optimizer Routes (US-SUPER-007).
 *
 * Recommends the optimal parts to stock on each tech's truck from their actual
 * last-90-day parts-used patterns, so techs stop returning to base for parts.
 * A Sunday-night optimizer run (cron-callable via POST /generate) produces a
 * per-tech recommendation; the warehouse picks it, the tech confirms receipt,
 * and we apply the result to truck_inventory. Callbacks ("had to come back for a
 * part") feed model-accuracy stats.
 *
 * Endpoints:
 *   POST /api/truck-stock/generate                       — run the optimizer (cron-callable). body { techUserId? }
 *   GET  /api/truck-stock/recommendations                — latest recommendation per tech
 *   GET  /api/truck-stock/recommendations/:id            — single recommendation + techName
 *   GET  /api/truck-stock/recommendations/:id/export.csv — restock pick list CSV
 *   POST /api/truck-stock/recommendations/:id/pick       — status -> picking (warehouse started pick)
 *   POST /api/truck-stock/recommendations/:id/receive    — status -> received; APPLY to truck_inventory
 *   GET  /api/truck-stock/inventory?techUserId=          — a tech's current truck stock
 *   GET  /api/truck-stock/settings?techUserId=           — getOrCreate per-tech capacity
 *   PUT  /api/truck-stock/settings                       — update per-tech capacity
 *   POST /api/truck-stock/callbacks                      — record a "missing part" callback
 *   GET  /api/truck-stock/stats                          — accuracy stats (callbacks + fill-rate lift)
 *
 * Schema: shared/truck-stock-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + tenant scoping on every query.
 *
 * Documented proxies / STUBs:
 *   - A tech's "territory/fleet" is DERIVED from service_tickets assigned to them
 *     (no explicit tech→territory table — stub).
 *   - assignedTechnicianId is treated as the tech identifier (techUserId).
 *   - recommendedQty(sku) ≈ trailing-90-day usage count (expected next-90d usage).
 *   - fillRate is a coverage PROXY: % of "parts jobs" whose every used part is
 *     covered by available qty.
 *   - part→inventory_items match is fuzzy (part_number = sku OR name = sku);
 *     unmatched parts get unitCost 0 and description = the sku.
 *   - TODO(cron): wire the Sunday-night generator run.
 *   - TODO(rbac): requirePermission(['service.truck_stock.manage']) once it exists.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  truckInventory,
  truckStockSettings,
  truckStockRecommendations,
  truckStockCallbacks,
  TRUCK_STOCK_STATUSES,
  serviceTickets,
  technicians,
  inventoryItems,
} from '@shared/schema';

const log = createModuleLogger('routes-truck-stock');

const NINETY_DAYS_MS = 90 * 86_400_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function audit(
  action: 'GENERATE' | 'PICK' | 'RECEIVE' | 'UPDATE_SETTINGS' | 'CALLBACK' | 'EXPORT_CSV',
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
    '[AUDIT] truck-stock',
  );
}

async function getOrCreateSettings(tenantId: string, techUserId: string) {
  const existing = await db.query.truckStockSettings.findFirst({
    where: and(
      eq(truckStockSettings.tenantId, tenantId),
      eq(truckStockSettings.techUserId, techUserId),
    ),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(truckStockSettings)
    .values({ tenantId, techUserId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.truckStockSettings.findFirst({
    where: and(
      eq(truckStockSettings.tenantId, tenantId),
      eq(truckStockSettings.techUserId, techUserId),
    ),
  });
}

/**
 * Best-effort display name for a tech identifier. techUserId may be a
 * technicians.id OR a technicians.userId (documented stub) — match either,
 * tenant-scoped. Returns null when no match.
 */
async function resolveTechNames(tenantId: string, techIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (techIds.length === 0) return out;
  const rows = await db
    .select({
      id: technicians.id,
      userId: technicians.userId,
      firstName: technicians.firstName,
      lastName: technicians.lastName,
    })
    .from(technicians)
    .where(eq(technicians.tenantId, tenantId));
  for (const r of rows) {
    const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
    if (!name) continue;
    if (techIds.includes(r.id)) out.set(r.id, name);
    if (techIds.includes(r.userId)) out.set(r.userId, name);
  }
  return out;
}

interface RecommendedItem {
  sku: string;
  description: string;
  recommendedQty: number;
  currentQty: number;
  delta: number;
  unitCost: number;
  usage90d: number;
}

interface OptimizerResult {
  currentFillRate: number;
  projectedFillRate: number;
  capacityTotal: number;
  capacityDistinct: number;
  recommendedItems: RecommendedItem[];
}

/**
 * Compute the coverage fill-rate PROXY for a set of "parts jobs" against a stock
 * map: a job is "covered" iff every used part has stock qty >= used count in
 * that job. Returns a percentage (0..100). Jobs with no parts are ignored.
 */
function fillRate(partsJobs: Map<string, number>[], stock: Map<string, number>): number {
  if (partsJobs.length === 0) return 0;
  let covered = 0;
  for (const job of partsJobs) {
    let ok = true;
    for (const [sku, used] of Array.from(job.entries())) {
      if ((stock.get(sku) ?? 0) < used) {
        ok = false;
        break;
      }
    }
    if (ok) covered += 1;
  }
  return Math.round((covered / partsJobs.length) * 1000) / 10;
}

/**
 * Run the optimizer for a single tech. Pulls last-90-day parts usage from
 * service_tickets, matches SKUs to inventory_items for cost/description, applies
 * per-tech capacity, and computes current vs projected fill rate.
 */
async function runOptimizer(tenantId: string, techUserId: string): Promise<OptimizerResult> {
  const since = new Date(Date.now() - NINETY_DAYS_MS);

  // Tickets assigned to this tech in the last 90 days.
  const tickets = await db
    .select({ partsUsed: serviceTickets.partsUsed })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, tenantId),
        eq(serviceTickets.assignedTechnicianId, techUserId),
        gte(serviceTickets.createdAt, since),
      ),
    );

  // Frequency map sku->count, and per-job parts-count maps (a "parts job" used >=1 part).
  const usage = new Map<string, number>();
  const partsJobs: Map<string, number>[] = [];
  for (const t of tickets) {
    const parts = (t.partsUsed ?? []).filter((p): p is string => !!p && p.trim().length > 0);
    if (parts.length === 0) continue;
    const job = new Map<string, number>();
    for (const raw of parts) {
      const sku = raw.trim();
      usage.set(sku, (usage.get(sku) ?? 0) + 1);
      job.set(sku, (job.get(sku) ?? 0) + 1);
    }
    partsJobs.push(job);
  }

  // Current truck inventory for this tech.
  const currentRows = await db
    .select({ partSku: truckInventory.partSku, quantityOnTruck: truckInventory.quantityOnTruck })
    .from(truckInventory)
    .where(and(eq(truckInventory.tenantId, tenantId), eq(truckInventory.techUserId, techUserId)));
  const currentStock = new Map<string, number>();
  for (const r of currentRows) currentStock.set(r.partSku, num(r.quantityOnTruck));

  // Capacity.
  const settings = await getOrCreateSettings(tenantId, techUserId);
  const capacityTotal = settings?.maxTotalQuantity ?? 120;
  const capacityDistinct = settings?.maxDistinctSkus ?? 40;

  // Match SKUs to inventory_items (fuzzy: part_number = sku OR name = sku).
  const skus = Array.from(usage.keys());
  const costMap = new Map<string, { unitCost: number; description: string }>();
  if (skus.length > 0) {
    const items = await db
      .select({
        partNumber: inventoryItems.partNumber,
        name: inventoryItems.name,
        itemDescription: inventoryItems.itemDescription,
        unitCost: inventoryItems.unitCost,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.tenantId, tenantId));
    for (const it of items) {
      for (const sku of skus) {
        if (costMap.has(sku)) continue;
        if (it.partNumber === sku || it.name === sku) {
          costMap.set(sku, {
            unitCost: num(it.unitCost),
            description: it.itemDescription || it.name || sku,
          });
        }
      }
    }
  }

  // Greedy capacity fit: sort by usage desc, include until capacity is hit.
  const sorted = Array.from(usage.entries()).sort((a, b) => b[1] - a[1]);
  const recommendedItems: RecommendedItem[] = [];
  const recommendedStock = new Map<string, number>();
  let totalQty = 0;
  let distinct = 0;
  for (const [sku, usage90d] of sorted) {
    if (distinct >= capacityDistinct) break;
    const remaining = capacityTotal - totalQty;
    if (remaining <= 0) break;
    const recommendedQty = Math.min(usage90d, remaining);
    if (recommendedQty <= 0) break;
    const currentQty = currentStock.get(sku) ?? 0;
    const matched = costMap.get(sku);
    recommendedItems.push({
      sku,
      description: matched?.description ?? sku,
      recommendedQty,
      currentQty,
      delta: recommendedQty - currentQty,
      unitCost: matched?.unitCost ?? 0,
      usage90d,
    });
    recommendedStock.set(sku, recommendedQty);
    totalQty += recommendedQty;
    distinct += 1;
  }

  return {
    currentFillRate: fillRate(partsJobs, currentStock),
    projectedFillRate: fillRate(partsJobs, recommendedStock),
    capacityTotal,
    capacityDistinct,
    recommendedItems,
  };
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  techUserId: z.string().min(1).optional(),
});

const settingsSchema = z.object({
  techUserId: z.string().min(1),
  maxTotalQuantity: z.number().int().min(1).max(100000).optional(),
  maxDistinctSkus: z.number().int().min(1).max(10000).optional(),
});

const callbackSchema = z.object({
  techUserId: z.string().min(1).optional(),
  ticketId: z.string().min(1).optional(),
  missingPartSku: z.string().min(1).optional(),
  note: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerTruckStockRoutes(app: Express) {
  /**
   * POST /api/truck-stock/generate — run the optimizer.
   * body { techUserId? }. If given, just that tech; else all distinct
   * assignedTechnicianId with tickets in the last 90 days. Inserts a draft row
   * per tech. Cron-callable (Sunday night) — TODO(cron): wire the schedule.
   */
  app.post('/api/truck-stock/generate', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = generateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      let techIds: string[];
      if (parsed.data.techUserId) {
        techIds = [parsed.data.techUserId];
      } else {
        const since = new Date(Date.now() - NINETY_DAYS_MS);
        const rows = await db
          .selectDistinct({ techUserId: serviceTickets.assignedTechnicianId })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              sql`${serviceTickets.assignedTechnicianId} IS NOT NULL`,
              gte(serviceTickets.createdAt, since),
            ),
          );
        techIds = rows.map((r) => r.techUserId).filter((id): id is string => !!id);
      }

      let generated = 0;
      for (const techUserId of techIds) {
        const result = await runOptimizer(tenantId, techUserId);
        await db.insert(truckStockRecommendations).values({
          tenantId,
          techUserId,
          status: 'draft',
          currentFillRate: result.currentFillRate,
          projectedFillRate: result.projectedFillRate,
          capacityTotal: result.capacityTotal,
          capacityDistinct: result.capacityDistinct,
          recommendedItems: result.recommendedItems,
          generatedAt: new Date(),
        });
        generated++;
      }

      audit('GENERATE', { tenantId, userId, extra: { techs: techIds.length, generated } });
      res.json({ generated, techs: techIds.length });
    } catch (error: any) {
      log.error('Truck-stock generation failed:', error);
      res
        .status(500)
        .json({ message: 'Failed to generate recommendations', error: error?.message });
    }
  });

  /**
   * GET /api/truck-stock/recommendations — latest recommendation per tech.
   * Fetch + dedupe in JS (newest generatedAt wins per tech), tenant-scoped.
   */
  app.get('/api/truck-stock/recommendations', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const rows = await db
        .select()
        .from(truckStockRecommendations)
        .where(eq(truckStockRecommendations.tenantId, tenantId))
        .orderBy(desc(truckStockRecommendations.generatedAt))
        .limit(2000);

      const latest = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        if (!latest.has(r.techUserId)) latest.set(r.techUserId, r);
      }
      const deduped = Array.from(latest.values());

      const names = await resolveTechNames(
        tenantId,
        deduped.map((r) => r.techUserId),
      );
      const data = deduped.map((r) => ({
        ...r,
        techName: names.get(r.techUserId) ?? null,
        recommendedAdditions: Array.isArray(r.recommendedItems)
          ? (r.recommendedItems as RecommendedItem[]).filter((i) => i.delta > 0).length
          : 0,
      }));

      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list recommendations:', error);
      res.status(500).json({ message: 'Failed to list recommendations', error: error?.message });
    }
  });

  /** GET /api/truck-stock/inventory?techUserId= — a tech's current truck stock. */
  app.get('/api/truck-stock/inventory', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const techUserId =
        typeof req.query.techUserId === 'string' ? req.query.techUserId : undefined;
      if (!techUserId) return res.status(400).json({ message: 'techUserId is required' });

      const rows = await db
        .select()
        .from(truckInventory)
        .where(
          and(eq(truckInventory.tenantId, tenantId), eq(truckInventory.techUserId, techUserId)),
        )
        .orderBy(desc(truckInventory.quantityOnTruck));
      res.json({ data: rows, total: rows.length });
    } catch (error: any) {
      log.error('Failed to load truck inventory:', error);
      res.status(500).json({ message: 'Failed to load inventory', error: error?.message });
    }
  });

  /** GET /api/truck-stock/settings?techUserId= — getOrCreate per-tech capacity. */
  app.get('/api/truck-stock/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const techUserId =
        typeof req.query.techUserId === 'string' ? req.query.techUserId : undefined;
      if (!techUserId) return res.status(400).json({ message: 'techUserId is required' });
      res.json(await getOrCreateSettings(tenantId, techUserId));
    } catch (error: any) {
      log.error('Failed to load settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /** PUT /api/truck-stock/settings — update per-tech capacity. */
  app.put('/api/truck-stock/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const { techUserId, ...rest } = parsed.data;
      await getOrCreateSettings(tenantId, techUserId);

      const [updated] = await db
        .update(truckStockSettings)
        .set({ ...rest, updatedByUserId: userId, updatedAt: new Date() })
        .where(
          and(
            eq(truckStockSettings.tenantId, tenantId),
            eq(truckStockSettings.techUserId, techUserId),
          ),
        )
        .returning();

      audit('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.data });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /**
   * POST /api/truck-stock/callbacks — record a "had to come back for a part" event.
   * Feeds the model-accuracy stats endpoint.
   */
  app.post('/api/truck-stock/callbacks', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = callbackSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      // Best-effort unit cost from inventory_items for the missing SKU.
      let unitCost: string | null = null;
      if (parsed.data.missingPartSku) {
        const item = await db
          .select({ unitCost: inventoryItems.unitCost })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.tenantId, tenantId),
              sql`(${inventoryItems.partNumber} = ${parsed.data.missingPartSku} OR ${inventoryItems.name} = ${parsed.data.missingPartSku})`,
            ),
          )
          .limit(1);
        if (item[0]?.unitCost != null) unitCost = String(item[0].unitCost);
      }

      const [row] = await db
        .insert(truckStockCallbacks)
        .values({
          tenantId,
          techUserId: parsed.data.techUserId ?? null,
          ticketId: parsed.data.ticketId ?? null,
          missingPartSku: parsed.data.missingPartSku ?? null,
          note: parsed.data.note ?? null,
          unitCost,
          createdByUserId: userId,
        })
        .returning();

      audit('CALLBACK', { tenantId, userId, extra: { sku: parsed.data.missingPartSku } });
      res.status(201).json(row);
    } catch (error: any) {
      log.error('Failed to record callback:', error);
      res.status(500).json({ message: 'Failed to record callback', error: error?.message });
    }
  });

  /**
   * GET /api/truck-stock/stats — accuracy stats.
   * Total callbacks, callbacks-by-tech, and (from the latest rec per tech) the
   * average current vs projected fill rate.
   */
  app.get('/api/truck-stock/stats', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const callbacks = await db
        .select({ techUserId: truckStockCallbacks.techUserId })
        .from(truckStockCallbacks)
        .where(eq(truckStockCallbacks.tenantId, tenantId));

      const byTechMap = new Map<string, number>();
      for (const c of callbacks) {
        const key = c.techUserId ?? 'unassigned';
        byTechMap.set(key, (byTechMap.get(key) ?? 0) + 1);
      }

      const recs = await db
        .select({
          techUserId: truckStockRecommendations.techUserId,
          generatedAt: truckStockRecommendations.generatedAt,
          currentFillRate: truckStockRecommendations.currentFillRate,
          projectedFillRate: truckStockRecommendations.projectedFillRate,
        })
        .from(truckStockRecommendations)
        .where(eq(truckStockRecommendations.tenantId, tenantId))
        .orderBy(desc(truckStockRecommendations.generatedAt))
        .limit(2000);

      const latestByTech = new Map<string, (typeof recs)[number]>();
      for (const r of recs) {
        if (!latestByTech.has(r.techUserId)) latestByTech.set(r.techUserId, r);
      }
      const latest = Array.from(latestByTech.values());

      const names = await resolveTechNames(tenantId, [
        ...Array.from(byTechMap.keys()).filter((k) => k !== 'unassigned'),
        ...latest.map((r) => r.techUserId),
      ]);

      const avgCurrent =
        latest.length > 0
          ? Math.round(
              (latest.reduce((a, r) => a + num(r.currentFillRate), 0) / latest.length) * 10,
            ) / 10
          : null;
      const avgProjected =
        latest.length > 0
          ? Math.round(
              (latest.reduce((a, r) => a + num(r.projectedFillRate), 0) / latest.length) * 10,
            ) / 10
          : null;

      res.json({
        totalCallbacks: callbacks.length,
        callbacksByTech: Array.from(byTechMap.entries()).map(([techUserId, count]) => ({
          techUserId,
          techName: names.get(techUserId) ?? null,
          count,
        })),
        recommendationCount: latest.length,
        avgCurrentFillRate: avgCurrent,
        avgProjectedFillRate: avgProjected,
        fillRateLift:
          avgCurrent != null && avgProjected != null
            ? Math.round((avgProjected - avgCurrent) * 10) / 10
            : null,
      });
    } catch (error: any) {
      log.error('Failed to load truck-stock stats:', error);
      res.status(500).json({ message: 'Failed to load stats', error: error?.message });
    }
  });

  /** GET /api/truck-stock/recommendations/:id/export.csv — restock pick list. */
  app.get(
    '/api/truck-stock/recommendations/:id/export.csv',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const rec = await db.query.truckStockRecommendations.findFirst({
          where: and(
            eq(truckStockRecommendations.id, req.params.id),
            eq(truckStockRecommendations.tenantId, tenantId),
          ),
        });
        if (!rec) return res.status(404).json({ message: 'Recommendation not found' });

        const esc = (v: unknown) => {
          const s = v == null ? '' : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = [
          'SKU',
          'Description',
          'Current Qty',
          'Recommended Qty',
          'Delta',
          'Unit Cost',
        ];
        const items = Array.isArray(rec.recommendedItems)
          ? (rec.recommendedItems as RecommendedItem[])
          : [];
        const lines = [header.join(',')];
        for (const it of items) {
          lines.push(
            [
              esc(it.sku),
              esc(it.description),
              it.currentQty,
              it.recommendedQty,
              it.delta,
              num(it.unitCost).toFixed(2),
            ].join(','),
          );
        }

        audit('EXPORT_CSV', { tenantId, userId, extra: { id: req.params.id, rows: items.length } });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="truck-stock-${req.params.id}.csv"`,
        );
        res.send(lines.join('\n'));
      } catch (error: any) {
        log.error('Failed to export pick list:', error);
        res.status(500).json({ message: 'Failed to export pick list', error: error?.message });
      }
    },
  );

  /** GET /api/truck-stock/recommendations/:id — single recommendation + techName. */
  app.get(
    '/api/truck-stock/recommendations/:id',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const row = await db.query.truckStockRecommendations.findFirst({
          where: and(
            eq(truckStockRecommendations.id, req.params.id),
            eq(truckStockRecommendations.tenantId, tenantId),
          ),
        });
        if (!row) return res.status(404).json({ message: 'Recommendation not found' });

        const names = await resolveTechNames(tenantId, [row.techUserId]);
        res.json({ ...row, techName: names.get(row.techUserId) ?? null });
      } catch (error: any) {
        log.error('Failed to load recommendation:', error);
        res.status(500).json({ message: 'Failed to load recommendation', error: error?.message });
      }
    },
  );

  /** POST /api/truck-stock/recommendations/:id/pick — warehouse started the pick. */
  app.post(
    '/api/truck-stock/recommendations/:id/pick',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const [row] = await db
          .update(truckStockRecommendations)
          .set({ status: 'picking', pickedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(truckStockRecommendations.id, req.params.id),
              eq(truckStockRecommendations.tenantId, tenantId),
            ),
          )
          .returning();
        if (!row) return res.status(404).json({ message: 'Recommendation not found' });

        audit('PICK', { tenantId, userId, extra: { id: req.params.id } });
        res.json(row);
      } catch (error: any) {
        log.error('Failed to mark picking:', error);
        res.status(500).json({ message: 'Failed to mark picking', error: error?.message });
      }
    },
  );

  /**
   * POST /api/truck-stock/recommendations/:id/receive
   * Tech confirms receipt: status -> received, and APPLY recommendedItems to
   * truck_inventory (upsert quantityOnTruck = recommendedQty per SKU).
   */
  app.post(
    '/api/truck-stock/recommendations/:id/receive',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const rec = await db.query.truckStockRecommendations.findFirst({
          where: and(
            eq(truckStockRecommendations.id, req.params.id),
            eq(truckStockRecommendations.tenantId, tenantId),
          ),
        });
        if (!rec) return res.status(404).json({ message: 'Recommendation not found' });

        const items = Array.isArray(rec.recommendedItems)
          ? (rec.recommendedItems as RecommendedItem[])
          : [];
        const now = new Date();
        for (const it of items) {
          await db
            .insert(truckInventory)
            .values({
              tenantId,
              techUserId: rec.techUserId,
              partSku: it.sku,
              quantityOnTruck: it.recommendedQty,
              lastAuditedAt: now,
            })
            .onConflictDoUpdate({
              target: [truckInventory.tenantId, truckInventory.techUserId, truckInventory.partSku],
              set: {
                quantityOnTruck: it.recommendedQty,
                lastAuditedAt: now,
                updatedAt: now,
              },
            });
        }

        const [row] = await db
          .update(truckStockRecommendations)
          .set({ status: 'received', receivedAt: now, updatedAt: now })
          .where(
            and(
              eq(truckStockRecommendations.id, req.params.id),
              eq(truckStockRecommendations.tenantId, tenantId),
            ),
          )
          .returning();

        audit('RECEIVE', {
          tenantId,
          userId,
          extra: { id: req.params.id, applied: items.length },
        });
        res.json({ ...row, applied: items.length });
      } catch (error: any) {
        log.error('Failed to mark received:', error);
        res.status(500).json({ message: 'Failed to mark received', error: error?.message });
      }
    },
  );

  void TRUCK_STOCK_STATUSES;
  void inArray;
}
