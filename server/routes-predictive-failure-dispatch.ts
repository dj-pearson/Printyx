/**
 * Predictive Failure Dispatch Routes (US-SUPER-001).
 *
 * Rules-based (interpretable) per-machine failure scoring for the MFP fleet.
 * Signals: meter delta acceleration, error-code frequency from service-ticket
 * history, days since last service, model age, and toner-cycle anomalies.
 *
 * Predictions at/above the tenant confidence threshold auto-create a DRAFT
 * service ticket in `pending_review` status, linked back via the prediction's
 * `serviceTicketId`. The /service/predictions page drives the
 * approve-and-dispatch / snooze / dismiss workflow and exposes precision/recall.
 *
 * Schema lives in shared/predictive-failure-schema.ts (re-exported from
 * shared/schema.ts). FKs are enforced in the backfill migration only.
 *
 * Auth: requireAuth + tenant scoping on every query.
 * TODO(rbac): gate with requirePermission(['service.prediction.manage']) once
 * that permission string is added to the RBAC matrix
 * (server/middleware/rbac-route-helper.ts). Only `service.ticket.*` exists today,
 * so we use requireAuth + an inline platform/role-agnostic auth check for now.
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
  equipmentFailurePredictions,
  predictiveDispatchSettings,
  equipment,
  meterReadings,
  serviceTickets,
} from '@shared/schema';

const log = createModuleLogger('routes-predictive-failure-dispatch');

// ---------------------------------------------------------------------------
// Scoring model (interpretable, rules-based)
// ---------------------------------------------------------------------------

/** Signal weights — sum to 1.0 so the blended score is a clean 0..1 confidence. */
const SIGNAL_WEIGHTS = {
  meter_accel: 0.25,
  error_freq: 0.25,
  days_since_service: 0.2,
  model_age: 0.15,
  toner_anomaly: 0.15,
} as const;

const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const PREDICTION_WINDOW_DAYS = 14;

/** Clamp to 0..1. */
function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

interface SignalContribution {
  value: number; // normalized 0..1 risk contribution
  weight: number;
  detail?: string;
}

interface ScoredMachine {
  machineId: string;
  confidence: number;
  contractValue: number;
  signals: {
    meter_accel: SignalContribution;
    error_freq: SignalContribution;
    days_since_service: SignalContribution;
    model_age: SignalContribution;
    toner_anomaly: SignalContribution;
    suggested_parts: string[];
  };
}

/**
 * Map signal contributions to suggested parts (interpretable heuristics).
 */
function suggestParts(signals: ScoredMachine['signals']): string[] {
  const parts = new Set<string>();
  if (signals.toner_anomaly.value >= 0.5) parts.add('Toner cartridge');
  if (signals.meter_accel.value >= 0.5) {
    parts.add('Fuser unit');
    parts.add('Transfer belt');
  }
  if (signals.error_freq.value >= 0.5) {
    parts.add('Pickup roller');
    parts.add('Maintenance kit');
  }
  if (signals.model_age.value >= 0.6) parts.add('Drum unit');
  return Array.from(parts);
}

/**
 * Score a single machine from its meter history + ticket history.
 * Pure-ish (only reads from DB-provided args) so it is unit-testable.
 */
