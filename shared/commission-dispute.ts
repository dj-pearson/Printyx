/**
 * Who may move a commission dispute, and where.
 *
 * A dispute is an employee saying their pay was calculated wrong. Resolving it
 * can mean an adjustment to that pay, so two controls apply, and the second is
 * the one that matters (the deal-desk self-approval rule, SEC-EDGE-001):
 *
 *  1. The actor must be a manager (ROLE_LEVEL.MANAGER = 4).
 *  2. The actor must not be the employee the dispute is about, nor the person
 *     who submitted it - whatever their rank. A manager resolving their own
 *     pay dispute is still resolving their own pay.
 *
 * A dispute that is resolved, rejected or closed does not move again: reopening
 * one would silently undo the adjustment it recorded.
 */

export const DISPUTE_STATUSES = [
  'submitted',
  'under_review',
  'escalated',
  'resolved',
  'rejected',
  'closed',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const TERMINAL_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  'resolved',
  'rejected',
  'closed',
];

export const DISPUTE_MANAGER_LEVEL = 4;

export const DISPUTE_TYPES = [
  'calculation_error',
  'split_commission',
  'chargeback_dispute',
  'rate_dispute',
  'quota_dispute',
  'bonus_dispute',
] as const;

export type DisputeTransition =
  | { ok: true; terminal: boolean }
  | {
      ok: false;
      code: 'INSUFFICIENT_ROLE' | 'SELF_REVIEW' | 'INVALID_STATUS' | 'ALREADY_CLOSED' | 'NO_CHANGE';
      reason: string;
    };

export function decideDisputeTransition(input: {
  actorId: string;
  actorLevel: number;
  dispute: { employeeId: string | null; submittedBy: string | null; status: string };
  nextStatus: string;
}): DisputeTransition {
  const { actorId, actorLevel, dispute, nextStatus } = input;
  if (actorLevel < DISPUTE_MANAGER_LEVEL) {
    return { ok: false, code: 'INSUFFICIENT_ROLE', reason: 'Only a manager can review a dispute.' };
  }
  if (actorId && (actorId === dispute.employeeId || actorId === dispute.submittedBy)) {
    return {
      ok: false,
      code: 'SELF_REVIEW',
      reason: 'You cannot review a dispute about your own commission or one you submitted.',
    };
  }
  if (!(DISPUTE_STATUSES as readonly string[]).includes(nextStatus)) {
    return { ok: false, code: 'INVALID_STATUS', reason: `Unknown status "${nextStatus}".` };
  }
  if ((TERMINAL_DISPUTE_STATUSES as readonly string[]).includes(dispute.status)) {
    return {
      ok: false,
      code: 'ALREADY_CLOSED',
      reason: `This dispute is already ${dispute.status}.`,
    };
  }
  if (nextStatus === dispute.status) {
    return { ok: false, code: 'NO_CHANGE', reason: `The dispute is already ${nextStatus}.` };
  }
  return {
    ok: true,
    terminal: (TERMINAL_DISPUTE_STATUSES as readonly string[]).includes(nextStatus),
  };
}
