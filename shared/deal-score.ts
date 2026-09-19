/**
 * Deal health scoring (COP-B11).
 *
 * A pure, inspectable function - deliberately NOT a black box. Every point is
 * attributable to a named factor with a plain-language reason, because a score
 * a rep cannot interrogate is a score they will not trust, and one they cannot
 * argue with is one they will quietly ignore.
 *
 * Two rules this file enforces:
 *
 *  1. NO FABRICATION. If a signal is absent, it does not contribute and it is
 *     reported as unavailable. When too few signals are present the result is
 *     `scored: false` and there is NO number - an invented score is worse than
 *     a blank, because it gets quoted (see CRMX-001, COP-I07).
 *
 *  2. A signal is scored only when something produces it. The three COP-M04
 *     copier facts - incumbent vendor, lease buyout exposure and forecast
 *     category - are scored here as of COP-B11's second pass: the columns
 *     landed with COP-M04 and the deals edge function already returns them.
 *
 *     Quote margin is the one exception and it is deliberate. The factor is
 *     implemented and tested, but NOTHING produces `quoteMarginPct` or
 *     `quoteDiscountPct` yet: `proposals` has no deal_id and `crm_associations`
 *     has no quote type, so an account's quote cannot be attributed to one of
 *     its deals. It stays in PLANNED_FACTORS until COP-B02 lands the quotes tab
 *     and with it a real deal-to-quote link. Wiring it to the account's newest
 *     proposal would attribute the wrong quote the moment an account has two
 *     deals, which is the fabrication rule above wearing a join.
 */

/** Minimum number of available signals before a score is meaningful. */
export const MIN_SIGNALS_FOR_SCORE = 3;

export type DealScoreBand = 'strong' | 'steady' | 'at_risk' | 'critical';

export interface DealScoreFactor {
  key: string;
  label: string;
  /** Points contributed. Negative hurts. */
  points: number;
  /** Plain language, shown to the rep verbatim. */
  reason: string;
}

export interface DealRiskFlag {
  key: string;
  /** Plain language. No jargon, no severity codes. */
  message: string;
  severity: 'warning' | 'critical';
}

export interface DealScoreInput {
  status?: string | null;
  amount?: number | string | null;
  probability?: number | null;
  createdAt?: string | Date | null;
  lastActivityDate?: string | Date | null;
  nextFollowUpDate?: string | Date | null;
  expectedCloseDate?: string | Date | null;
  /** When the deal entered its current stage, if known. */
  stageEnteredAt?: string | Date | null;
  /** SLA for the current stage, from pipelineStages.slaDays. */
  stageSlaDays?: number | null;
  /** Contact coverage — how many distinct contacts are attached. */
  contactCount?: number | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  /** COP-M04. The vendor already in the account, when one is named. */
  incumbentVendor?: string | null;
  /** COP-M04. Dollars the customer must absorb to leave their current paper. */
  leaseBuyoutExposure?: number | string | null;
  /** COP-M04. pipeline | best_case | commit | closed. The rep's own call. */
  forecastCategory?: string | null;
  /** Gross margin on the deal's quote, as a percentage. No producer yet - see the header. */
  quoteMarginPct?: number | string | null;
  /** Effective discount on the deal's quote, as a percentage. No producer yet. */
  quoteDiscountPct?: number | string | null;
}

/** Tenant pricing policy, so "over policy" means the tenant's policy and not a guess. */
export interface DealScorePolicy {
  /** pricing_settings.require_approval_below_margin. */
  minMarginPct?: number | null;
  /** company_pricing_settings.max_discount_percentage. 0 or absent = not enforced. */
  maxDiscountPct?: number | null;
}

/** Matches QUOTE-016's server-side default for require_approval_below_margin. */
export const DEFAULT_MIN_MARGIN_PCT = 15;

export interface DealScoreResult {
  /** False when too little is known. Callers must render "not enough signal". */
  scored: boolean;
  /** 0-100. Only meaningful when `scored` is true. */
  score: number;
  band: DealScoreBand;
  factors: DealScoreFactor[];
  risks: DealRiskFlag[];
  /** Signals that were absent, so the UI can say what would improve the read. */
  missingSignals: string[];
}