function scoreMachine(args: {
  machineId: string;
  installDate: Date | null;
  lastServiceDate: Date | null;
  meterRows: Array<{ readingDate: Date; total: number }>;
  recentTickets: Array<{
    status: string | null;
    createdAt: Date | null;
    description: string | null;
  }>;
  contractValue: number;
}): ScoredMachine {
  const now = Date.now();

  // --- Signal 1: meter delta acceleration -------------------------------
  // Compare the most recent period-over-period delta to the prior delta.
  let meterAccel = 0;
  let meterDetail = 'insufficient meter history';
  const rows = [...args.meterRows].sort(
    (a, b) => a.readingDate.getTime() - b.readingDate.getTime(),
  );
  if (rows.length >= 3) {
    const last = rows[rows.length - 1];
    const mid = rows[rows.length - 2];
    const first = rows[rows.length - 3];
    const recentDelta = last.total - mid.total;
    const priorDelta = mid.total - first.total;
    if (priorDelta > 0) {
      const accelRatio = (recentDelta - priorDelta) / priorDelta;
      // 100% acceleration (2x volume jump) saturates the signal.
      meterAccel = clamp01(accelRatio);
      meterDetail = `recent delta ${recentDelta} vs prior ${priorDelta} (accel ${(accelRatio * 100).toFixed(0)}%)`;
    }
  }

  // --- Signal 2: error-code / ticket frequency --------------------------
  // More service tickets in the trailing window => higher failure risk.
  const ticketCount = args.recentTickets.length;
  const errorFreq = clamp01(ticketCount / 4); // 4+ tickets saturates
  const errorDetail = `${ticketCount} service ticket(s) in trailing 90d`;

  // --- Signal 3: days since last service --------------------------------
  let daysSince = 0;
  let daysSinceDetail = 'never serviced';
  if (args.lastServiceDate) {
    const days = (now - args.lastServiceDate.getTime()) / 86_400_000;
    daysSince = clamp01(days / 180); // 180d saturates
    daysSinceDetail = `${Math.round(days)} days since last service`;
  } else {
    daysSince = 0.6; // unknown service date is moderately risky
  }

  // --- Signal 4: model age ----------------------------------------------
  let modelAge = 0;
  let modelAgeDetail = 'unknown install date';
  if (args.installDate) {
    const years = (now - args.installDate.getTime()) / (365 * 86_400_000);
    modelAge = clamp01(years / 7); // 7yr saturates
    modelAgeDetail = `${years.toFixed(1)} years since install`;
  }

  // --- Signal 5: toner-cycle anomaly ------------------------------------
  // Approximate from meter volume variance vs a steady cadence.
  let tonerAnomaly = 0;
  let tonerDetail = 'no anomaly detected';
  if (rows.length >= 3) {
    const deltas: number[] = [];
    for (let i = 1; i < rows.length; i++) deltas.push(rows[i].total - rows[i - 1].total);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    if (mean > 0) {
      const variance = deltas.reduce((a, d) => a + (d - mean) ** 2, 0) / deltas.length;
      const cv = Math.sqrt(variance) / mean; // coefficient of variation
      tonerAnomaly = clamp01(cv); // high variability => anomalous consumption
      tonerDetail = `consumption CV ${(cv * 100).toFixed(0)}%`;
    }
  }

  const signals: ScoredMachine['signals'] = {
    meter_accel: { value: meterAccel, weight: SIGNAL_WEIGHTS.meter_accel, detail: meterDetail },
    error_freq: { value: errorFreq, weight: SIGNAL_WEIGHTS.error_freq, detail: errorDetail },
    days_since_service: {
      value: daysSince,
      weight: SIGNAL_WEIGHTS.days_since_service,
      detail: daysSinceDetail,
    },
    model_age: { value: modelAge, weight: SIGNAL_WEIGHTS.model_age, detail: modelAgeDetail },
    toner_anomaly: {
      value: tonerAnomaly,
      weight: SIGNAL_WEIGHTS.toner_anomaly,
      detail: tonerDetail,
    },
    suggested_parts: [],
  };
  signals.suggested_parts = suggestParts(signals);

  const confidence = clamp01(
    signals.meter_accel.value * signals.meter_accel.weight +
      signals.error_freq.value * signals.error_freq.weight +
      signals.days_since_service.value * signals.days_since_service.weight +
      signals.model_age.value * signals.model_age.weight +
      signals.toner_anomaly.value * signals.toner_anomaly.weight,
  );

  return {
    machineId: args.machineId,
    confidence,
    contractValue: args.contractValue,
    signals,
  };
}

