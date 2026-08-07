/**
 * Churn-risk scoring model (PROD-010) — port of the pure logic in
 * server/routes-churn-risk.ts.
 *
 * Split from index.ts so it can be exercised in CI: index.ts imports
 * _shared/supabase.ts, which pulls @supabase/supabase-js from esm.sh at RUNTIME
 * and cannot be loaded by Node. Everything here is either pure or takes the
 * client as a parameter with only its TYPE imported.
 *
 * The model is rules-based and interpretable on purpose — the page shows the
 * per-signal contributions and reason chips, so the numbers have to be
 * explainable, not just produced.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/** Signal keys. `email_sentiment` is intentionally absent (v2 STUB). */
export type SignalKey = 'ticket_delta' | 'ar_past_due' | 'meter_trend' | 'renewal_proximity';

/** Default per-signal weights (relative — normalized at scoring time). */
export const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
  ticket_delta: 0.3,
  ar_past_due: 0.3,
  meter_trend: 0.2,
  renewal_proximity: 0.2,
};

export const DEFAULT_WATCH_THRESHOLD = 31;
export const DEFAULT_AT_RISK_THRESHOLD = 61;

/** Human-readable reason chips per signal when its risk is elevated. */
const SIGNAL_REASONS: Record<SignalKey, string> = {
  ticket_delta: 'Rising service tickets',
  ar_past_due: 'Past-due balance',
  meter_trend: 'Declining print volume',
  renewal_proximity: 'Renewal approaching',
};

/** A signal is "elevated" — and earns a reason chip — at or above this risk. */
const REASON_THRESHOLD = 0.4;

export function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export interface SignalContribution {
  value: number; // normalized 0..1 risk contribution
  weight: number;
  detail?: string;
}