/**
 * Signals the score is built to use that nothing produces yet. Surfaced rather
 * than silently dropped, so the gap stays visible on the screen that needs it.
 *
 * The three COP-M04 facts that used to sit here are scored now. What remains is
 * quote margin: see the file header for why attributing an account's quote to
 * one of its deals is not available and should not be faked.
 */
export const PLANNED_FACTORS = [
  'quote margin and discount (no deal-to-quote link exists yet)',
] as const;

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function bandFor(score: number): DealScoreBand {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'steady';
  if (score >= 25) return 'at_risk';
  return 'critical';
}

/**
 * Money and percentages arrive as Drizzle decimal strings over the wire, so
 * every numeric signal goes through here. An unparseable value is treated as
 * absent rather than as zero: zero buyout exposure is a fact worth points, and
 * a string that does not parse is not that fact.
 */
function toNumber(value?: number | string | null): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/** The forecast buckets COP-M04 writes, and what each is worth. */
const FORECAST_WEIGHTS: Record<string, { points: number; label: string; reason: string }> = {
  commit: {
    points: 15,
    label: 'Committed',
    reason: 'The rep has committed this deal to the forecast.',
  },
  best_case: {
    points: 5,
    label: 'Best case',
    reason: 'Forecast as best case, not committed.',
  },
  pipeline: {
    points: -5,
    label: 'Pipeline only',
    reason: 'Still pipeline - nobody has forecast this yet.',
  },
};

/**
 * Score a deal from the signals available on it.
 *
 * `now` is injected rather than read from the clock so the result is
 * deterministic and testable.
 */
