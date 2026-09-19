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
import { fetchAllRows } from '../_shared/paged-select.ts';

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
 * PERF-NPLUS1-002: this WAS the per-customer fan-out the Express original had,
 * and it was the worst one left in the edge tree - SEVEN round trips per
 * customer (two ticket counts, open invoices, the equipment id list, two meter
 * averages and the active contract), so a dealer with 500 customers made 3,500
 * sequential hops to the pooler in one invocation. It is five tenant-wide
 * paged reads now, whatever the customer count.
 *
 * THE ARITHMETIC IS UNCHANGED AND THAT IS THE POINT. Each read covers the WIDER
 * of the two windows and the narrower one is a filter in memory, which is
 * exactly what the two queries computed; the per-customer grouping is the same
 * `.eq('customer_id', ...)` expressed as a Map. Two details are reproduced
 * deliberately rather than tidied, because tidying either would move every
 * score: the contract pick keeps Postgres's DESC NULLS FIRST ordering (see
 * pickContract), and the meter window still compares reading_date against an
 * instant rather than a day boundary (DATE-LOCAL-002's shape, left alone here
 * because correcting it is a change in the numbers, not a refactor).
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

  const customerIds = (customers ?? []).map((c: Record<string, unknown>) => String(c.id));
  const scored: ScoredCustomer[] = [];
  if (customerIds.length === 0) {
    return { scored: 0, bands: {}, calculatedAt: new Date(nowMs).toISOString() };
  }

  // ─── Five tenant-wide reads, in place of seven per customer ──────────────

  // Tickets over the WIDER window; the 90-day count is a filter on the same
  // rows, which is what the second count(*) was computing.
  const ticketRows = await fetchAllRows<any>(() =>
    admin
      .from('service_tickets')
      .select('customer_id, created_at')
      .eq('tenant_id', tenantId)
      .in('customer_id', customerIds)
      .gte('created_at', twelveMonthsAgo),
  );
  const recentTickets = new Map<string, number>();
  const yearTickets = new Map<string, number>();
  for (const t of ticketRows ?? []) {
    const id = String(t.customer_id);
    yearTickets.set(id, (yearTickets.get(id) ?? 0) + 1);
    if (String(t.created_at) >= ninetyDaysAgo) {
      recentTickets.set(id, (recentTickets.get(id) ?? 0) + 1);
    }
  }

  const invoiceRows = await fetchAllRows<any>(() =>
    admin
      .from('invoices')
      .select('customer_id, due_date, balance_due')
      .eq('tenant_id', tenantId)
      .in('customer_id', customerIds)
      .in('invoice_status', OPEN_INVOICE_STATUSES),
  );
  const worstPastDue = new Map<string, number>();
  for (const inv of invoiceRows ?? []) {
    const balance = num(inv.balance_due);
    // A zero/credit balance is not past due no matter how old the invoice is.
    if (balance <= 0 || !inv.due_date) continue;
    const id = String(inv.customer_id);
    const days = (nowMs - new Date(inv.due_date as string).getTime()) / DAY_MS;
    if (days > (worstPastDue.get(id) ?? 0)) worstPastDue.set(id, days);
  }

  // NOTE the columns: bw_meter_reading / color_meter_reading, NOT black_copies
  // / color_copies. Both pairs exist on meter_readings and mean different
  // things - these are the cumulative E-Automate meter values the Express
  // scorer averages. Swapping in the copies columns would change every score
  // without any error surfacing.
  const equipmentRows = await fetchAllRows<any>(() =>
    admin
      .from('equipment')
      .select('id, customer_id')
      .eq('tenant_id', tenantId)
      .in('customer_id', customerIds),
  );
  const customerOfEquipment = new Map<string, string>();
  for (const e of equipmentRows ?? []) {
    customerOfEquipment.set(String(e.id), String(e.customer_id));
  }

  const meterRows =
    customerOfEquipment.size === 0
      ? []
      : ((await fetchAllRows<any>(() =>
          admin
            .from('meter_readings')
            .select('equipment_id, reading_date, bw_meter_reading, color_meter_reading')
            .eq('tenant_id', tenantId)
            .in('equipment_id', [...customerOfEquipment.keys()])
            .gte('reading_date', twelveMonthsAgo),
        )) ?? []);

  // Sum and count per window, so the average is sum/count exactly as
  // avgMeterTotal computed it - and 0, not NaN, when a customer has none.
  const recentMeter = new Map<string, { sum: number; n: number }>();
  const yearMeter = new Map<string, { sum: number; n: number }>();
  for (const r of meterRows) {
    const customerId = customerOfEquipment.get(String(r.equipment_id));
    if (!customerId) continue;
    const total = num(r.bw_meter_reading) + num(r.color_meter_reading);
    const year = yearMeter.get(customerId) ?? { sum: 0, n: 0 };
    year.sum += total;
    year.n += 1;
    yearMeter.set(customerId, year);
    if (String(r.reading_date) >= ninetyDaysAgo) {
      const recent = recentMeter.get(customerId) ?? { sum: 0, n: 0 };
      recent.sum += total;
      recent.n += 1;
      recentMeter.set(customerId, recent);
    }
  }
  const avgOf = (m: Map<string, { sum: number; n: number }>, id: string) => {
    const acc = m.get(id);
    return acc && acc.n > 0 ? acc.sum / acc.n : 0;
  };

  const contractRows = await fetchAllRows<any>(() =>
    admin
      .from('contracts')
      .select('customer_id, end_date, monthly_base')
      .eq('tenant_id', tenantId)
      .in('customer_id', customerIds)
      .eq('status', 'active'),
  );
  const contractOf = new Map<string, Record<string, unknown>>();
  for (const row of contractRows ?? []) {
    const id = String(row.customer_id);
    contractOf.set(id, pickContract(contractOf.get(id), row));
  }

  for (const c of customers ?? []) {
    const customerId = String(c.id);

    const recentTicketCount = recentTickets.get(customerId) ?? 0;
    const baselineMonthlyTickets = (yearTickets.get(customerId) ?? 0) / 12;
    const maxDaysPastDue = worstPastDue.get(customerId) ?? 0;
    const recentAvgVolume = avgOf(recentMeter, customerId);
    const longAvgVolume = avgOf(yearMeter, customerId);

    const contract = contractOf.get(customerId);
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

/**
 * Which of a customer's active contracts the scorer uses.
 *
 * PERF-NPLUS1-002 replaced a per-customer
 * `.order('end_date', { ascending: false }).limit(1)` with one tenant-wide read,
 * and this reproduces that ordering EXACTLY rather than taking the obvious
 * max(end_date). Postgres orders DESC as NULLS FIRST, so a contract with no end
 * date was the one the query returned whenever the customer had one - which
 * leaves daysToRenewal null and contract_value taken from THAT row. Picking the
 * latest dated contract instead would be more sensible and would move the
 * renewal-proximity signal on every customer who has an open-ended contract, so
 * it is left alone and written down instead.
 */
function pickContract(
  current: Record<string, unknown> | undefined,
  candidate: Record<string, unknown>,
): Record<string, unknown> {
  if (!current) return candidate;
  // NULLS FIRST: a null end_date outranks any date, and the first null seen
  // wins, matching LIMIT 1 over an otherwise unordered set.
  if (!current.end_date) return current;
  if (!candidate.end_date) return candidate;
  return String(candidate.end_date) > String(current.end_date) ? candidate : current;
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
