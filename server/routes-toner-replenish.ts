/**
 * Multi-Vendor Toner Auto-Replenish Routes (US-SUPER-012).
 *
 * Toner ships before a machine runs out, across every vendor (Canon, Konica,
 * Ricoh, Xerox). A daily pipeline (capture → evaluate) reads each machine's
 * toner levels, runs a linear regression over the last 14 days of readings to
 * predict the depletion date, and — when depletion lands inside the lead-time +
 * safety-buffer window — creates a replenishment order. Orders auto-ship when
 * under the cost ceiling, else they go to pending_approval. Ops can ship/cancel
 * orders, fire an emergency ship-now per machine, and tune per-tenant +
 * per-machine settings (auto-ship toggle, cost ceiling, customer-managed
 * suppression, emergency override).
 *
 * Endpoints:
 *   POST /api/toner-replenish/capture                       — read levels (cron-callable). body { machineId? }
 *   POST /api/toner-replenish/evaluate                      — regress + create orders (cron-callable)
 *   POST /api/toner-replenish/run                           — capture then evaluate (convenience)
 *   GET  /api/toner-replenish/levels?machineId=             — latest level per machine/color
 *   GET  /api/toner-replenish/orders?status=                — orders list (newest first)
 *   POST /api/toner-replenish/orders/:id/ship              — approve & ship
 *   POST /api/toner-replenish/orders/:id/cancel            — cancel
 *   POST /api/toner-replenish/machines/:machineId/ship-now — emergency manual order + ship
 *   GET  /api/toner-replenish/settings                     — tenant settings getOrCreate
 *   PUT  /api/toner-replenish/settings                     — update tenant settings
 *   GET  /api/toner-replenish/machines/:machineId/settings — per-machine getOrCreate
 *   PUT  /api/toner-replenish/machines/:machineId/settings — update per-machine settings
 *
 * Schema: shared/toner-replenish-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + tenant scoping on every query.
 *
 * Documented proxies / STUBs:
 *   - fetchVendorSupplyLevels() returns INJECTED synthetic readings (source='injected').
 *     TODO(ABK): wire real multi-vendor reads via the address-book adapters.
 *   - Per-color toner unit cost is a FIXED proxy (TONER_UNIT_COST) until a real
 *     catalog/vendor price lookup exists.
 *   - trackingNumber is a STUB (`TRK-${Date.now()}`); carrier hardcoded 'UPS'.
 *   - TODO(cron): wire the daily capture+evaluate run.
 *   - TODO(rbac): requirePermission(['service.supply.manage']) once it exists.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { sendEmail } from './services/email-service';
import {
  machineSupplyLevels,
  supplyOrders,
  tenantSupplySettings,
  machineSupplySettings,
  SUPPLY_COLORS,
  SUPPLY_ORDER_STATUSES,
  equipment,
  businessRecords,
  type SupplyColor,
} from '@shared/schema';

const log = createModuleLogger('routes-toner-replenish');

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

/** Proxy per-color toner unit cost ($). TODO: replace with a real price lookup. */
const TONER_UNIT_COST: Record<SupplyColor, number> = { k: 85, c: 110, m: 110, y: 110 };

const COLOR_NAMES: Record<SupplyColor, string> = {
  k: 'Black',
  c: 'Cyan',
  m: 'Magenta',
  y: 'Yellow',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function audit(
  action:
    | 'CAPTURE'
    | 'EVALUATE'
    | 'RUN'
    | 'SHIP'
    | 'CANCEL'
    | 'EMERGENCY_SHIP'
    | 'UPDATE_SETTINGS'
    | 'UPDATE_MACHINE_SETTINGS',
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
    '[AUDIT] toner-replenish',
  );
}

