/**
 * Email-sequence events as timeline activities (WF-S-04).
 *
 * Enrolling a lead in a drip sequence is something that HAPPENED TO THAT LEAD,
 * and until now nothing recorded it anywhere the lead could be read from:
 * email_sequence_enrollments knew, and the lead's own timeline did not. A rep
 * opening a record could not tell whether it was already being nurtured, which
 * is how the same person gets enrolled twice by two reps and emailed twice.
 *
 * Three producers, three runtimes-worth of callers, one row shape:
 *   enrolment and un-enrolment  -> supabase/functions/email-sequences (Deno)
 *   each send                   -> server/services/email-sequence-scheduler (Node)
 *
 * This module is pure and has no Deno or Node globals, so the scheduler imports
 * it directly rather than keeping a second copy - the same arrangement
 * server/services/lifecycle-activation-effects.ts has with
 * _shared/lifecycle-activation.ts. A duplicate would drift, and the whole point
 * is that the three events read as one story on the timeline.
 *
 * activity_type is 'email' for all three, which is what ActivityTimeline knows
 * how to draw. A new vocabulary word would fall through its switch to the
 * default note icon and look like something else.
 */

export interface SequenceActivityRow {
  tenant_id: string;
  business_record_id: string;
  activity_type: 'email';
  subject: string;
  description: string;
  direction: string | null;
  completed_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface BaseInput {
  tenantId: string;
  businessRecordId: string;
  campaignName?: string | null;
  recipientEmail: string;
  /**
   * business_record_activities.created_by is NOT NULL, so there is no such
   * thing as an authorless activity here. Every builder returns null rather
   * than a row when it is missing, and the caller writes nothing - a 23502 on
   * the insert would be a timeline write that fails at runtime only, which is
   * exactly the class of defect this repo keeps finding.
   *
   * The scheduler has no request user, so it passes the enroller: the nearest
   * true answer to "who caused this send".
   */
  userId?: string | null;
  at?: Date;
}

/** A campaign with no name is described by what it is, not by an empty string. */
function describeCampaign(name: string | null | undefined): string {
  const trimmed = String(name ?? '').trim();
  return trimmed || 'an unnamed sequence';
}

function iso(at: Date | undefined): string {
  return (at ?? new Date()).toISOString();
}

function base(input: BaseInput, extras: Partial<SequenceActivityRow>): SequenceActivityRow | null {
  const author = String(input.userId ?? '').trim();
  if (!input.tenantId || !input.businessRecordId || !author) return null;
  const when = iso(input.at);
  return {
    tenant_id: input.tenantId,
    business_record_id: input.businessRecordId,
    activity_type: 'email',
    subject: '',
    description: '',
    direction: null,
    completed_date: when,
    created_by: author,
    created_at: when,
    updated_at: when,
    ...extras,
  };
}

export function sequenceEnrollmentActivity(input: BaseInput): SequenceActivityRow | null {
  const campaign = describeCampaign(input.campaignName);
  return base(input, {
    subject: `Enrolled in ${campaign}`,
    description: `${input.recipientEmail} was enrolled in the email sequence "${campaign}".`,
  });
}

export function sequenceUnenrollmentActivity(
  input: BaseInput & { reason?: string | null },
): SequenceActivityRow | null {
  const campaign = describeCampaign(input.campaignName);
  // The reason matters on this one: 'manual' and 'bounced' are different
  // stories about the same contact, and a timeline that says only "removed"
  // loses the second.
  const reason = String(input.reason ?? '').trim() || 'manual';
  return base(input, {
    subject: `Removed from ${campaign}`,
    description: `${input.recipientEmail} was un-enrolled from "${campaign}" (${reason}).`,
  });
}

export function sequenceSendActivity(
  input: BaseInput & { step: number; status: 'sent' | 'failed'; error?: string | null },
): SequenceActivityRow | null {
  const campaign = describeCampaign(input.campaignName);
  // Steps are stored zero-based and read one-based: a rep counting emails
  // starts at one, and "step 0 sent" reads as nothing having been sent.
  const stepLabel = `step ${input.step + 1}`;
  const failed = input.status === 'failed';
  const detail = failed ? String(input.error ?? '').trim() : '';
  return base(input, {
    subject: failed ? `Sequence email failed (${stepLabel})` : `Sequence email sent (${stepLabel})`,
    description: failed
      ? `"${campaign}" ${stepLabel} to ${input.recipientEmail} failed${detail ? `: ${detail}` : '.'}`
      : `"${campaign}" ${stepLabel} was sent to ${input.recipientEmail}.`,
    direction: 'outbound',
  });
}

/**
 * The same row as Drizzle wants it: camelCase keys and a Date for the
 * timestamp. Drizzle iterates the TABLE's columns and picks each one out of the
 * object, so handing it the snake_case row would drop EVERY field silently and
 * fail on the NOT NULL ones - the defect CLAUDE.md records for the Apollo
 * handler, arriving from the other direction.
 */
export function toDrizzleActivity(row: SequenceActivityRow | null) {
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    businessRecordId: row.business_record_id,
    activityType: row.activity_type,
    subject: row.subject,
    description: row.description,
    direction: row.direction,
    completedDate: new Date(row.completed_date),
    createdBy: row.created_by,
  };
}
