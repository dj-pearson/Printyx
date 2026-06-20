/**
 * Customer Churn-Risk Routes (US-SUPER-009).
 *
 * Weekly, interpretable per-customer churn-risk scoring for the OWNER persona.
 * Signals (all computed from existing Printyx data):
 *   - ticket_delta     : 90-day service-ticket count vs the 12-month monthly baseline
 *   - ar_past_due      : worst days-past-due across open invoices
 *   - meter_trend      : 3-month rolling print volume vs the 12-month average (drop => risk)
 *   - renewal_proximity: contract days-to-renewal (closer => risk)
 *   - email_sentiment  : STUB — omitted until inbound email sync + sentiment lands (see TODO)
 *
 * Each signal is normalized 0..1 (1 = max risk), blended with per-tenant weights
 * into a 0..100 score, and bucketed into healthy | watch | at_risk via the
 * per-tenant thresholds. One customer_churn_scores row is persisted per customer
 * per run, with a signals jsonb (per-input contribution + reason chips).
 *
 * Endpoints:
 *   POST /api/churn-risk/score                       — weekly scoring (cron-callable)
 *   GET  /api/churn-risk/scores                      — latest scores, value × score sort, ?band=
 *   GET  /api/churn-risk/scores/:customerId/history  — 52-week sparkline history
 *   POST /api/churn-risk/save-plan                   — draft outreach + retention offer (template)
 *   GET  /api/churn-risk/settings                    — weights/thresholds/digest toggle
 *   PUT  /api/churn-risk/settings
 *   POST /api/churn-risk/digest/preview              — Monday 7am OWNER digest assembly
 *
 * Schema lives in shared/churn-risk-schema.ts (re-exported from shared/schema.ts).
 * FKs are enforced in the backfill migration only.
 *
 * Auth: requireAuth + tenant scoping on every query.
 * TODO(rbac): gate with requirePermission(['customer.churn.view']) once that
 * permission string is added to the RBAC matrix. Mirrors the predictive-failure
 * exemplar, which uses requireAuth + tenant scoping until its permission exists.
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
  customerChurnScores,
  churnRiskSettings,
  businessRecords,
  contracts,
  invoices,
  serviceTickets,
  meterReadings,
  equipment,
} from '@shared/schema';

const log = createModuleLogger('routes-churn-risk');

// ---------------------------------------------------------------------------
// Scoring model (interpretable, rules-based)
// ---------------------------------------------------------------------------

/** Signal keys. `email_sentiment` is intentionally absent (v2 STUB). */
type SignalKey = 'ticket_delta' | 'ar_past_due' | 'meter_trend' | 'renewal_proximity';

/** Default per-signal weights (relative — normalized at scoring time). */
const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
  ticket_delta: 0.3,
  ar_past_due: 0.3,
  meter_trend: 0.2,
  renewal_proximity: 0.2,
};

const DEFAULT_WATCH_THRESHOLD = 31;
const DEFAULT_AT_RISK_THRESHOLD = 61;

/** Human-readable reason chips per signal when its risk is elevated. */
const SIGNAL_REASONS: Record<SignalKey, string> = {
  ticket_delta: 'Rising service tickets',
  ar_past_due: 'Past-due balance',
  meter_trend: 'Declining print volume',
  renewal_proximity: 'Renewal approaching',
};

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

interface ScoredCustomer {
  customerId: string;
  score: number; // 0..100
  band: 'healthy' | 'watch' | 'at_risk';
  contractValue: number;
  signals: {
    ticket_delta: SignalContribution;
    ar_past_due: SignalContribution;
    meter_trend: SignalContribution;
    renewal_proximity: SignalContribution;
    reasons: string[];
  };
}

function bandFor(score: number, watch: number, atRisk: number): 'healthy' | 'watch' | 'at_risk' {
  if (score >= atRisk) return 'at_risk';
  if (score >= watch) return 'watch';
  return 'healthy';
}

/**
 * Score a single customer from pre-aggregated inputs. Pure (only reads its args)
 * so it stays unit-testable.
 */
