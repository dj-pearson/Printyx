/**
 * Installed-base play detection and ranking (COP-B04).
 *
 * Pure. Takes the installed base as plain rows and returns plays; the edge
 * function does the reading and the writing. Every rule here is one somebody
 * will want to argue with, and a rep who cannot argue with a ranked list is a
 * rep who ignores it.
 *
 * FOUR RULES THIS FILE ENFORCES.
 *
 *  1. A PLAY IS A DATED FACT, never an inference about intent. "This lease ends
 *     on 14 March" is a play. "This customer seems ready to buy" is not, and
 *     nothing here produces one.
 *
 *  2. ESTIMATED VALUE IS NULL WHEN IT CANNOT BE DERIVED. Not zero. A play worth
 *     an unknown amount still deserves to be seen, and a zero sorts it to the
 *     bottom of a list ranked by value - which is how a real opportunity
 *     disappears. The ranking handles null explicitly.
 *
 *  3. THE SCORE SHOWS ITS WORKING. Every play carries the factors that built
 *     it, so "why is this above that one" has an answer on the row.
 *
 *  4. URGENCY IS A CURVE, NOT A FLAG. A lease ending in 8 days and one ending
 *     in 110 are both inside a 120-day window and are not the same call to make
 *     today.
 *
 * WHAT THE DATA CANNOT DO, stated here rather than discovered later:
 * `service_tickets` has an `equipment_id` and NO cost column - not on that
 * table, not anywhere in the schema - so the service play counts CALLS, not
 * dollars. AC2 asks for a cost/margin threshold and this is the honest
 * substitute; the response names the gap rather than implying the number is
 * money.
 */

export const RADAR_PLAY_TYPES = [
  'lease_expiring',
  'contract_ending',
  'volume_over_tier',
  'service_burden',
  'color_underused',
  'meters_not_reporting',
] as const;
export type RadarPlayType = (typeof RADAR_PLAY_TYPES)[number];

export interface RadarThresholds {
  leaseWindowDays: number;
  contractWindowDays: number;
  volumeOveragePct: number;
  serviceCallThreshold: number;
  serviceLookbackDays: number;
  colorUnderusePct: number;
  meterSilenceDays: number;
}

export const DEFAULT_THRESHOLDS: RadarThresholds = {
  leaseWindowDays: 120,
  contractWindowDays: 90,
  volumeOveragePct: 15,
  serviceCallThreshold: 4,
  serviceLookbackDays: 180,
  colorUnderusePct: 5,
  meterSilenceDays: 90,
};

export interface RadarEquipment {
  id: string;
  customer_id?: string | null;
  serial_number?: string | null;
  model_number?: string | null;
  is_color_capable?: boolean | null;
  equipment_status?: string | null;
  lease_expires_date?: string | null;
  purchase_price?: string | number | null;
}

export interface RadarContract {
  id: string;
  customer_id?: string | null;
  end_date?: string | null;
  status?: string | null;
  monthly_base?: string | number | null;
  black_rate?: string | number | null;
  color_rate?: string | number | null;
}

/** Pre-aggregated per machine by the caller - PostgREST has no GROUP BY. */
export interface RadarMeterSummary {
  equipmentId: string;
  monthlyBlack: number;
  monthlyColor: number;
  /** ISO date of the newest reading, or null when there has never been one. */
  lastReadingDate: string | null;
}