async function getOrCreateTenantSettings(tenantId: string) {
  const existing = await db.query.tenantSupplySettings.findFirst({
    where: eq(tenantSupplySettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(tenantSupplySettings)
    .values({ tenantId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.tenantSupplySettings.findFirst({
    where: eq(tenantSupplySettings.tenantId, tenantId),
  });
}

async function getOrCreateMachineSettings(tenantId: string, machineId: string) {
  const existing = await db.query.machineSupplySettings.findFirst({
    where: and(
      eq(machineSupplySettings.tenantId, tenantId),
      eq(machineSupplySettings.machineId, machineId),
    ),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(machineSupplySettings)
    .values({ tenantId, machineId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.machineSupplySettings.findFirst({
    where: and(
      eq(machineSupplySettings.tenantId, tenantId),
      eq(machineSupplySettings.machineId, machineId),
    ),
  });
}

type MachineRow = {
  id: string;
  serialNumber: string | null;
  modelNumber: string | null;
  manufacturer: string | null;
  customerId: string;
  isColorCapable: boolean | null;
};

/**
 * Vendor supply-level adapter STUB.
 *
 * TODO(ABK): wire real multi-vendor reads via the address-book adapters
 * (shared/address-book-schema.ts, ABK-001) with credentials decrypted from the
 * credential vault (server/services/address-book/credential-vault.ts). For now
 * this returns injected readings so the pipeline is exercisable offline.
 * source='injected'.
 *
 * Returns deterministic synthetic readings derived from the machine id plus a
 * downward drift keyed to the current day, so the regression has signal.
 */
async function fetchVendorSupplyLevels(
  machine: MachineRow,
): Promise<Array<{ color: SupplyColor; percentRemaining: number; pageCountRemaining: number }>> {
  const colors: SupplyColor[] = machine.isColorCapable ? ['k', 'c', 'm', 'y'] : ['k'];

  // Deterministic seed from the machine id.
  let seed = 0;
  for (let i = 0; i < machine.id.length; i++) {
    seed = (seed * 31 + machine.id.charCodeAt(i)) % 100000;
  }

  // Downward drift over time so repeated captures trend toward depletion.
  const dayIndex = Math.floor(Date.now() / 86_400_000);

  return colors.map((color, idx) => {
    const channelSeed = (seed + idx * 7919) % 1000;
    // Each color drains at a slightly different daily rate (0.8%–2.3%/day).
    const dailyRate = 0.8 + (channelSeed % 16) / 10;
    // A per-channel starting offset so colors aren't identical.
    const startOffset = channelSeed % 40;
    const raw = 100 - startOffset - (dayIndex % 60) * dailyRate;
    const percentRemaining = Math.max(2, Math.min(100, Math.round(raw * 10) / 10));
    // Page-life proxy: ~120 pages per percent.
    const pageCountRemaining = Math.round(percentRemaining * 120);
    return { color, percentRemaining, pageCountRemaining };
  });
}

interface Reading {
  capturedAt: Date;
  percentRemaining: number;
}

/**
 * Least-squares linear regression of percent vs daysAgo. Returns the daily drop
 * (positive = depleting) and the predicted depletion date from the latest
 * reading. Returns null when there isn't enough signal (<2 points or no drop).
 */
function predictDepletion(readings: Reading[], now: number): Date | null {
  if (readings.length < 2) return null;
  // x = days ago (>=0, older = larger); y = percent.
  const pts = readings.map((r) => ({
    x: (now - r.capturedAt.getTime()) / 86_400_000,
    y: r.percentRemaining,
  }));
  const n = pts.length;
  const sumX = pts.reduce((a, p) => a + p.x, 0);
  const sumY = pts.reduce((a, p) => a + p.y, 0);
  const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = pts.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  // slope of percent w.r.t. daysAgo. As daysAgo increases (older), percent was
  // higher, so slope is positive when depleting; dailyDrop = slope.
  const slope = (n * sumXY - sumX * sumY) / denom;
  const dailyDrop = slope;
  if (dailyDrop <= 0) return null; // flat or refilling

  // Current percent = most-recent reading (smallest x).
  const current = pts.reduce((min, p) => (p.x < min.x ? p : min), pts[0]).y;
  if (current <= 0) return new Date(now);
  const daysToDeplete = current / dailyDrop;
  if (!Number.isFinite(daysToDeplete)) return null;
  return new Date(now + daysToDeplete * 86_400_000);
}

/** Run capture for a tenant (optionally a single machine). Returns counts. */
async function runCapture(tenantId: string, machineId?: string) {
  const conditions = [eq(equipment.tenantId, tenantId)];
  if (machineId) conditions.push(eq(equipment.id, machineId));
  const machines = await db
    .select({
      id: equipment.id,
      serialNumber: equipment.serialNumber,
      modelNumber: equipment.modelNumber,
      manufacturer: equipment.manufacturer,
      customerId: equipment.customerId,
      isColorCapable: equipment.isColorCapable,
    })
    .from(equipment)
    .where(and(...conditions));

  let readings = 0;
  for (const m of machines) {
    const levels = await fetchVendorSupplyLevels(m);
    for (const lvl of levels) {
      await db.insert(machineSupplyLevels).values({
        tenantId,
        machineId: m.id,
        color: lvl.color,
        percentRemaining: lvl.percentRemaining,
        pageCountRemaining: lvl.pageCountRemaining,
        source: 'injected',
        capturedAt: new Date(),
      });
      readings++;
    }
  }
  return { machines: machines.length, readings };
}

/** Run evaluate for a tenant. Returns counts of evaluated machine/colors + created orders. */
async function runEvaluate(tenantId: string, userId: string | undefined) {
  const tenant = await getOrCreateTenantSettings(tenantId);
  const approvalThreshold = num(tenant?.approvalCostThreshold ?? 150);
  const defaultLead = tenant?.defaultLeadTimeDays ?? 5;
  const defaultBuffer = tenant?.defaultSafetyBufferDays ?? 3;

  const now = Date.now();
  const since = new Date(now - FOURTEEN_DAYS_MS);

  // All readings in the last 14 days, newest first.
  const recent = await db
    .select({
      machineId: machineSupplyLevels.machineId,
      color: machineSupplyLevels.color,
      percentRemaining: machineSupplyLevels.percentRemaining,
      capturedAt: machineSupplyLevels.capturedAt,
    })
    .from(machineSupplyLevels)
    .where(
      and(eq(machineSupplyLevels.tenantId, tenantId), gte(machineSupplyLevels.capturedAt, since)),
    )
    .orderBy(desc(machineSupplyLevels.capturedAt));

  // Group readings by machine+color.
  const byKey = new Map<string, Reading[]>();
  for (const r of recent) {
    const key = `${r.machineId}::${r.color}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push({
      capturedAt: r.capturedAt instanceof Date ? r.capturedAt : new Date(r.capturedAt as any),
      percentRemaining: num(r.percentRemaining),
    });
  }

  // Existing OPEN orders (no duplicates per machine+color).
  const openOrders = await db
    .select({ machineId: supplyOrders.machineId, color: supplyOrders.color })
    .from(supplyOrders)
    .where(
      and(
        eq(supplyOrders.tenantId, tenantId),
        inArray(supplyOrders.status, ['pending_approval', 'auto_ship']),
      ),
    );
  const openSet = new Set(openOrders.map((o) => `${o.machineId}::${o.color ?? ''}`));

  // Per-machine settings cache.
  const machineSettingsCache = new Map<
    string,
    Awaited<ReturnType<typeof getOrCreateMachineSettings>>
  >();

  let evaluated = 0;
  let created = 0;

  for (const [key, readings] of Array.from(byKey.entries())) {
    evaluated++;
    const [machineId, color] = key.split('::');

    let settings = machineSettingsCache.get(machineId);
    if (settings === undefined) {
      settings = await getOrCreateMachineSettings(tenantId, machineId);
      machineSettingsCache.set(machineId, settings);
    }
    if (!settings) continue;

    // Suppression: customer-managed machines opt out (unless emergency override).
    if (settings.customerManaged && !settings.emergencyOverride) continue;
    if (!settings.autoShipEnabled) continue;

    const predicted = predictDepletion(readings, now);
    if (!predicted) continue;

    const lead = settings.leadTimeDays ?? defaultLead;
    const buffer = settings.safetyBufferDays ?? defaultBuffer;
    const triggerCutoff = now + (lead + buffer) * 86_400_000;
    if (predicted.getTime() >= triggerCutoff) continue; // not yet within the window

    if (openSet.has(`${machineId}::${color}`)) continue; // already have an open order

    const colorKey = (color as SupplyColor) in TONER_UNIT_COST ? (color as SupplyColor) : 'k';
    const unitCost = TONER_UNIT_COST[colorKey];
    const quantity = 1;
    const totalCost = unitCost * quantity;

    // Cost gate: above min(tenant threshold, machine ceiling) → needs approval.
    const ceiling =
      settings.costCeiling != null ? num(settings.costCeiling) : Number.POSITIVE_INFINITY;
    const gate = Math.min(approvalThreshold, ceiling);
    const status: 'pending_approval' | 'auto_ship' =
      totalCost > gate ? 'pending_approval' : 'auto_ship';

    await db.insert(supplyOrders).values({
      tenantId,
      machineId,
      color,
      status,
      vendor: null,
      partNumber: null,
      supplyName: `${COLOR_NAMES[colorKey]} toner`,
      quantity,
      unitCost: unitCost.toFixed(2),
      totalCost: totalCost.toFixed(2),
      predictedDepletionDate: predicted,
      triggerReason: `Predicted depletion ${predicted.toISOString().slice(0, 10)} within ${lead + buffer}-day lead+buffer window.`,
      isEmergency: false,
      createdByUserId: userId ?? null,
    });
    openSet.add(`${machineId}::${color}`);
    created++;
  }

  audit('EVALUATE', { tenantId, userId, extra: { evaluated, created } });
  return { evaluated, created };
}

/** Best-effort customer-notification email for a shipped order. */
async function notifyCustomerShipped(
  tenantId: string,
  machineId: string,
  order: {
    color: string | null;
    supplyName: string | null;
    trackingNumber: string | null;
    expectedArrivalDate: Date | null;
  },
) {
  try {
    const machine = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, machineId), eq(equipment.tenantId, tenantId)),
      columns: { customerId: true, serialNumber: true, modelNumber: true },
    });
    if (!machine) return;
    const customer = await db.query.businessRecords.findFirst({
      where: and(
        eq(businessRecords.id, machine.customerId),
        eq(businessRecords.tenantId, tenantId),
      ),
      columns: { primaryContactEmail: true, companyName: true },
    });
    const to = (customer as any)?.primaryContactEmail;
    if (!to) return;
    const eta = order.expectedArrivalDate
      ? new Date(order.expectedArrivalDate).toLocaleDateString()
      : 'soon';
    await sendEmail({
      to,
      subject: `Toner shipment on the way for ${machine.serialNumber ?? machine.modelNumber ?? 'your device'}`,
      html: `<p>Hi ${(customer as any)?.companyName ?? 'there'},</p><p>A ${order.supplyName ?? 'toner'} cartridge is shipping to you (tracking ${order.trackingNumber ?? 'pending'}). Expected arrival: ${eta}.</p>`,
      text: `A ${order.supplyName ?? 'toner'} cartridge is shipping to you (tracking ${order.trackingNumber ?? 'pending'}). Expected arrival: ${eta}.`,
    });
    // TODO: SMS via Twilio + calendar event for expected arrival.
  } catch (err) {
    log.warn('Customer ship notification failed (best-effort):', err as any);
  }
}

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const captureSchema = z.object({
  machineId: z.string().min(1).optional(),
});

const tenantSettingsSchema = z.object({
  approvalCostThreshold: z.number().min(0).max(1_000_000).optional(),
  defaultLeadTimeDays: z.number().int().min(0).max(365).optional(),
  defaultSafetyBufferDays: z.number().int().min(0).max(365).optional(),
});

const machineSettingsSchema = z.object({
  autoShipEnabled: z.boolean().optional(),
  costCeiling: z.number().min(0).max(1_000_000).nullable().optional(),
  emergencyOverride: z.boolean().optional(),
  customerManaged: z.boolean().optional(),
  leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
  safetyBufferDays: z.number().int().min(0).max(365).nullable().optional(),
});

const shipNowSchema = z.object({
  color: z.enum(SUPPLY_COLORS).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerTonerReplenishRoutes(app: Express) {
  /** POST /api/toner-replenish/capture — read levels (cron-callable). body { machineId? }. */
  app.post('/api/toner-replenish/capture', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = captureSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const result = await runCapture(tenantId, parsed.data.machineId);
      audit('CAPTURE', { tenantId, userId, extra: result });
      res.json(result);
    } catch (error: any) {
      log.error('Capture failed:', error);
      res.status(500).json({ message: 'Failed to capture supply levels', error: error?.message });
    }
  });

  /** POST /api/toner-replenish/evaluate — regress + create orders (cron-callable). */
  app.post('/api/toner-replenish/evaluate', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const result = await runEvaluate(tenantId, userId);
      res.json(result);
    } catch (error: any) {
      log.error('Evaluate failed:', error);
      res.status(500).json({ message: 'Failed to evaluate supply levels', error: error?.message });
    }
  });

  /** POST /api/toner-replenish/run — capture then evaluate (convenience). */
  app.post('/api/toner-replenish/run', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const capture = await runCapture(tenantId);
      const evaluate = await runEvaluate(tenantId, userId);
      audit('RUN', { tenantId, userId, extra: { capture, evaluate } });
      res.json({ capture, evaluate });
    } catch (error: any) {
      log.error('Run failed:', error);
      res.status(500).json({ message: 'Failed to run replenish pipeline', error: error?.message });
    }
  });

  /**
   * GET /api/toner-replenish/levels?machineId=
   * Latest level per machine+color (DISTINCT ON), each with its predicted
   * depletion date (read from the latest open order if any) + machine serial/
   * model + customer name.
   */
  app.get('/api/toner-replenish/levels', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const machineId = typeof req.query.machineId === 'string' ? req.query.machineId : undefined;

      const latest = await db.execute(sql`
        SELECT DISTINCT ON (l.machine_id, l.color)
          l.id, l.machine_id, l.color, l.percent_remaining, l.page_count_remaining,
          l.source, l.captured_at,
          e.serial_number, e.model_number, e.manufacturer, e.is_color_capable, e.customer_id,
          b.company_name
        FROM machine_supply_levels l
        LEFT JOIN equipment e ON e.id = l.machine_id AND e.tenant_id = ${tenantId}
        LEFT JOIN business_records b ON b.id = e.customer_id AND b.tenant_id = ${tenantId}
        WHERE l.tenant_id = ${tenantId}
        ${machineId ? sql`AND l.machine_id = ${machineId}` : sql``}
        ORDER BY l.machine_id, l.color, l.captured_at DESC
      `);
      const rows = (latest as any).rows ?? (latest as any) ?? [];

      // Predicted depletion from the latest open order per machine+color.
      const orders = await db
        .select({
          machineId: supplyOrders.machineId,
          color: supplyOrders.color,
          predictedDepletionDate: supplyOrders.predictedDepletionDate,
        })
        .from(supplyOrders)
        .where(
          and(
            eq(supplyOrders.tenantId, tenantId),
            inArray(supplyOrders.status, ['pending_approval', 'auto_ship', 'shipped']),
          ),
        )
        .orderBy(desc(supplyOrders.createdAt));
      const predictedMap = new Map<string, Date | null>();
      for (const o of orders) {
        const k = `${o.machineId}::${o.color ?? ''}`;
        if (!predictedMap.has(k)) predictedMap.set(k, o.predictedDepletionDate ?? null);
      }

      const data = rows.map((r: any) => ({
        id: r.id,
        machineId: r.machine_id,
        color: r.color,
        percentRemaining: r.percent_remaining == null ? null : Number(r.percent_remaining),
        pageCountRemaining: r.page_count_remaining == null ? null : Number(r.page_count_remaining),
        source: r.source,
        capturedAt: r.captured_at,
        serialNumber: r.serial_number ?? null,
        modelNumber: r.model_number ?? null,
        manufacturer: r.manufacturer ?? null,
        isColorCapable: r.is_color_capable ?? false,
        customerId: r.customer_id ?? null,
        companyName: r.company_name ?? null,
        predictedDepletionDate: predictedMap.get(`${r.machine_id}::${r.color}`) ?? null,
      }));

      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to load levels:', error);
      res.status(500).json({ message: 'Failed to load levels', error: error?.message });
    }
  });

  /** GET /api/toner-replenish/orders?status= — orders list, newest first. */
  app.get('/api/toner-replenish/orders', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const conditions = [eq(supplyOrders.tenantId, tenantId)];
      if (status && status !== 'all') conditions.push(eq(supplyOrders.status, status));

      const rows = await db
        .select()
        .from(supplyOrders)
        .where(and(...conditions))
        .orderBy(desc(supplyOrders.createdAt))
        .limit(500);

      // Attach machine serial.
      const machineIds = Array.from(new Set(rows.map((r) => r.machineId)));
      const machines = machineIds.length
        ? await db
            .select({
              id: equipment.id,
              serialNumber: equipment.serialNumber,
              modelNumber: equipment.modelNumber,
            })
            .from(equipment)
            .where(and(eq(equipment.tenantId, tenantId), inArray(equipment.id, machineIds)))
        : [];
      const machineMap = new Map(machines.map((m) => [m.id, m]));

      const data = rows.map((r) => ({
        ...r,
        serialNumber: machineMap.get(r.machineId)?.serialNumber ?? null,
        modelNumber: machineMap.get(r.machineId)?.modelNumber ?? null,
      }));

      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list orders:', error);
      res.status(500).json({ message: 'Failed to list orders', error: error?.message });
    }
  });

  /**
   * POST /api/toner-replenish/orders/:id/ship — approve & ship.
   * Sets status 'shipped', a STUB tracking number, carrier UPS, shippedAt,
   * expectedArrivalDate (now + lead time), customerNotified true; best-effort
   * customer email.
   */
  app.post(
    '/api/toner-replenish/orders/:id/ship',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const order = await db.query.supplyOrders.findFirst({
          where: and(eq(supplyOrders.id, req.params.id), eq(supplyOrders.tenantId, tenantId)),
        });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const tenant = await getOrCreateTenantSettings(tenantId);
        const machineSettings = await getOrCreateMachineSettings(tenantId, order.machineId);
        const lead = machineSettings?.leadTimeDays ?? tenant?.defaultLeadTimeDays ?? 5;
        const now = new Date();
        const expectedArrivalDate = new Date(now.getTime() + lead * 86_400_000);
        const trackingNumber = `TRK-${Date.now()}`; // STUB

        const [row] = await db
          .update(supplyOrders)
          .set({
            status: 'shipped',
            trackingNumber,
            carrier: 'UPS',
            shippedAt: now,
            expectedArrivalDate,
            customerNotified: true,
            updatedAt: now,
          })
          .where(and(eq(supplyOrders.id, req.params.id), eq(supplyOrders.tenantId, tenantId)))
          .returning();

        await notifyCustomerShipped(tenantId, order.machineId, {
          color: order.color,
          supplyName: order.supplyName,
          trackingNumber,
          expectedArrivalDate,
        });

        audit('SHIP', { tenantId, userId, extra: { id: req.params.id, trackingNumber } });
        res.json(row);
      } catch (error: any) {
        log.error('Failed to ship order:', error);
        res.status(500).json({ message: 'Failed to ship order', error: error?.message });
      }
    },
  );

  /** POST /api/toner-replenish/orders/:id/cancel — cancel an order. */
  app.post(
    '/api/toner-replenish/orders/:id/cancel',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const [row] = await db
          .update(supplyOrders)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(and(eq(supplyOrders.id, req.params.id), eq(supplyOrders.tenantId, tenantId)))
          .returning();
        if (!row) return res.status(404).json({ message: 'Order not found' });

        audit('CANCEL', { tenantId, userId, extra: { id: req.params.id } });
        res.json(row);
      } catch (error: any) {
        log.error('Failed to cancel order:', error);
        res.status(500).json({ message: 'Failed to cancel order', error: error?.message });
      }
    },
  );

  /** GET /api/toner-replenish/settings — tenant settings getOrCreate. */
  app.get('/api/toner-replenish/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      res.json(await getOrCreateTenantSettings(tenantId));
    } catch (error: any) {
      log.error('Failed to load settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /** PUT /api/toner-replenish/settings — update tenant settings. */
  app.put('/api/toner-replenish/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = tenantSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      await getOrCreateTenantSettings(tenantId);

      const [updated] = await db
        .update(tenantSupplySettings)
        .set({ ...parsed.data, updatedByUserId: userId, updatedAt: new Date() })
        .where(eq(tenantSupplySettings.tenantId, tenantId))
        .returning();

      audit('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.data });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /**
   * POST /api/toner-replenish/machines/:machineId/ship-now — EMERGENCY manual order.
   * Creates an isEmergency auto_ship order then immediately ships it. body { color? }.
   */
  app.post(
    '/api/toner-replenish/machines/:machineId/ship-now',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = shipNowSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }
        const machineId = req.params.machineId;

        const machine = await db.query.equipment.findFirst({
          where: and(eq(equipment.id, machineId), eq(equipment.tenantId, tenantId)),
          columns: { id: true, isColorCapable: true },
        });
        if (!machine) return res.status(404).json({ message: 'Machine not found' });

        const colorKey: SupplyColor = parsed.data.color ?? 'k';
        const unitCost = TONER_UNIT_COST[colorKey];
        const quantity = 1;
        const totalCost = unitCost * quantity;
        const now = new Date();

        const tenant = await getOrCreateTenantSettings(tenantId);
        const machineSettings = await getOrCreateMachineSettings(tenantId, machineId);
        const lead = machineSettings?.leadTimeDays ?? tenant?.defaultLeadTimeDays ?? 5;
        const expectedArrivalDate = new Date(now.getTime() + lead * 86_400_000);
        const trackingNumber = `TRK-${Date.now()}`; // STUB

        const [row] = await db
          .insert(supplyOrders)
          .values({
            tenantId,
            machineId,
            color: colorKey,
            status: 'shipped',
            supplyName: `${COLOR_NAMES[colorKey]} toner`,
            quantity,
            unitCost: unitCost.toFixed(2),
            totalCost: totalCost.toFixed(2),
            triggerReason: 'Emergency manual ship-now.',
            isEmergency: true,
            trackingNumber,
            carrier: 'UPS',
            shippedAt: now,
            expectedArrivalDate,
            customerNotified: true,
            createdByUserId: userId ?? null,
          })
          .returning();

        await notifyCustomerShipped(tenantId, machineId, {
          color: colorKey,
          supplyName: row?.supplyName ?? null,
          trackingNumber,
          expectedArrivalDate,
        });

        audit('EMERGENCY_SHIP', { tenantId, userId, extra: { machineId, color: colorKey } });
        res.status(201).json(row);
      } catch (error: any) {
        log.error('Failed emergency ship:', error);
        res.status(500).json({ message: 'Failed to ship emergency order', error: error?.message });
      }
    },
  );

  /** GET /api/toner-replenish/machines/:machineId/settings — per-machine getOrCreate. */
  app.get(
    '/api/toner-replenish/machines/:machineId/settings',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        res.json(await getOrCreateMachineSettings(tenantId, req.params.machineId));
      } catch (error: any) {
        log.error('Failed to load machine settings:', error);
        res.status(500).json({ message: 'Failed to load machine settings', error: error?.message });
      }
    },
  );

  /**
   * PUT /api/toner-replenish/machines/:machineId/settings — update per-machine.
   * customerManaged=true is the suppression opt-out. Upsert on tenant+machine.
   */
  app.put(
    '/api/toner-replenish/machines/:machineId/settings',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = machineSettingsSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }
        const machineId = req.params.machineId;
        const now = new Date();

        const [row] = await db
          .insert(machineSupplySettings)
          .values({
            tenantId,
            machineId,
            ...parsed.data,
            updatedByUserId: userId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [machineSupplySettings.tenantId, machineSupplySettings.machineId],
            set: { ...parsed.data, updatedByUserId: userId, updatedAt: now },
          })
          .returning();

        audit('UPDATE_MACHINE_SETTINGS', {
          tenantId,
          userId,
          extra: { machineId, ...parsed.data },
        });
        res.json(row);
      } catch (error: any) {
        log.error('Failed to update machine settings:', error);
        res
          .status(500)
          .json({ message: 'Failed to update machine settings', error: error?.message });
      }
    },
  );

  void SUPPLY_ORDER_STATUSES;
}
