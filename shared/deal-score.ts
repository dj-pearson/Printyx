/**
 * Deal health scoring (COP-B11).
 *
 * A pure, inspectable function — deliberately NOT a black box. Every point is
 * attributable to a named factor with a plain-language reason, because a score
 * a rep cannot interrogate is a score they will not trust, and one they cannot
 * argue with is one they will quietly ignore.
 *
 * Two rules this file enforces:
 *
 *  1. NO FABRICATION. If a signal is absent, it does not contribute and it is
 *     reported as unavailable. When too few signals are present the result is
 *     `scored: false` and there is NO number — an invented score is worse than
 *     a blank, because it gets quoted (see CRMX-001, COP-I07).
 *
 *  2. Only signals that exist TODAY. Competitor presence, lease buyout exposure
 *     and forecast category are deliberately absent: those are COP-M04 columns,
 *     which are blocked on the migration tooling (COP-M00). They are listed in
 *     PLANNED_FACTORS so the gap is visible rather than forgotten.
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
}

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

/** Signals this score will gain once COP-M04 lands. Surfaced, not silently dropped. */
export const PLANNED_FACTORS = [
  'incumbent vendor / competitive pressure',
  'lease buyout exposure',
  'forecast category',
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
 * Score a deal from the signals available on it.
 *
 * `now` is injected rather than read from the clock so the result is
 * deterministic and testable.
 */
export function scoreDeal(input: DealScoreInput, now: Date = new Date()): DealScoreResult {
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
