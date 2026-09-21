/**
 * BANT scoring, in one place (WF-S-09).
 *
 * Budget, Authority, Need and Timeline each contribute at most 25 points, and
 * the total decides a qualification status. That arithmetic existed TWICE - in
 * `supabase/functions/lead-scoring/handlers/bant.ts`, which is what gets
 * stored, and in `BANTAssessment.tsx`'s `calculateEstimatedScore`, which is the
 * live preview a rep watches while filling the form. The two agreed when this
 * was written and nothing held them together, so the first change to either
 * would have made the preview a number the server does not produce - which is
 * the worse failure, because a rep reads the preview as the answer and the
 * server's answer is the one that reaches the pipeline.
 *
 * ONE MODULE RATHER THAN A PARITY TEST. Deno imports this by relative path
 * (`../../../shared/bant-score.ts`, the `shared/seo-checks.ts` precedent) and
 * the client through `@shared/bant-score`, so there is nothing to keep in sync.
 *
 * THE VOCABULARY IS STORED, NOT DISPLAYED. `qualification_status` holds
 * `unqualified | partially_qualified | qualified | highly_qualified`, and the
 * label is derived here too, so a screen never writes its own spelling of a
 * stored value (COP-E02's two-stage-vocabularies defect).
 */

export type QualificationStatus =
  | 'unqualified'
  | 'partially_qualified'
  | 'qualified'
  | 'highly_qualified';

export interface BantSignals {
  budgetIdentified?: boolean;
  budgetApproved?: boolean;
  decisionMakerIdentified?: boolean;
  needIdentified?: boolean;
  /** Free text; only 'critical' and 'high' change the score. */
  needUrgency?: string | null;
  timelineIdentified?: boolean;
  /** Free text; only 'immediate' and '30_days' change the score. */
  decisionTimeline?: string | null;
}

export interface BantScores {
  budgetScore: number;
  authorityScore: number;
  needScore: number;
  timelineScore: number;
  total: number;
  status: QualificationStatus;
}

/** Each pillar is worth this much, so a full assessment totals 100. */
export const PILLAR_MAX = 25;

const lower = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * A pillar that was NOT identified scores zero, which is the honest reading:
 * the rep has not established it. An identified pillar with no detail still
 * scores, because knowing a budget exists is worth something even before the
 * amount is approved.
 */
export function scoreBant(signals: BantSignals): BantScores {
  const budgetScore = signals.budgetIdentified ? (signals.budgetApproved ? 25 : 15) : 0;
  const authorityScore = signals.decisionMakerIdentified ? 25 : 0;

  const urgency = lower(signals.needUrgency);
  const needScore = signals.needIdentified
    ? urgency === 'critical'
      ? 25
      : urgency === 'high'
        ? 20
        : 15
    : 0;

  const timeline = lower(signals.decisionTimeline);
  const timelineScore = signals.timelineIdentified
    ? timeline === 'immediate'
      ? 25
      : timeline === '30_days'
        ? 20
        : 15
    : 0;

  const total = budgetScore + authorityScore + needScore + timelineScore;
  return {
    budgetScore,
    authorityScore,
    needScore,
    timelineScore,
    total,
    status: statusForScore(total),
  };
}

export function statusForScore(total: number): QualificationStatus {
  if (total >= 75) return 'highly_qualified';
  if (total >= 50) return 'qualified';
  if (total >= 25) return 'partially_qualified';
  return 'unqualified';
}

/**
 * The label for a STORED status, never for a score. A row written before a
 * threshold moved keeps the status it was saved with, and re-deriving the
 * label from the number would relabel history.
 */
export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'highly_qualified':
      return 'Highly Qualified';
    case 'qualified':
      return 'Qualified';
    case 'partially_qualified':
      return 'Partially Qualified';
    case 'unqualified':
      return 'Unqualified';
    default:
      // An unrecognised value is shown as itself rather than dropped, so a
      // vocabulary that grows on the server is visible rather than silent.
      return status ? String(status).replace(/_/g, ' ') : 'Not assessed';
  }
}

/** Tailwind classes per status, kept beside the vocabulary that picks them. */
export function statusTone(status: string | null | undefined): string {
  switch (status) {
    case 'highly_qualified':
      return 'bg-green-100 text-green-800';
    case 'qualified':
      return 'bg-blue-100 text-blue-800';
    case 'partially_qualified':
      return 'bg-yellow-100 text-yellow-800';
    case 'unqualified':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