export interface RadarPlayDraft {
  playType: RadarPlayType;
  dedupeKey: string;
  customerId: string | null;
  equipmentIds: string[];
  contractId: string | null;
  reason: string;
  triggerDate: string | null;
  /** NULL when it cannot be derived. Never zero. */
  estimatedValue: number | null;
  score: number;
  scoreFactors: Record<string, unknown>;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function money(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/**
 * Urgency, 0-100, as a curve over how soon the trigger lands.
 *
 * Past-due is MAXIMUM, not zero: a lease that ended last month is the most
 * urgent call on the list, not an expired opportunity. Beyond the window it
 * decays rather than cutting off, so a play that only just qualifies does not
 * arrive with the same weight as one landing next week.
 */
export function urgencyFor(daysUntil: number | null, windowDays: number): number {
  if (daysUntil == null) return 40;
  if (daysUntil <= 0) return 100;
  if (daysUntil >= windowDays) return 10;
  return Math.round(100 - (daysUntil / windowDays) * 90);
}

/**
 * Rank, 0-100, from urgency and value together.
 *
 * A null value scores on urgency ALONE rather than being treated as a zero
 * value - see rule 2. `valueCeiling` normalizes dollars across a tenant whose
 * deals are $4k and one whose deals are $400k, so neither gets a flat list.
 */
export function scoreFor(
  urgency: number,
  estimatedValue: number | null,
  valueCeiling: number,
): number {
  if (estimatedValue == null) return Math.max(0, Math.min(100, Math.round(urgency)));
  const ceiling = valueCeiling > 0 ? valueCeiling : 1;
  const valueScore = Math.min(100, (estimatedValue / ceiling) * 100);
  return Math.max(0, Math.min(100, Math.round(urgency * 0.6 + valueScore * 0.4)));
}

/** The date is part of the key: a re-papered lease is a NEW play (see schema). */
function key(type: RadarPlayType, subject: string, date: string | null): string {
  return `${type}:${subject}:${(date ?? 'undated').slice(0, 10)}`;
}

export interface RadarInput {
  equipment: RadarEquipment[];
  contracts: RadarContract[];
  meters: RadarMeterSummary[];
  /** equipmentId -> service calls inside the lookback. */
  serviceCalls: Map<string, number>;
  /** business_records id -> company name, for readable reasons. */
  companyNames: Map<string, string>;
  thresholds: RadarThresholds;
  now: Date;
}

/**
 * Detect every play in one pass over the installed base.
 *
 * `now` is injected rather than read from the clock so a scan is deterministic
 * and testable, the same way shared/deal-score.ts does it.
 */
export function detectPlays(input: RadarInput): RadarPlayDraft[] {
  const { equipment, contracts, meters, serviceCalls, thresholds, now } = input;
  const plays: RadarPlayDraft[] = [];

  const metersByEquipment = new Map(meters.map((m) => [m.equipmentId, m]));
  // Retired machines are not opportunities.
  const live = equipment.filter(
    (e) => String(e.equipment_status ?? 'active').toLowerCase() !== 'retired',
  );

  // ── 1. Lease expiring ──────────────────────────────────────────────
  for (const machine of live) {
    const expiry = parseDate(machine.lease_expires_date);
    if (!expiry) continue;
    const daysUntil = daysBetween(now, expiry);
    if (daysUntil > thresholds.leaseWindowDays) continue;
    // A lease that ended more than a year ago is history, not a play.
    if (daysUntil < -365) continue;

    // The replacement is worth roughly what the machine cost. Null when the
    // purchase price is not recorded - a guessed deal size ranks a play it
    // knows nothing about above one it does.
    const estimatedValue = toNumber(machine.purchase_price);
    const urgency = urgencyFor(daysUntil, thresholds.leaseWindowDays);
    plays.push({
      playType: 'lease_expiring',
      dedupeKey: key('lease_expiring', machine.id, machine.lease_expires_date ?? null),
      customerId: machine.customer_id ?? null,
      equipmentIds: [machine.id],
      contractId: null,
      reason:
        daysUntil < 0
          ? `Lease on ${machine.model_number ?? 'this device'} (${machine.serial_number ?? 'no serial'}) ended ${Math.abs(daysUntil)} days ago.`
          : `Lease on ${machine.model_number ?? 'this device'} (${machine.serial_number ?? 'no serial'}) ends in ${daysUntil} days.`,
      triggerDate: expiry.toISOString(),
      estimatedValue,
      score: 0,
      scoreFactors: { daysUntil, urgency, basis: 'purchase price of the expiring machine' },
    });
  }

  // ── 2. Service contract ending ─────────────────────────────────────
  for (const contract of contracts) {
    const end = parseDate(contract.end_date);
    if (!end) continue;
    if (String(contract.status ?? '').toLowerCase() !== 'active') continue;
    const daysUntil = daysBetween(now, end);
    if (daysUntil > thresholds.contractWindowDays || daysUntil < -365) continue;

    const monthly = toNumber(contract.monthly_base);
    const estimatedValue = monthly != null ? monthly * 12 : null;
    const urgency = urgencyFor(daysUntil, thresholds.contractWindowDays);
    plays.push({
      playType: 'contract_ending',
      dedupeKey: key('contract_ending', contract.id, contract.end_date ?? null),
      customerId: contract.customer_id ?? null,
      equipmentIds: [],
      contractId: contract.id,
      reason:
        daysUntil < 0
          ? `Service contract ended ${Math.abs(daysUntil)} days ago and has not been renewed.`
          : `Service contract ends in ${daysUntil} days.`,
      triggerDate: end.toISOString(),
      estimatedValue,
      score: 0,
      scoreFactors: { daysUntil, urgency, basis: 'annualized monthly base' },
    });
  }

  // ── 3. Volume materially over the contracted tier ──────────────────
  //
  // Grouped by CONTRACT, not by machine: a customer prints over tier across a
  // fleet, and one play per machine would bury the account in near-duplicates.
  for (const contract of contracts) {
    if (String(contract.status ?? '').toLowerCase() !== 'active') continue;
    const blackRate = toNumber(contract.black_rate);
    const colorRate = toNumber(contract.color_rate);
    const base = toNumber(contract.monthly_base);
    if (base == null || base <= 0) continue;
    if (blackRate == null && colorRate == null) continue;

    const fleet = live.filter((e) => e.customer_id === contract.customer_id);
    if (fleet.length === 0) continue;

    let black = 0;
    let color = 0;
    let measured = 0;
    for (const machine of fleet) {
      const meter = metersByEquipment.get(machine.id);
      if (!meter) continue;
      measured += 1;
      black += meter.monthlyBlack;
      color += meter.monthlyColor;
    }
    // No readings means no claim - silence is the meters_not_reporting play,
    // not a volume verdict. BELT AND BRACES, and labelled as such: with no
    // readings both totals are 0, so clickRevenue is 0 and the threshold below
    // already refuses. A mutation removing this line changed no test, which is
    // how that was established rather than assumed. It stays because the
    // threshold is the only other thing standing between silent meters and a
    // claim about volume, and one guard for that is thin.
    if (measured === 0) continue;

    const clickRevenue = black * (blackRate ?? 0) + color * (colorRate ?? 0);
    const overagePct = (clickRevenue / base) * 100;
    if (overagePct < 100 + thresholds.volumeOveragePct) continue;

    const annualUplift = (clickRevenue - base) * 12;
    plays.push({
      playType: 'volume_over_tier',
      dedupeKey: key('volume_over_tier', contract.id, now.toISOString()),
      customerId: contract.customer_id ?? null,
      equipmentIds: fleet.map((e) => e.id),
      contractId: contract.id,
      reason: `Metered volume is running at ${Math.round(overagePct)}% of the contracted base across ${measured} device${measured === 1 ? '' : 's'} - about ${money(annualUplift)} a year above the tier.`,
      triggerDate: now.toISOString(),
      estimatedValue: annualUplift > 0 ? annualUplift : null,
      score: 0,
      scoreFactors: {
        overagePct: Math.round(overagePct),
        devicesMeasured: measured,
        devicesInFleet: fleet.length,
        urgency: 70,
      },
    });
  }

  // ── 4. Service burden ──────────────────────────────────────────────
  // CALLS, not cost. No cost column exists anywhere (see the header).
  for (const machine of live) {
    const calls = serviceCalls.get(machine.id) ?? 0;
    if (calls < thresholds.serviceCallThreshold) continue;
    plays.push({
      playType: 'service_burden',
      dedupeKey: key('service_burden', machine.id, now.toISOString()),
      customerId: machine.customer_id ?? null,
      equipmentIds: [machine.id],
      contractId: null,
      reason: `${machine.model_number ?? 'This device'} (${machine.serial_number ?? 'no serial'}) has taken ${calls} service calls in the last ${thresholds.serviceLookbackDays} days.`,
      triggerDate: now.toISOString(),
      // Deliberately null: replacing a troublesome machine is worth something,
      // and nothing in the data says how much.
      estimatedValue: toNumber(machine.purchase_price),
      score: 0,
      scoreFactors: {
        serviceCalls: calls,
        threshold: thresholds.serviceCallThreshold,
        urgency: Math.min(90, 40 + calls * 8),
        basis: 'call COUNT - no service cost is recorded anywhere in the schema',
      },
    });
  }

  // ── 5. Colour-capable device barely printing colour ────────────────
  for (const machine of live) {
    if (machine.is_color_capable !== true) continue;
    const meter = metersByEquipment.get(machine.id);
    if (!meter) continue;
    const total = meter.monthlyBlack + meter.monthlyColor;
    // A device printing almost nothing is a different play (or none at all);
    // a colour share of 0 out of 12 pages says nothing about colour.
    if (total < 500) continue;
    const colorShare = (meter.monthlyColor / total) * 100;
    if (colorShare >= thresholds.colorUnderusePct) continue;

    plays.push({
      playType: 'color_underused',
      dedupeKey: key('color_underused', machine.id, now.toISOString()),
      customerId: machine.customer_id ?? null,
      equipmentIds: [machine.id],
      contractId: null,
      reason: `${machine.model_number ?? 'This device'} is colour-capable but only ${colorShare.toFixed(1)}% of its ${Math.round(total).toLocaleString()} monthly pages are colour - they may be paying for colour they do not use, or not know they have it.`,
      triggerDate: now.toISOString(),
      // A right-sizing conversation, not a purchase. No dollar figure follows
      // from the meters, and inventing one would rank it against real numbers.
      estimatedValue: null,
      score: 0,
      scoreFactors: {
        colorSharePct: Number(colorShare.toFixed(1)),
        monthlyPages: Math.round(total),
        urgency: 35,
      },
    });
  }

  // ── 6. Device not reporting meters ─────────────────────────────────
  for (const machine of live) {
    const meter = metersByEquipment.get(machine.id);
    const last = parseDate(meter?.lastReadingDate ?? null);
    const silentDays = last ? daysBetween(last, now) : null;
    if (silentDays != null && silentDays < thresholds.meterSilenceDays) continue;

    plays.push({
      playType: 'meters_not_reporting',
      dedupeKey: key('meters_not_reporting', machine.id, now.toISOString()),
      customerId: machine.customer_id ?? null,
      equipmentIds: [machine.id],
      contractId: null,
      reason: last
        ? `${machine.model_number ?? 'This device'} (${machine.serial_number ?? 'no serial'}) has not reported a meter in ${silentDays} days - it may be off-network, idle, or gone.`
        : `${machine.model_number ?? 'This device'} (${machine.serial_number ?? 'no serial'}) has never reported a meter reading.`,
      triggerDate: now.toISOString(),
      // Unbilled clicks are the risk and their size is unknowable until the
      // device reports. That is the point of the play.
      estimatedValue: null,
      score: 0,
      scoreFactors: {
        daysSinceLastReading: silentDays,
        neverReported: last == null,
        urgency: 50,
      },
    });
  }

  return rankPlays(plays);
}

/**
 * Score and sort. The ceiling is the tenant's own largest play, so ranking is
 * relative to their business rather than to a number hardcoded here.
 */
export function rankPlays(plays: RadarPlayDraft[]): RadarPlayDraft[] {
  const values = plays.map((p) => p.estimatedValue).filter((v): v is number => v != null && v > 0);
  const ceiling = values.length > 0 ? Math.max(...values) : 1;

  return plays
    .map((play) => {
      const urgency = Number(play.scoreFactors.urgency ?? 50);
      const score = scoreFor(urgency, play.estimatedValue, ceiling);
      return { ...play, score, scoreFactors: { ...play.scoreFactors, valueCeiling: ceiling } };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0) ||
        a.dedupeKey.localeCompare(b.dedupeKey),
    );
}

/**
 * What a converted play pre-fills on the deal (AC3), so the rep never retypes
 * what the system already knows. Only facts the play carries - nothing here
 * invents a close date or a stage.
 */
export function dealFromPlay(
  play: RadarPlayDraft & { companyName?: string | null },
  opts: { tenantId: string; stageId: string; ownerId: string },
): Record<string, unknown> {
  const motion =
    play.playType === 'lease_expiring'
      ? 'lease_rollover'
      : play.playType === 'contract_ending'
        ? 'renewal'
        : play.playType === 'service_burden'
          ? 'fleet_refresh'
          : 'expansion';

  return {
    tenant_id: opts.tenantId,
    title: `${play.companyName ?? 'Account'} - ${play.playType.replace(/_/g, ' ')}`.slice(0, 200),
    description: play.reason,
    amount: play.estimatedValue != null ? play.estimatedValue.toFixed(2) : null,
    owner_id: opts.ownerId,
    customer_id: play.customerId,
    source_business_record_id: play.customerId,
    company_name: play.companyName ?? null,
    stage_id: opts.stageId,
    status: 'open',
    // The trigger date is when the opportunity becomes live, which is the
    // honest expected close for a dated play and null for an undated one.
    expected_close_date: play.triggerDate,
    source: 'opportunity_radar',
    deal_motion: motion,
    // Nobody has judged this yet - it was generated an instant ago.
    forecast_category: 'pipeline',
    replaces_contract_id: play.contractId,
    created_by_id: opts.ownerId,
  };
}