function scoreCustomer(args: {
  customerId: string;
  contractValue: number;
  // ticket signal
  recentTicketCount: number; // trailing 90d
  baselineMonthlyTickets: number; // 12-month monthly average
  // AR signal
  maxDaysPastDue: number; // worst open invoice
  // meter signal
  recentAvgVolume: number; // 3-month rolling avg
  longAvgVolume: number; // 12-month avg
  // renewal signal
  daysToRenewal: number | null;
  weights: Record<SignalKey, number>;
  watchThreshold: number;
  atRiskThreshold: number;
}): ScoredCustomer {
  // --- Signal 1: ticket-count delta (90d vs 12-month monthly baseline) ----
  // ~3 months of recent tickets compared to the 3-month-equivalent baseline.
  const baselineQuarter = args.baselineMonthlyTickets * 3;
  let ticketDelta = 0;
  let ticketDetail = `${args.recentTicketCount} tickets in 90d, no baseline`;
  if (baselineQuarter > 0) {
    const ratio = (args.recentTicketCount - baselineQuarter) / baselineQuarter;
    ticketDelta = clamp01(ratio); // 100%+ above baseline saturates
    ticketDetail = `${args.recentTicketCount} tickets in 90d vs ${baselineQuarter.toFixed(1)} baseline`;
  } else if (args.recentTicketCount >= 3) {
    ticketDelta = clamp01(args.recentTicketCount / 6); // no history but spiking
    ticketDetail = `${args.recentTicketCount} tickets in 90d (no prior baseline)`;
  }

  // --- Signal 2: AR days past due ----------------------------------------
  const arPastDue = clamp01(args.maxDaysPastDue / 90); // 90d past due saturates
  const arDetail =
    args.maxDaysPastDue > 0
      ? `${args.maxDaysPastDue} days past due (worst open invoice)`
      : 'no past-due balance';

  // --- Signal 3: meter trend (3-mo rolling vs 12-mo avg) -----------------
  // A DROP in print volume is the risk signal (less usage => disengagement).
  let meterTrend = 0;
  let meterDetail = 'insufficient meter history';
  if (args.longAvgVolume > 0) {
    const dropRatio = (args.longAvgVolume - args.recentAvgVolume) / args.longAvgVolume;
    meterTrend = clamp01(dropRatio); // 100% drop saturates
    meterDetail = `recent avg ${Math.round(args.recentAvgVolume)} vs 12-mo avg ${Math.round(
      args.longAvgVolume,
    )} (${(dropRatio * 100).toFixed(0)}% change)`;
  }

  // --- Signal 4: renewal proximity ---------------------------------------
  let renewalProximity = 0;
  let renewalDetail = 'no active contract';
  if (args.daysToRenewal != null) {
    if (args.daysToRenewal < 0) {
      renewalProximity = 1; // already expired => max risk
      renewalDetail = `contract expired ${Math.abs(args.daysToRenewal)} days ago`;
    } else {
      // 0d => 1.0, 180d+ => 0
      renewalProximity = clamp01(1 - args.daysToRenewal / 180);
      renewalDetail = `${args.daysToRenewal} days to renewal`;
    }
  }

  const signals: ScoredCustomer['signals'] = {
    ticket_delta: { value: ticketDelta, weight: args.weights.ticket_delta, detail: ticketDetail },
    ar_past_due: { value: arPastDue, weight: args.weights.ar_past_due, detail: arDetail },
    meter_trend: { value: meterTrend, weight: args.weights.meter_trend, detail: meterDetail },
    renewal_proximity: {
      value: renewalProximity,
      weight: args.weights.renewal_proximity,
      detail: renewalDetail,
    },
    reasons: [],
  };

  // Normalize weights so the blended score is a clean 0..1 regardless of config.
  const weightSum =
    args.weights.ticket_delta +
    args.weights.ar_past_due +
    args.weights.meter_trend +
    args.weights.renewal_proximity;
  const norm = weightSum > 0 ? weightSum : 1;

  const blended =
    (signals.ticket_delta.value * signals.ticket_delta.weight +
      signals.ar_past_due.value * signals.ar_past_due.weight +
      signals.meter_trend.value * signals.meter_trend.weight +
      signals.renewal_proximity.value * signals.renewal_proximity.weight) /
    norm;

  const score = Math.round(clamp01(blended) * 100);

  // Reason chips: any signal contributing meaningfully (>= 0.4 normalized risk).
  const keys: SignalKey[] = ['ticket_delta', 'ar_past_due', 'meter_trend', 'renewal_proximity'];
  signals.reasons = keys.filter((k) => signals[k].value >= 0.4).map((k) => SIGNAL_REASONS[k]);

  return {
    customerId: args.customerId,
    score,
    band: bandFor(score, args.watchThreshold, args.atRiskThreshold),
    contractValue: args.contractValue,
    signals,
  };
}