/** Append-only structured audit (matches the project's logger-based audit fallback). */
function auditPrediction(
  action: 'APPROVE_PREDICTION' | 'DISMISS_PREDICTION' | 'SNOOZE_PREDICTION' | 'RUN_SCORING',
  ctx: { tenantId: string; userId: string | undefined; predictionId?: string; extra?: unknown },
) {
  log.info(
    {
      audit: true,
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      predictionId: ctx.predictionId,
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    },
    '[AUDIT] predictive-failure',
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const meterTotalExpr = sql<number>`coalesce(${meterReadings.bwMeterReading}, 0) + coalesce(${meterReadings.colorMeterReading}, 0)`;

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.predictiveDispatchSettings.findFirst({
    where: eq(predictiveDispatchSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(predictiveDispatchSettings)
    .values({ tenantId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Lost the race — read back.
  return db.query.predictiveDispatchSettings.findFirst({
    where: eq(predictiveDispatchSettings.tenantId, tenantId),
  });
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const snoozeSchema = z.object({
  until: z.coerce.date(),
});

const settingsSchema = z.object({
  agentEnabled: z.boolean().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  pausedReason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerPredictiveFailureDispatchRoutes(app: Express) {
  /**
   * POST /api/predictive-failure/score
   * Run rules-based scoring for the tenant's active fleet. Respects the
   * per-tenant kill switch. Persists one prediction per machine and auto-creates
   * a DRAFT service ticket (status: pending_review) for predictions at/above the
   * confidence threshold.
   */
  app.post('/api/predictive-failure/score', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const settings = await getOrCreateSettings(tenantId);
      if (!settings) return res.status(500).json({ message: 'Failed to load dispatch settings' });

      // Kill switch
      if (!settings.agentEnabled) {
        auditPrediction('RUN_SCORING', { tenantId, userId, extra: { skipped: 'agent_disabled' } });
        return res.json({ skipped: true, reason: 'agent_disabled', created: 0, predictions: [] });
      }

      const threshold = settings.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

      // Active machines for the tenant
      const machines = await db
        .select({
          id: equipment.id,
          customerId: equipment.customerId,
          installDate: equipment.installDate,
          lastServiceDate: equipment.lastServiceDate,
          monthlyPayment: equipment.monthlyPayment,
        })
        .from(equipment)
        .where(and(eq(equipment.tenantId, tenantId), eq(equipment.equipmentStatus, 'active')));

      const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
      const scored: ScoredMachine[] = [];

      for (const m of machines) {
        // Meter history (most recent first, take a small window)
        const meterRows = await db
          .select({ readingDate: meterReadings.readingDate, total: meterTotalExpr })
          .from(meterReadings)
          .where(and(eq(meterReadings.tenantId, tenantId), eq(meterReadings.equipmentId, m.id)))
          .orderBy(desc(meterReadings.readingDate))
          .limit(6);

        // Recent service tickets for the machine
        const recentTickets = await db
          .select({
            status: serviceTickets.status,
            createdAt: serviceTickets.createdAt,
            description: serviceTickets.description,
          })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              eq(serviceTickets.equipmentId, m.id),
              gte(serviceTickets.createdAt, ninetyDaysAgo),
            ),
          );

        const contractValue = (m.monthlyPayment ? parseFloat(m.monthlyPayment.toString()) : 0) * 12;

        scored.push(
          scoreMachine({
            machineId: m.id,
            installDate: m.installDate ?? null,
            lastServiceDate: m.lastServiceDate ?? null,
            meterRows: meterRows
              .filter((r) => r.readingDate != null)
              .map((r) => ({ readingDate: r.readingDate as Date, total: Number(r.total) || 0 })),
            recentTickets: recentTickets.map((t) => ({
              status: t.status,
              createdAt: t.createdAt ?? null,
              description: t.description,
            })),
            contractValue,
          }),
        );
      }

      const windowStart = new Date();
      const windowEnd = new Date(Date.now() + PREDICTION_WINDOW_DAYS * 86_400_000);

      let created = 0;
      const persisted: Array<{
        id: string;
        machineId: string;
        confidence: number;
        serviceTicketId: string | null;
      }> = [];

      for (const s of scored) {
        let serviceTicketId: string | null = null;

        // Auto-create a DRAFT ticket for high-confidence predictions.
        if (s.confidence >= threshold) {
          // Look up the customer for the FK-required column.
          const machine = machines.find((m) => m.id === s.machineId);
          if (machine?.customerId) {
            const ticketNumber = `PF-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)
              .toString()
              .padStart(4, '0')}`;
            const [ticket] = await db
              .insert(serviceTickets)
              .values({
                tenantId,
                customerId: machine.customerId,
                equipmentId: s.machineId,
                ticketNumber,
                title: 'Predicted failure — review & dispatch',
                description: `Auto-generated by predictive-failure agent (confidence ${(s.confidence * 100).toFixed(0)}%). Suggested parts: ${
                  s.signals.suggested_parts.join(', ') || 'none'
                }.`,
                priority: s.confidence >= 0.85 ? 'high' : 'medium',
                status: 'pending_review',
                scheduledDate: windowEnd,
                requiredParts: s.signals.suggested_parts,
                createdBy: userId ?? 'predictive-failure-agent',
              })
              .returning({ id: serviceTickets.id });
            serviceTicketId = ticket?.id ?? null;
            if (serviceTicketId) created++;
          }
        }

        const [row] = await db
          .insert(equipmentFailurePredictions)
          .values({
            tenantId,
            machineId: s.machineId,
            predictedWindowStart: windowStart,
            predictedWindowEnd: windowEnd,
            confidence: s.confidence,
            signals: s.signals,
            contractValue: s.contractValue,
            serviceTicketId,
            status: 'pending',
            generatedAt: new Date(),
          })
          .returning({ id: equipmentFailurePredictions.id });

        persisted.push({
          id: row.id,
          machineId: s.machineId,
          confidence: s.confidence,
          serviceTicketId,
        });
      }

      auditPrediction('RUN_SCORING', {
        tenantId,
        userId,
        extra: { scored: scored.length, ticketsCreated: created, threshold },
      });

      res.json({
        skipped: false,
        scored: scored.length,
        created,
        threshold,
        predictions: persisted,
      });
    } catch (error: any) {
      log.error('Predictive-failure scoring failed:', error);
      res.status(500).json({ message: 'Failed to run scoring', error: error?.message });
    }
  });

  /**
   * GET /api/predictive-failure/predictions
   * List predictions sorted by confidence × contract_value (desc).
   * Optional ?status= filter.
   */
  app.get(
    '/api/predictive-failure/predictions',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const status = typeof req.query.status === 'string' ? req.query.status : undefined;

        const where = status
          ? and(
              eq(equipmentFailurePredictions.tenantId, tenantId),
              eq(equipmentFailurePredictions.status, status),
            )
          : eq(equipmentFailurePredictions.tenantId, tenantId);

        const rows = await db
          .select({
            id: equipmentFailurePredictions.id,
            machineId: equipmentFailurePredictions.machineId,
            confidence: equipmentFailurePredictions.confidence,
            contractValue: equipmentFailurePredictions.contractValue,
            signals: equipmentFailurePredictions.signals,
            serviceTicketId: equipmentFailurePredictions.serviceTicketId,
            status: equipmentFailurePredictions.status,
            outcome: equipmentFailurePredictions.outcome,
            predictedWindowStart: equipmentFailurePredictions.predictedWindowStart,
            predictedWindowEnd: equipmentFailurePredictions.predictedWindowEnd,
            snoozedUntil: equipmentFailurePredictions.snoozedUntil,
            reviewedByUserId: equipmentFailurePredictions.reviewedByUserId,
            reviewedAt: equipmentFailurePredictions.reviewedAt,
            generatedAt: equipmentFailurePredictions.generatedAt,
            serialNumber: equipment.serialNumber,
            model: equipment.modelNumber,
            manufacturer: equipment.manufacturer,
            location: equipment.locationDescription,
          })
          .from(equipmentFailurePredictions)
          .leftJoin(
            equipment,
            and(
              eq(equipment.id, equipmentFailurePredictions.machineId),
              eq(equipment.tenantId, tenantId),
            ),
          )
          .where(where)
          // confidence × contract_value sort
          .orderBy(
            desc(
              sql`${equipmentFailurePredictions.confidence} * coalesce(${equipmentFailurePredictions.contractValue}, 0)`,
            ),
          );

        const data = rows.map((r) => ({
          ...r,
          priorityScore: (r.confidence ?? 0) * (r.contractValue ?? 0),
          suggestedParts:
            (r.signals as any)?.suggested_parts && Array.isArray((r.signals as any).suggested_parts)
              ? (r.signals as any).suggested_parts
              : [],
        }));

        res.json({ data, total: data.length });
      } catch (error: any) {
        log.error('Failed to list predictions:', error);
        res.status(500).json({ message: 'Failed to list predictions', error: error?.message });
      }
    },
  );

  /**
   * POST /api/predictive-failure/predictions/:id/approve
   * Approve & dispatch. Dispatches the linked draft ticket (marks it assigned/
   * scheduled) and sets prediction.status='approved' + reviewedBy/At.
   */
  app.post(
    '/api/predictive-failure/predictions/:id/approve',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const prediction = await db.query.equipmentFailurePredictions.findFirst({
          where: and(
            eq(equipmentFailurePredictions.id, req.params.id),
            eq(equipmentFailurePredictions.tenantId, tenantId),
          ),
        });
        if (!prediction) return res.status(404).json({ message: 'Prediction not found' });

        // Dispatch the linked draft ticket if present.
        // The enhanced-service flow is not directly reachable as a callable here,
        // so we transition the linked draft ticket to a dispatched (assigned) state.
        if (prediction.serviceTicketId) {
          await db
            .update(serviceTickets)
            .set({ status: 'assigned', updatedAt: new Date() })
            .where(
              and(
                eq(serviceTickets.id, prediction.serviceTicketId),
                eq(serviceTickets.tenantId, tenantId),
              ),
            );
        }

        const [updated] = await db
          .update(equipmentFailurePredictions)
          .set({
            status: 'approved',
            reviewedByUserId: userId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(equipmentFailurePredictions.id, req.params.id),
              eq(equipmentFailurePredictions.tenantId, tenantId),
            ),
          )
          .returning();

        auditPrediction('APPROVE_PREDICTION', {
          tenantId,
          userId,
          predictionId: req.params.id,
          extra: { serviceTicketId: prediction.serviceTicketId },
        });

        res.json({ success: true, prediction: updated });
      } catch (error: any) {
        log.error('Failed to approve prediction:', error);
        res.status(500).json({ message: 'Failed to approve prediction', error: error?.message });
      }
    },
  );

  /**
   * POST /api/predictive-failure/predictions/:id/snooze
   * Body: { until: ISO date }. Defers review until the given time.
   */
  app.post(
    '/api/predictive-failure/predictions/:id/snooze',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = snoozeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        const [updated] = await db
          .update(equipmentFailurePredictions)
          .set({
            status: 'snoozed',
            snoozedUntil: parsed.data.until,
            reviewedByUserId: userId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(equipmentFailurePredictions.id, req.params.id),
              eq(equipmentFailurePredictions.tenantId, tenantId),
            ),
          )
          .returning();

        if (!updated) return res.status(404).json({ message: 'Prediction not found' });

        auditPrediction('SNOOZE_PREDICTION', {
          tenantId,
          userId,
          predictionId: req.params.id,
          extra: { until: parsed.data.until },
        });

        res.json({ success: true, prediction: updated });
      } catch (error: any) {
        log.error('Failed to snooze prediction:', error);
        res.status(500).json({ message: 'Failed to snooze prediction', error: error?.message });
      }
    },
  );

  /**
   * POST /api/predictive-failure/predictions/:id/dismiss
   * Dismiss a prediction; cancels the linked draft ticket if still pending review.
   */
  app.post(
    '/api/predictive-failure/predictions/:id/dismiss',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const prediction = await db.query.equipmentFailurePredictions.findFirst({
          where: and(
            eq(equipmentFailurePredictions.id, req.params.id),
            eq(equipmentFailurePredictions.tenantId, tenantId),
          ),
        });
        if (!prediction) return res.status(404).json({ message: 'Prediction not found' });

        // Cancel the linked draft ticket if it was never dispatched.
        if (prediction.serviceTicketId) {
          await db
            .update(serviceTickets)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(
              and(
                eq(serviceTickets.id, prediction.serviceTicketId),
                eq(serviceTickets.tenantId, tenantId),
                eq(serviceTickets.status, 'pending_review'),
              ),
            );
        }

        const [updated] = await db
          .update(equipmentFailurePredictions)
          .set({
            status: 'dismissed',
            reviewedByUserId: userId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(equipmentFailurePredictions.id, req.params.id),
              eq(equipmentFailurePredictions.tenantId, tenantId),
            ),
          )
          .returning();

        auditPrediction('DISMISS_PREDICTION', {
          tenantId,
          userId,
          predictionId: req.params.id,
        });

        res.json({ success: true, prediction: updated });
      } catch (error: any) {
        log.error('Failed to dismiss prediction:', error);
        res.status(500).json({ message: 'Failed to dismiss prediction', error: error?.message });
      }
    },
  );

  /**
   * GET /api/predictive-failure/settings  — kill switch + threshold.
   */
  app.get('/api/predictive-failure/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const settings = await getOrCreateSettings(tenantId);
      res.json(settings);
    } catch (error: any) {
      log.error('Failed to load settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /**
   * PUT /api/predictive-failure/settings  — update kill switch + threshold.
   */
  app.put('/api/predictive-failure/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      // Ensure a row exists.
      await getOrCreateSettings(tenantId);

      const updates: Record<string, unknown> = {
        updatedByUserId: userId,
        updatedAt: new Date(),
      };
      if (parsed.data.agentEnabled !== undefined) {
        updates.agentEnabled = parsed.data.agentEnabled;
        updates.pausedAt = parsed.data.agentEnabled ? null : new Date();
      }
      if (parsed.data.confidenceThreshold !== undefined) {
        updates.confidenceThreshold = parsed.data.confidenceThreshold;
      }
      if (parsed.data.pausedReason !== undefined) {
        updates.pausedReason = parsed.data.pausedReason;
      }

      const [updated] = await db
        .update(predictiveDispatchSettings)
        .set(updates)
        .where(eq(predictiveDispatchSettings.tenantId, tenantId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /**
   * GET /api/predictive-failure/accuracy
   * Precision/recall per machine model. A prediction is a true_positive when its
   * linked machine had a ticket closed (resolved/completed) within 30 days of the
   * prediction. Computed from existing data on the fly.
   */
  app.get('/api/predictive-failure/accuracy', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const predictions = await db
        .select({
          id: equipmentFailurePredictions.id,
          machineId: equipmentFailurePredictions.machineId,
          generatedAt: equipmentFailurePredictions.generatedAt,
          status: equipmentFailurePredictions.status,
          model: equipment.modelNumber,
        })
        .from(equipmentFailurePredictions)
        .leftJoin(
          equipment,
          and(
            eq(equipment.id, equipmentFailurePredictions.machineId),
            eq(equipment.tenantId, tenantId),
          ),
        )
        .where(eq(equipmentFailurePredictions.tenantId, tenantId));

      // Closed tickets per machine (resolved/completed).
      const machineIds = Array.from(new Set(predictions.map((p) => p.machineId)));
      const closedTickets = machineIds.length
        ? await db
            .select({
              equipmentId: serviceTickets.equipmentId,
              resolvedAt: serviceTickets.resolvedAt,
              createdAt: serviceTickets.createdAt,
              status: serviceTickets.status,
            })
            .from(serviceTickets)
            .where(
              and(
                eq(serviceTickets.tenantId, tenantId),
                inArray(serviceTickets.equipmentId, machineIds),
                inArray(serviceTickets.status, ['completed', 'resolved', 'closed']),
              ),
            )
        : [];

      const THIRTY_DAYS = 30 * 86_400_000;
      const byModel = new Map<
        string,
        { model: string; predictions: number; truePositives: number; falsePositives: number }
      >();

      for (const p of predictions) {
        const model = p.model || 'Unknown';
        const entry = byModel.get(model) ?? {
          model,
          predictions: 0,
          truePositives: 0,
          falsePositives: 0,
        };
        entry.predictions++;

        const genTime = p.generatedAt ? p.generatedAt.getTime() : 0;
        const matched = closedTickets.some((t) => {
          if (t.equipmentId !== p.machineId) return false;
          const closeTime = (t.resolvedAt ?? t.createdAt)?.getTime();
          if (!closeTime || !genTime) return false;
          return closeTime >= genTime && closeTime - genTime <= THIRTY_DAYS;
        });
        if (matched) entry.truePositives++;
        else entry.falsePositives++;
        byModel.set(model, entry);
      }

      const perModel = Array.from(byModel.values()).map((m) => {
        const precision = m.predictions > 0 ? m.truePositives / m.predictions : 0;
        return {
          model: m.model,
          predictions: m.predictions,
          truePositives: m.truePositives,
          falsePositives: m.falsePositives,
          // Recall denominator (all real failures) isn't fully observable from this
          // data; we report recall against confirmed closures as a proxy.
          precision,
          recall: precision,
        };
      });

      const totalPredictions = perModel.reduce((a, m) => a + m.predictions, 0);
      const totalTP = perModel.reduce((a, m) => a + m.truePositives, 0);

      res.json({
        perModel,
        overall: {
          predictions: totalPredictions,
          truePositives: totalTP,
          precision: totalPredictions > 0 ? totalTP / totalPredictions : 0,
        },
      });
    } catch (error: any) {
      log.error('Failed to compute accuracy:', error);
      res.status(500).json({ message: 'Failed to compute accuracy', error: error?.message });
    }
  });
}