export function scoreDeal(
  input: DealScoreInput,
  now: Date = new Date(),
  policy: DealScorePolicy = {},
): DealScoreResult {
  const factors: DealScoreFactor[] = [];
  const risks: DealRiskFlag[] = [];
  const missingSignals: string[] = [];

  // Start from neutral; each available signal moves it.
  let score = 50;
  let signalsAvailable = 0;

  // ── Activity recency ────────────────────────────────────────────────
  const lastActivity = toDate(input.lastActivityDate);
  if (lastActivity) {
    signalsAvailable += 1;
    const idle = daysBetween(lastActivity, now);
    if (idle <= 7) {
      factors.push({
        key: 'activity_recent',
        label: 'Recent activity',
        points: 20,
        reason: `Worked ${idle === 0 ? 'today' : `${idle} day${idle === 1 ? '' : 's'} ago`}.`,
      });
      score += 20;
    } else if (idle <= 21) {
      factors.push({
        key: 'activity_slowing',
        label: 'Activity slowing',
        points: -5,
        reason: `No activity for ${idle} days.`,
      });
      score -= 5;
    } else {
      factors.push({
        key: 'activity_stalled',
        label: 'Gone quiet',
        points: -25,
        reason: `No activity for ${idle} days.`,
      });
      score -= 25;
      risks.push({
        key: 'gone_quiet',
        severity: idle > 45 ? 'critical' : 'warning',
        message: `Nothing has happened on this deal in ${idle} days.`,
      });
    }
  } else {
    missingSignals.push('last activity date');
  }

  // ── Next step ───────────────────────────────────────────────────────
  const nextStep = toDate(input.nextFollowUpDate);
  if (nextStep) {
    signalsAvailable += 1;
    const overdueBy = daysBetween(nextStep, now);
    if (overdueBy > 0) {
      factors.push({
        key: 'next_step_overdue',
        label: 'Next step overdue',
        points: -15,
        reason: `The scheduled follow-up was ${overdueBy} day${overdueBy === 1 ? '' : 's'} ago.`,
      });
      score -= 15;
      risks.push({
        key: 'next_step_overdue',
        severity: 'warning',
        message: `Follow-up is ${overdueBy} day${overdueBy === 1 ? '' : 's'} overdue.`,
      });
    } else {
      factors.push({
        key: 'next_step_set',
        label: 'Next step booked',
        points: 10,
        reason: 'A follow-up is scheduled.',
      });
      score += 10;
    }
  } else {
    missingSignals.push('next step');
    risks.push({
      key: 'no_next_step',
      severity: 'warning',
      message: 'No next step is scheduled on this deal.',
    });
  }

  // ── Close date realism ──────────────────────────────────────────────
  const closeDate = toDate(input.expectedCloseDate);
  if (closeDate) {
    signalsAvailable += 1;
    const past = daysBetween(closeDate, now);
    if (past > 0 && (!input.status || input.status === 'open')) {
      factors.push({
        key: 'close_date_passed',
        label: 'Close date passed',
        points: -20,
        reason: `Expected close was ${past} day${past === 1 ? '' : 's'} ago and the deal is still open.`,
      });
      score -= 20;
      risks.push({
        key: 'close_date_passed',
        severity: past > 30 ? 'critical' : 'warning',
        message: `Expected close date passed ${past} day${past === 1 ? '' : 's'} ago.`,
      });
    }
  } else {
    missingSignals.push('expected close date');
  }

  // ── Stage age vs SLA ────────────────────────────────────────────────
  const stageEntered = toDate(input.stageEnteredAt);
  if (stageEntered && input.stageSlaDays && input.stageSlaDays > 0) {
    signalsAvailable += 1;
    const inStage = daysBetween(stageEntered, now);
    if (inStage > input.stageSlaDays) {
      const over = inStage - input.stageSlaDays;
      factors.push({
        key: 'stage_sla_breached',
        label: 'Past stage SLA',
        points: -15,
        reason: `${inStage} days in this stage, ${over} over the ${input.stageSlaDays}-day target.`,
      });
      score -= 15;
      risks.push({
        key: 'stage_sla_breached',
        severity: 'warning',
        message: `Stuck in this stage ${over} day${over === 1 ? '' : 's'} past its target.`,
      });
    } else {
      factors.push({
        key: 'stage_on_track',
        label: 'On pace for stage',
        points: 5,
        reason: `${inStage} of ${input.stageSlaDays} days used in this stage.`,
      });
      score += 5;
    }
  } else {
    missingSignals.push('stage SLA');
  }

  // ── Contact coverage (single-threading) ─────────────────────────────
  const contacts = input.contactCount;
  const hasAnyContact = Boolean(input.primaryContactEmail || input.primaryContactPhone);
  if (contacts != null) {
    signalsAvailable += 1;
    if (contacts >= 3) {
      factors.push({
        key: 'multi_threaded',
        label: 'Multi-threaded',
        points: 15,
        reason: `${contacts} contacts engaged.`,
      });
      score += 15;
    } else if (contacts <= 1) {
      factors.push({
        key: 'single_threaded',
        label: 'Single-threaded',
        points: -10,
        reason:
          contacts === 0 ? 'No contacts attached to this deal.' : 'Only one contact is engaged.',
      });
      score -= 10;
      risks.push({
        key: 'single_threaded',
        severity: contacts === 0 ? 'critical' : 'warning',
        message:
          contacts === 0
            ? 'Nobody is attached to this deal.'
            : 'Only one contact is engaged — the deal depends on a single person.',
      });
    }
  } else if (!hasAnyContact) {
    risks.push({
      key: 'no_contact_details',
      severity: 'warning',
      message: 'No email or phone on this deal.',
    });
  } else {
    missingSignals.push('contact coverage');
  }

  // ── Competitive pressure (COP-M04 incumbentVendor) ──────────────────
  // A named incumbent means this is a takeaway, not a greenfield sale: there is
  // a relationship to displace and usually paper to break. It costs points, it
  // is not a risk flag - competition is the normal state of a copier deal, and
  // flagging it as a risk would train reps to ignore the flags that matter.
  const incumbent = input.incumbentVendor?.trim();
  if (incumbent) {
    signalsAvailable += 1;
    factors.push({
      key: 'incumbent_present',
      label: 'Competitive takeaway',
      points: -8,
      reason: `${incumbent} is the incumbent - this is a displacement, not a greenfield sale.`,
    });
    score -= 8;
  } else {
    missingSignals.push('incumbent vendor');
  }

  // ── Lease buyout exposure (COP-M04) ─────────────────────────────────
  // Dollars the customer has to absorb to leave their current paper. Scored
  // against the deal size where one is known, because a $4k buyout on a $200k
  // fleet refresh and the same buyout on a $12k single-unit deal are different
  // conversations. Zero is a real answer and earns points.
  const buyout = toNumber(input.leaseBuyoutExposure);
  if (buyout != null) {
    signalsAvailable += 1;
    const dealAmount = toNumber(input.amount);
    const ratio = dealAmount && dealAmount > 0 ? buyout / dealAmount : null;
    if (buyout <= 0) {
      factors.push({
        key: 'no_buyout',
        label: 'No buyout to absorb',
        points: 5,
        reason: 'The customer is out of term or already owns the fleet.',
      });
      score += 5;
    } else if (ratio != null && ratio >= 0.25) {
      const pct = Math.round(ratio * 100);
      factors.push({
        key: 'buyout_heavy',
        label: 'Heavy buyout exposure',
        points: -15,
        reason: `${money(buyout)} to break the current lease - ${pct}% of the deal.`,
      });
      score -= 15;
      risks.push({
        key: 'buyout_heavy',
        severity: ratio >= 0.5 ? 'critical' : 'warning',
        message: `The customer carries ${money(buyout)} of buyout, ${pct}% of the deal's value. Somebody has to absorb it.`,
      });
    } else {
      factors.push({
        key: 'buyout_present',
        label: 'Buyout to absorb',
        points: -5,
        reason: `${money(buyout)} remaining on the current lease.`,
      });
      score -= 5;
    }
  } else {
    missingSignals.push('lease buyout exposure');
  }

  // ── Forecast category (COP-M04) ─────────────────────────────────────
  // The rep's own judgement, which is exactly why it is worth points: a deal
  // nobody will commit to is a deal the person closest to it does not believe.
  // 'closed' carries no weight - status already says that.
  const forecast = input.forecastCategory?.trim().toLowerCase();
  if (forecast) {
    const weight = FORECAST_WEIGHTS[forecast];
    if (weight) {
      signalsAvailable += 1;
      factors.push({
        key: `forecast_${forecast}`,
        label: weight.label,
        points: weight.points,
        reason: weight.reason,
      });
      score += weight.points;
    }
  } else {
    missingSignals.push('forecast category');
  }

  // ── Quote margin and discount ───────────────────────────────────────
  // Implemented and tested; nothing produces these yet (see the file header).
  // The policy thresholds come from the tenant so "over policy" means the
  // tenant's policy, never a number picked here.
  const marginPct = toNumber(input.quoteMarginPct);
  const discountPct = toNumber(input.quoteDiscountPct);
  const minMargin = toNumber(policy.minMarginPct) ?? DEFAULT_MIN_MARGIN_PCT;
  const maxDiscount = toNumber(policy.maxDiscountPct);

  if (marginPct != null) {
    signalsAvailable += 1;
    if (marginPct < minMargin) {
      factors.push({
        key: 'margin_below_policy',
        label: 'Margin below policy',
        points: -15,
        reason: `${marginPct.toFixed(1)}% margin against a ${minMargin}% floor.`,
      });
      score -= 15;
      risks.push({
        key: 'margin_below_policy',
        severity: marginPct < 0 ? 'critical' : 'warning',
        message: `The quote carries ${marginPct.toFixed(1)}% margin, under the ${minMargin}% approval floor.`,
      });
    } else {
      factors.push({
        key: 'margin_healthy',
        label: 'Margin holds',
        points: 10,
        reason: `${marginPct.toFixed(1)}% margin, above the ${minMargin}% floor.`,
      });
      score += 10;
    }
  } else {
    missingSignals.push('quote margin');
  }

  // Discount is a risk flag rather than a factor: the margin above already
  // prices the concession, and charging for it twice would double-count one
  // decision. A discount over policy is still worth saying out loud.
  if (discountPct != null && maxDiscount != null && maxDiscount > 0 && discountPct > maxDiscount) {
    risks.push({
      key: 'discount_over_policy',
      severity: 'warning',
      message: `Discount is ${discountPct.toFixed(1)}%, over the ${maxDiscount}% this tenant allows without approval.`,
    });
  }

  // Not enough to say anything honest.
  if (signalsAvailable < MIN_SIGNALS_FOR_SCORE) {
    return {
      scored: false,
      score: 0,
      band: 'steady',
      factors,
      risks,
      missingSignals,
    };
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    scored: true,
    score: clamped,
    band: bandFor(clamped),
    factors,
    risks,
    missingSignals,
  };
}