/** Append-only structured audit (matches the project's logger-based audit fallback). */
function auditChurn(
  action: 'RUN_SCORING' | 'SAVE_PLAN' | 'UPDATE_SETTINGS' | 'DIGEST_PREVIEW',
  ctx: { tenantId: string; userId: string | undefined; customerId?: string; extra?: unknown },
) {
  log.info(
    {
      audit: true,
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      customerId: ctx.customerId,
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    },
    '[AUDIT] churn-risk',
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWeights(raw: unknown): Record<SignalKey, number> {
  const w = (raw ?? {}) as Partial<Record<SignalKey, number>>;
  return {
    ticket_delta:
      typeof w.ticket_delta === 'number' ? w.ticket_delta : DEFAULT_WEIGHTS.ticket_delta,
    ar_past_due: typeof w.ar_past_due === 'number' ? w.ar_past_due : DEFAULT_WEIGHTS.ar_past_due,
    meter_trend: typeof w.meter_trend === 'number' ? w.meter_trend : DEFAULT_WEIGHTS.meter_trend,
    renewal_proximity:
      typeof w.renewal_proximity === 'number'
        ? w.renewal_proximity
        : DEFAULT_WEIGHTS.renewal_proximity,
  };
}

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.churnRiskSettings.findFirst({
    where: eq(churnRiskSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(churnRiskSettings)
    .values({ tenantId, weights: DEFAULT_WEIGHTS })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.churnRiskSettings.findFirst({
    where: eq(churnRiskSettings.tenantId, tenantId),
  });
}

/** Build a deterministic outreach email + retention offer from a customer's signals. */
function buildSavePlan(args: {
  companyName: string;
  band: string;
  signals: ScoredCustomer['signals'] | null;
}): { subject: string; body: string; retentionOffer: string } {
  const reasons = args.signals?.reasons ?? [];
  const company = args.companyName || 'there';

  // Retention offer keyed to the dominant signal.
  let retentionOffer = 'Complimentary account review with your dedicated account manager.';
  if (args.signals) {
    const s = args.signals;
    const top = (['ar_past_due', 'meter_trend', 'ticket_delta', 'renewal_proximity'] as const)
      .map((k) => ({ k, v: s[k]?.value ?? 0 }))
      .sort((a, b) => b.v - a.v)[0];
    if (top && top.v >= 0.4) {
      switch (top.k) {
        case 'ar_past_due':
          retentionOffer =
            'Flexible payment plan + a one-time 10% service credit to clear the past-due balance.';
          break;
        case 'meter_trend':
          retentionOffer =
            'Free print-fleet utilization assessment to right-size devices and lower your cost-per-page.';
          break;
        case 'ticket_delta':
          retentionOffer =
            'Priority service SLA upgrade + a proactive preventative-maintenance visit at no charge.';
          break;
        case 'renewal_proximity':
          retentionOffer =
            'Early-renewal incentive: locked current rates for 36 months plus a loyalty equipment-upgrade credit.';
          break;
      }
    }
  }

  const reasonLine = reasons.length
    ? `We noticed a few things worth a quick conversation: ${reasons.join(', ')}.`
    : 'We want to make sure your service continues to exceed expectations.';

  const subject = `Checking in on your account, ${company}`;
  const body = [
    `Hi ${company} team,`,
    '',
    reasonLine,
    '',
    `As a valued customer, we'd like to offer: ${retentionOffer}`,
    '',
    `Could we grab 15 minutes this week to walk through it? Reply here or give us a call and we'll set it up.`,
    '',
    'Thank you for your business,',
    'Your Printyx Account Team',
  ].join('\n');

  return { subject, body, retentionOffer };
  // NOTE: This is a deterministic, signal-driven template. An LLM-drafted variant
  // could be wired through an existing server AI service (e.g. server/domains/ai)
  // later; the template keeps the slice dependency-free and offline-safe.
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  weights: z
    .object({
      ticket_delta: z.number().min(0).optional(),
      ar_past_due: z.number().min(0).optional(),
      meter_trend: z.number().min(0).optional(),
      renewal_proximity: z.number().min(0).optional(),
      email_sentiment: z.number().min(0).optional(), // accepted but unused (v2 STUB)
    })
    .optional(),
  watchThreshold: z.number().int().min(0).max(100).optional(),
  atRiskThreshold: z.number().int().min(0).max(100).optional(),
  digestEnabled: z.boolean().optional(),
});

const savePlanSchema = z.object({
  customerId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerChurnRiskRoutes(app: Express) {
  /**
   * POST /api/churn-risk/score
   * Run weekly churn-risk scoring for every active customer. Cron-callable.
   * Persists one customer_churn_scores row per customer.
   */
  app.post('/api/churn-risk/score', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const settings = await getOrCreateSettings(tenantId);
      if (!settings) return res.status(500).json({ message: 'Failed to load churn settings' });

      const weights = resolveWeights(settings.weights);
      const watch = settings.watchThreshold ?? DEFAULT_WATCH_THRESHOLD;
      const atRisk = settings.atRiskThreshold ?? DEFAULT_AT_RISK_THRESHOLD;

      // Active customers for the tenant.
      const customers = await db
        .select({ id: businessRecords.id, companyName: businessRecords.companyName })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, 'customer'),
            eq(businessRecords.status, 'active'),
          ),
        );

      const now = Date.now();
      const ninetyDaysAgo = new Date(now - 90 * 86_400_000);
      const twelveMonthsAgo = new Date(now - 365 * 86_400_000);
      const threeMonthsAgo = new Date(now - 90 * 86_400_000);

      const scored: ScoredCustomer[] = [];

      for (const c of customers) {
        // --- Tickets: 90d count + 12-month monthly baseline -----------------
        const recentTicketRows = await db
          .select({ n: sql<number>`count(*)` })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              eq(serviceTickets.customerId, c.id),
              gte(serviceTickets.createdAt, ninetyDaysAgo),
            ),
          );
        const recentTicketCount = Number(recentTicketRows[0]?.n ?? 0);

        const yearTicketRows = await db
          .select({ n: sql<number>`count(*)` })
          .from(serviceTickets)
          .where(
            and(
              eq(serviceTickets.tenantId, tenantId),
              eq(serviceTickets.customerId, c.id),
              gte(serviceTickets.createdAt, twelveMonthsAgo),
            ),
          );
        const yearTicketCount = Number(yearTicketRows[0]?.n ?? 0);
        const baselineMonthlyTickets = yearTicketCount / 12;

        // --- AR: worst days-past-due across open invoices -------------------
        const openInvoices = await db
          .select({ dueDate: invoices.dueDate, balanceDue: invoices.balanceDue })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              eq(invoices.customerId, c.id),
              inArray(invoices.invoiceStatus, ['open', 'partial', 'overdue']),
            ),
          );
        let maxDaysPastDue = 0;
        for (const inv of openInvoices) {
          const balance = inv.balanceDue ? parseFloat(inv.balanceDue.toString()) : 0;
          if (balance <= 0 || !inv.dueDate) continue;
          const days = (now - inv.dueDate.getTime()) / 86_400_000;
          if (days > maxDaysPastDue) maxDaysPastDue = days;
        }

        // --- Meter trend: 3-mo rolling avg vs 12-mo avg ---------------------
        const meterTotalExpr = sql<number>`coalesce(${meterReadings.bwMeterReading}, 0) + coalesce(${meterReadings.colorMeterReading}, 0)`;
        // Customer's equipment-linked readings join through equipment.customerId,
        // but meter_readings is keyed by equipment. We approximate per-customer
        // volume via the readings whose equipment belongs to this customer.
        const recentMeterRows = await db
          .select({ total: meterTotalExpr })
          .from(meterReadings)
          .innerJoin(
            equipment,
            and(
              eq(equipment.id, meterReadings.equipmentId),
              eq(equipment.tenantId, tenantId),
              eq(equipment.customerId, c.id),
            ),
          )
          .where(
            and(
              eq(meterReadings.tenantId, tenantId),
              gte(meterReadings.readingDate, threeMonthsAgo),
            ),
          );
        const longMeterRows = await db
          .select({ total: meterTotalExpr })
          .from(meterReadings)
          .innerJoin(
            equipment,
            and(
              eq(equipment.id, meterReadings.equipmentId),
              eq(equipment.tenantId, tenantId),
              eq(equipment.customerId, c.id),
            ),
          )
          .where(
            and(
              eq(meterReadings.tenantId, tenantId),
              gte(meterReadings.readingDate, twelveMonthsAgo),
            ),
          );
        const avg = (rows: Array<{ total: number }>) =>
          rows.length ? rows.reduce((a, r) => a + (Number(r.total) || 0), 0) / rows.length : 0;
        const recentAvgVolume = avg(recentMeterRows);
        const longAvgVolume = avg(longMeterRows);

        // --- Renewal proximity + contract value -----------------------------
        const activeContract = await db
          .select({ endDate: contracts.endDate, monthlyBase: contracts.monthlyBase })
          .from(contracts)
          .where(
            and(
              eq(contracts.tenantId, tenantId),
              eq(contracts.customerId, c.id),
              eq(contracts.status, 'active'),
            ),
          )
          .orderBy(desc(contracts.endDate))
          .limit(1);
        const contract = activeContract[0];
        let daysToRenewal: number | null = null;
        if (contract?.endDate) {
          daysToRenewal = Math.round((contract.endDate.getTime() - now) / 86_400_000);
        }
        const contractValue = contract?.monthlyBase
          ? parseFloat(contract.monthlyBase.toString()) * 12
          : 0;

        // TODO(v2): inbound email sentiment signal. Requires email sync + a
        // sentiment classifier; omitted here per the story's v2 allowance so the
        // weighted score stays well-defined without it.

        scored.push(
          scoreCustomer({
            customerId: c.id,
            contractValue,
            recentTicketCount,
            baselineMonthlyTickets,
            maxDaysPastDue: Math.round(maxDaysPastDue),
            recentAvgVolume,
            longAvgVolume,
            daysToRenewal,
            weights,
            watchThreshold: watch,
            atRiskThreshold: atRisk,
          }),
        );
      }

      const calculatedAt = new Date();
      for (const s of scored) {
        await db.insert(customerChurnScores).values({
          tenantId,
          customerId: s.customerId,
          score: s.score,
          band: s.band,
          signals: s.signals,
          contractValue: s.contractValue,
          calculatedAt,
        });
      }

      const bandCounts = scored.reduce(
        (acc, s) => {
          acc[s.band] = (acc[s.band] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      auditChurn('RUN_SCORING', {
        tenantId,
        userId,
        extra: { scored: scored.length, bands: bandCounts },
      });

      res.json({ scored: scored.length, bands: bandCounts, calculatedAt });
    } catch (error: any) {
      log.error('Churn scoring failed:', error);
      res.status(500).json({ message: 'Failed to run churn scoring', error: error?.message });
    }
  });

  /**
   * GET /api/churn-risk/scores
   * Latest score per customer, sorted by contract value × score (desc).
   * Optional ?band=healthy|watch|at_risk.
   */
  app.get('/api/churn-risk/scores', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const band = typeof req.query.band === 'string' ? req.query.band : undefined;

      // Latest row per customer via DISTINCT ON.
      const latest = await db.execute(sql`
        SELECT DISTINCT ON (s.customer_id)
          s.id, s.customer_id, s.score, s.band, s.signals, s.contract_value, s.calculated_at,
          b.company_name
        FROM customer_churn_scores s
        LEFT JOIN business_records b
          ON b.id = s.customer_id AND b.tenant_id = ${tenantId}
        WHERE s.tenant_id = ${tenantId}
        ${band ? sql`AND s.band = ${band}` : sql``}
        ORDER BY s.customer_id, s.calculated_at DESC
      `);

      const rows = (latest as any).rows ?? (latest as any) ?? [];
      const data = rows
        .map((r: any) => {
          const score = Number(r.score) || 0;
          const contractValue = Number(r.contract_value) || 0;
          const signals = r.signals ?? null;
          return {
            id: r.id,
            customerId: r.customer_id,
            companyName: r.company_name ?? null,
            score,
            band: r.band,
            signals,
            contractValue,
            calculatedAt: r.calculated_at,
            priorityScore: score * contractValue,
            reasons: Array.isArray(signals?.reasons) ? signals.reasons : [],
          };
        })
        .sort((a: any, b: any) => b.priorityScore - a.priorityScore);

      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list churn scores:', error);
      res.status(500).json({ message: 'Failed to list churn scores', error: error?.message });
    }
  });

  /**
   * GET /api/churn-risk/scores/:customerId/history
   * Up to 52 weeks of score history for a sparkline (oldest → newest).
   */
  app.get(
    '/api/churn-risk/scores/:customerId/history',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const rows = await db
          .select({
            score: customerChurnScores.score,
            band: customerChurnScores.band,
            calculatedAt: customerChurnScores.calculatedAt,
          })
          .from(customerChurnScores)
          .where(
            and(
              eq(customerChurnScores.tenantId, tenantId),
              eq(customerChurnScores.customerId, req.params.customerId),
            ),
          )
          .orderBy(desc(customerChurnScores.calculatedAt))
          .limit(52);

        const history = rows
          .map((r) => ({
            score: Number(r.score) || 0,
            band: r.band,
            calculatedAt: r.calculatedAt,
          }))
          .reverse(); // oldest → newest for the sparkline

        res.json({ customerId: req.params.customerId, history });
      } catch (error: any) {
        log.error('Failed to load score history:', error);
        res.status(500).json({ message: 'Failed to load history', error: error?.message });
      }
    },
  );

  /**
   * POST /api/churn-risk/save-plan
   * Body: { customerId }. Drafts a signal-driven outreach email + retention
   * offer from the customer's latest score signals.
   */
  app.post('/api/churn-risk/save-plan', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = savePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const latest = await db
        .select({
          band: customerChurnScores.band,
          signals: customerChurnScores.signals,
          score: customerChurnScores.score,
        })
        .from(customerChurnScores)
        .where(
          and(
            eq(customerChurnScores.tenantId, tenantId),
            eq(customerChurnScores.customerId, parsed.data.customerId),
          ),
        )
        .orderBy(desc(customerChurnScores.calculatedAt))
        .limit(1);

      const customer = await db.query.businessRecords.findFirst({
        where: and(
          eq(businessRecords.id, parsed.data.customerId),
          eq(businessRecords.tenantId, tenantId),
        ),
      });
      if (!customer) return res.status(404).json({ message: 'Customer not found' });

      const score = latest[0];
      const plan = buildSavePlan({
        companyName: customer.companyName ?? '',
        band: score?.band ?? 'healthy',
        signals: (score?.signals as ScoredCustomer['signals']) ?? null,
      });

      auditChurn('SAVE_PLAN', { tenantId, userId, customerId: parsed.data.customerId });

      res.json({
        customerId: parsed.data.customerId,
        companyName: customer.companyName,
        band: score?.band ?? null,
        score: score ? Number(score.score) : null,
        ...plan,
      });
    } catch (error: any) {
      log.error('Failed to build save plan:', error);
      res.status(500).json({ message: 'Failed to build save plan', error: error?.message });
    }
  });

  /**
   * GET /api/churn-risk/settings  — weights, thresholds, digest toggle.
   */
  app.get('/api/churn-risk/settings', requireAuth, resolveTenant, async (req: any, res) => {
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
   * PUT /api/churn-risk/settings  — update weights, thresholds, digest toggle.
   */
  app.put('/api/churn-risk/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }

      const current = await getOrCreateSettings(tenantId);
      if (!current) return res.status(500).json({ message: 'Failed to load settings' });

      const updates: Record<string, unknown> = {
        updatedByUserId: userId,
        updatedAt: new Date(),
      };
      if (parsed.data.weights !== undefined) {
        // Merge over existing/defaults so partial weight edits are preserved.
        updates.weights = { ...resolveWeights(current.weights), ...parsed.data.weights };
      }
      if (parsed.data.watchThreshold !== undefined)
        updates.watchThreshold = parsed.data.watchThreshold;
      if (parsed.data.atRiskThreshold !== undefined)
        updates.atRiskThreshold = parsed.data.atRiskThreshold;
      if (parsed.data.digestEnabled !== undefined)
        updates.digestEnabled = parsed.data.digestEnabled;

      const [updated] = await db
        .update(churnRiskSettings)
        .set(updates)
        .where(eq(churnRiskSettings.tenantId, tenantId))
        .returning();

      auditChurn('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.data });

      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /**
   * POST /api/churn-risk/digest/preview
   * Assemble the Monday 7am OWNER digest: top 10 at-risk customers + week-over-
   * week score deltas. The assembly is real; the actual email send is a STUB.
   */
  app.post('/api/churn-risk/digest/preview', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const settings = await getOrCreateSettings(tenantId);

      // Latest + prior (≈7d earlier) score per customer for the WoW delta.
      const result = await db.execute(sql`
        WITH ranked AS (
          SELECT
            s.customer_id, s.score, s.band, s.signals, s.contract_value, s.calculated_at,
            ROW_NUMBER() OVER (PARTITION BY s.customer_id ORDER BY s.calculated_at DESC) AS rn
          FROM customer_churn_scores s
          WHERE s.tenant_id = ${tenantId}
        )
        SELECT
          cur.customer_id, cur.score, cur.band, cur.signals, cur.contract_value, cur.calculated_at,
          prev.score AS prev_score,
          b.company_name
        FROM ranked cur
        LEFT JOIN ranked prev ON prev.customer_id = cur.customer_id AND prev.rn = 2
        LEFT JOIN business_records b ON b.id = cur.customer_id AND b.tenant_id = ${tenantId}
        WHERE cur.rn = 1 AND cur.band = 'at_risk'
        ORDER BY (cur.score * COALESCE(cur.contract_value, 0)) DESC
        LIMIT 10
      `);

      const rows = (result as any).rows ?? (result as any) ?? [];
      const items = rows.map((r: any) => {
        const score = Number(r.score) || 0;
        const prev = r.prev_score == null ? null : Number(r.prev_score);
        const signals = r.signals ?? null;
        return {
          customerId: r.customer_id,
          companyName: r.company_name ?? null,
          score,
          band: r.band,
          contractValue: Number(r.contract_value) || 0,
          weekOverWeekDelta: prev == null ? null : score - prev,
          reasons: Array.isArray(signals?.reasons) ? signals.reasons : [],
        };
      });

      const digest = {
        title: 'Weekly Churn-Risk Digest',
        generatedAt: new Date(),
        tenantId,
        digestEnabled: settings?.digestEnabled ?? true,
        atRiskCount: items.length,
        topAtRisk: items,
      };

      // TODO: actually deliver this via the existing email infra (e.g.
      // server/routes/email-marketing-routes or the SendGrid helper) on the
      // Monday 07:00 cron. The assembly above is real; sending is stubbed so
      // the slice doesn't depend on outbound-email config.
      auditChurn('DIGEST_PREVIEW', { tenantId, userId, extra: { atRiskCount: items.length } });

      res.json(digest);
    } catch (error: any) {
      log.error('Failed to assemble digest:', error);
      res.status(500).json({ message: 'Failed to assemble digest', error: error?.message });
    }
  });
}