export interface ScoredCustomer {
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

export function bandFor(score: number, watch: number, atRisk: number): ScoredCustomer['band'] {
  if (score >= atRisk) return 'at_risk';
  if (score >= watch) return 'watch';
  return 'healthy';
}

export function resolveWeights(raw: unknown): Record<SignalKey, number> {
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

/**
 * Score a single customer from pre-aggregated inputs. Pure — reads only its args.
 */
export function scoreCustomer(args: {
  customerId: string;
  contractValue: number;
  recentTicketCount: number; // trailing 90d
  baselineMonthlyTickets: number; // 12-month monthly average
  maxDaysPastDue: number; // worst open invoice
  recentAvgVolume: number; // 3-month rolling avg
  longAvgVolume: number; // 12-month avg
  daysToRenewal: number | null;
  weights: Record<SignalKey, number>;
  watchThreshold: number;
  atRiskThreshold: number;
}): ScoredCustomer {
  // --- Signal 1: ticket-count delta (90d vs 12-month monthly baseline) ----
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

  const keys: SignalKey[] = ['ticket_delta', 'ar_past_due', 'meter_trend', 'renewal_proximity'];
  signals.reasons = keys
    .filter((k) => signals[k].value >= REASON_THRESHOLD)
    .map((k) => SIGNAL_REASONS[k]);

  return {
    customerId: args.customerId,
    score,
    band: bandFor(score, args.watchThreshold, args.atRiskThreshold),
    contractValue: args.contractValue,
    signals,
  };
}

/** Build a deterministic outreach email + retention offer from a customer's signals. */
export function buildSavePlan(args: {
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
    if (top && top.v >= REASON_THRESHOLD) {
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
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** Invoice statuses that still carry a collectible balance. */
const OPEN_INVOICE_STATUSES = ['open', 'partial', 'overdue'];

/**
 * Run scoring for every active customer and persist one row each.
 *
 * Faithful to the Express loop, including its per-customer query fan-out. That
 * is genuinely N+1, but reproducing the aggregation in a different shape risks
 * changing the numbers, and this endpoint is a weekly cron-style batch rather
 * than a request-path read. Fixing the fan-out is a separate, measurable change.
 */
export async function runScoring(
  admin: SupabaseClient,
  tenantId: string,
  nowMs: number = Date.now(),
): Promise<{ scored: number; bands: Record<string, number>; calculatedAt: string }> {
  const settings = await getOrCreateSettings(admin, tenantId);
  const weights = resolveWeights(settings?.weights);
  const watch = settings?.watch_threshold ?? DEFAULT_WATCH_THRESHOLD;
  const atRisk = settings?.at_risk_threshold ?? DEFAULT_AT_RISK_THRESHOLD;

  const { data: customers } = await admin
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .eq('record_type', 'customer')
    .eq('status', 'active');

  const ninetyDaysAgo = new Date(nowMs - 90 * DAY_MS).toISOString();
  const twelveMonthsAgo = new Date(nowMs - 365 * DAY_MS).toISOString();

  const scored: ScoredCustomer[] = [];

  for (const c of customers ?? []) {
    const customerId = String(c.id);

    // --- Tickets: 90d count + 12-month monthly baseline -------------------
    const recentTicketCount = await countTickets(admin, tenantId, customerId, ninetyDaysAgo);
    const yearTicketCount = await countTickets(admin, tenantId, customerId, twelveMonthsAgo);
    const baselineMonthlyTickets = yearTicketCount / 12;

    // --- AR: worst days-past-due across open invoices ---------------------
    const { data: openInvoices } = await admin
      .from('invoices')
      .select('due_date, balance_due')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .in('invoice_status', OPEN_INVOICE_STATUSES);

    let maxDaysPastDue = 0;
    for (const inv of openInvoices ?? []) {
      const balance = num(inv.balance_due);
      // A zero/credit balance is not past due no matter how old the invoice is.
      if (balance <= 0 || !inv.due_date) continue;
      const days = (nowMs - new Date(inv.due_date as string).getTime()) / DAY_MS;
      if (days > maxDaysPastDue) maxDaysPastDue = days;
    }

    // --- Meter trend: 3-mo rolling avg vs 12-mo avg -----------------------
    // NOTE the columns: bw_meter_reading / color_meter_reading, NOT
    // black_copies / color_copies. Both pairs exist on meter_readings and mean
    // different things — these are the cumulative E-Automate meter values the
    // Express scorer averages. Swapping in the copies columns would change every
    // score without any error surfacing.
    const equipmentIds = await customerEquipmentIds(admin, tenantId, customerId);
    const recentAvgVolume = await avgMeterTotal(admin, tenantId, equipmentIds, ninetyDaysAgo);
    const longAvgVolume = await avgMeterTotal(admin, tenantId, equipmentIds, twelveMonthsAgo);

    // --- Renewal proximity + contract value -------------------------------
    const { data: activeContracts } = await admin
      .from('contracts')
      .select('end_date, monthly_base')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1);

    const contract = (activeContracts ?? [])[0];
    let daysToRenewal: number | null = null;
    if (contract?.end_date) {
      daysToRenewal = Math.round(
        (new Date(contract.end_date as string).getTime() - nowMs) / DAY_MS,
      );
    }
    const contractValue = contract?.monthly_base ? num(contract.monthly_base) * 12 : 0;

    scored.push(
      scoreCustomer({
        customerId,
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

  const calculatedAt = new Date(nowMs).toISOString();
  if (scored.length > 0) {
    // One insert for the batch rather than Express's per-row loop: the table is
    // append-only history keyed by (customer, run), so a single statement is
    // equivalent and far fewer round trips.
    const { error } = await admin.from('customer_churn_scores').insert(
      scored.map((s) => ({
        tenant_id: tenantId,
        customer_id: s.customerId,
        score: s.score,
        band: s.band,
        signals: s.signals,
        contract_value: s.contractValue,
        calculated_at: calculatedAt,
      })),
    );
    if (error) throw error;
  }

  const bands = scored.reduce<Record<string, number>>((acc, s) => {
    acc[s.band] = (acc[s.band] ?? 0) + 1;
    return acc;
  }, {});

  return { scored: scored.length, bands, calculatedAt };
}

async function countTickets(
  admin: SupabaseClient,
  tenantId: string,
  customerId: string,
  since: string,
): Promise<number> {
  const { count } = await admin
    .from('service_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .gte('created_at', since);
  return count ?? 0;
}

/**
 * meter_readings is keyed by equipment, so per-customer volume resolves through
 * the customer's equipment. Express expressed this as an inner join; PostgREST
 * needs the id list first.
 */
async function customerEquipmentIds(
  admin: SupabaseClient,
  tenantId: string,
  customerId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('equipment')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);
  return (data ?? []).map((e: Record<string, unknown>) => String(e.id));
}

async function avgMeterTotal(
  admin: SupabaseClient,
  tenantId: string,
  equipmentIds: string[],
  since: string,
): Promise<number> {
  // No equipment means no readings — and an average over nothing is 0, not NaN.
  if (equipmentIds.length === 0) return 0;
  const { data } = await admin
    .from('meter_readings')
    .select('bw_meter_reading, color_meter_reading')
    .eq('tenant_id', tenantId)
    .in('equipment_id', equipmentIds)
    .gte('reading_date', since);
  const rows = data ?? [];
  if (rows.length === 0) return 0;
  const sum = rows.reduce(
    (a: number, r: Record<string, unknown>) =>
      a + num(r.bw_meter_reading) + num(r.color_meter_reading),
    0,
  );
  return sum / rows.length;
}

/**
 * Read the tenant's settings row, creating it with defaults on first use.
 * The insert tolerates a concurrent creator (re-read on conflict) — two
 * dashboards opening at once must not 500.
 */
export async function getOrCreateSettings(
  admin: SupabaseClient,
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const { data: existing } = await admin
    .from('churn_risk_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await admin
    .from('churn_risk_settings')
    .insert({ tenant_id: tenantId, weights: DEFAULT_WEIGHTS })
    .select()
    .maybeSingle();
  if (created) return created;

  const { data: reread } = await admin
    .from('churn_risk_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return reread ?? null;
}
