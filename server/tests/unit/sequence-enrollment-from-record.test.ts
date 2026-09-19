/**
 * Enrolling a lead in a sequence, from the lead (WF-S-04).
 *
 * The enrol/unenrol endpoints, the step state machine and the SendGrid send
 * have worked since CRMX-009. The only surface that could reach them was
 * EmailSequencesPage - a standalone campaign screen - so a rep looking at a
 * lead had to leave the record, find the campaign and type the address back in.
 * The capability existed and nothing in the funnel could use it.
 *
 * The timeline half matters as much: email_sequence_enrollments knew a lead was
 * being nurtured and the lead's own record did not, which is how the same
 * person gets enrolled twice by two reps and emailed twice.
 */
import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { businessRecordActivities } from '../../../shared/schema';
import {
  sequenceEnrollmentActivity,
  sequenceSendActivity,
  sequenceUnenrollmentActivity,
  toDrizzleActivity,
} from '../../../supabase/functions/_shared/sequence-activity.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const BASE = {
  tenantId: 't1',
  businessRecordId: 'rec-1',
  recipientEmail: 'dana@example.com',
  campaignName: 'Q4 fleet refresh',
  userId: 'user-1',
  at: new Date('2026-09-18T12:00:00.000Z'),
};

describe('the activity row is writable', () => {
  it('every key is a column on business_record_activities', () => {
    const cols = Object.values(getTableColumns(businessRecordActivities)).map((c) => c.name);
    const row = sequenceEnrollmentActivity(BASE)!;
    for (const key of Object.keys(row)) {
      expect(cols, `${key} is not a column`).toContain(key);
    }
  });

  it('created_by is NOT NULL, so an authorless event writes nothing', () => {
    // A 23502 here would be a timeline write that fails at runtime only, which
    // is the class of defect this repo keeps finding. The builders refuse
    // instead, and the callers check.
    const col = Object.values(getTableColumns(businessRecordActivities)).find(
      (c) => c.name === 'created_by',
    );
    expect(col?.notNull).toBe(true);
    expect(sequenceEnrollmentActivity({ ...BASE, userId: null })).toBe(null);
    expect(sequenceSendActivity({ ...BASE, userId: '  ', step: 0, status: 'sent' })).toBe(null);
    expect(sequenceUnenrollmentActivity({ ...BASE, userId: undefined })).toBe(null);
  });

  it('a missing record or tenant writes nothing either', () => {
    expect(sequenceEnrollmentActivity({ ...BASE, businessRecordId: '' })).toBe(null);
    expect(sequenceEnrollmentActivity({ ...BASE, tenantId: '' })).toBe(null);
  });

  it('activity_type is one ActivityTimeline can draw', () => {
    // A new vocabulary word falls through the component's switch to the default
    // note icon and reads as something else entirely.
    const timeline = read('client/src/components/ActivityTimeline.tsx');
    expect(timeline).toContain("case 'email':");
    expect(sequenceEnrollmentActivity(BASE)!.activity_type).toBe('email');
  });
});

describe('the three events read as one story', () => {
  it('enrolment names the campaign', () => {
    const row = sequenceEnrollmentActivity(BASE)!;
    expect(row.subject).toBe('Enrolled in Q4 fleet refresh');
    expect(row.description).toContain('dana@example.com');
  });

  it('un-enrolment keeps the reason', () => {
    // 'manual' and 'bounced' are different stories about the same contact, and
    // a timeline that says only "removed" loses the second.
    const row = sequenceUnenrollmentActivity({ ...BASE, reason: 'bounced' })!;
    expect(row.subject).toBe('Removed from Q4 fleet refresh');
    expect(row.description).toContain('bounced');
    expect(sequenceUnenrollmentActivity({ ...BASE, reason: null })!.description).toContain(
      'manual',
    );
  });

  it('a send counts steps from one', () => {
    // Steps are stored zero-based. "step 0 sent" reads as nothing having
    // been sent.
    expect(sequenceSendActivity({ ...BASE, step: 0, status: 'sent' })!.subject).toBe(
      'Sequence email sent (step 1)',
    );
  });

  it('a failed send says so, with the error when there is one', () => {
    const row = sequenceSendActivity({
      ...BASE,
      step: 2,
      status: 'failed',
      error: 'mailbox full',
    })!;
    expect(row.subject).toContain('failed');
    expect(row.description).toContain('mailbox full');
  });

  it('a campaign with no name is described, not left blank', () => {
    expect(sequenceEnrollmentActivity({ ...BASE, campaignName: '  ' })!.subject).toBe(
      'Enrolled in an unnamed sequence',
    );
  });
});

describe('toDrizzleActivity', () => {
  it('converts to the camelCase keys Drizzle picks out', () => {
    // Drizzle iterates the TABLE's columns and picks each one out of the
    // object, so handing it the snake_case row would drop every field silently
    // and fail on the NOT NULL ones.
    const row = toDrizzleActivity(sequenceEnrollmentActivity(BASE))!;
    expect(row).toMatchObject({
      tenantId: 't1',
      businessRecordId: 'rec-1',
      activityType: 'email',
      createdBy: 'user-1',
    });
    expect(row.completedDate).toBeInstanceOf(Date);
    expect(Object.keys(row).some((k) => k.includes('_'))).toBe(false);
  });

  it('passes null through, so a refused row stays refused', () => {
    expect(toDrizzleActivity(null)).toBe(null);
  });
});

describe('the producers are wired', () => {
  const edge = code('supabase/functions/email-sequences/index.ts');
  const scheduler = code('server/services/email-sequence-scheduler.ts');

  it('the edge function records enrolment and un-enrolment', () => {
    expect(edge).toContain('sequenceEnrollmentActivity(');
    expect(edge).toContain('sequenceUnenrollmentActivity(');
    expect(edge).toContain("from('business_record_activities')");
  });

  it('it only records when the recipient IS a record', () => {
    // An enrollment typed in as a bare address has no timeline to land on, and
    // inventing a business record for it would be worse than the gap.
    expect(edge).toContain('if (recipient.businessRecordId)');
  });

  it('the scheduler imports the shared builder rather than copying it', () => {
    // A second copy drifts, and the whole point is that enrolment and each send
    // read as one story.
    expect(scheduler).toContain('supabase/functions/_shared/sequence-activity');
    expect(scheduler).toContain('sequenceSendActivity(');
    expect(scheduler).toContain('toDrizzleActivity(');
  });

  it('a failed timeline write never fails the thing it describes', () => {
    // Enrolling someone succeeded even if the timeline write did not, and a
    // delivered email must not be retried because of it.
    expect(edge).toContain('Sequence timeline write failed');
    expect(scheduler).toContain('timeline write failed');
  });
});

describe('the funnel surfaces offer it', () => {
  const dialog = code('client/src/components/leads/EnrollInSequenceDialog.tsx');

  it('all three surfaces render the dialog', () => {
    for (const file of [
      'client/src/pages/LeadDetail.tsx',
      'client/src/pages/BusinessRecordDetail.tsx',
      'client/src/components/crm/BusinessRecordsDataTable.tsx',
    ]) {
      expect(code(file), `${file} does not offer it`).toContain('EnrollInSequenceDialog');
    }
  });

  it('the bulk action reads rows it already has, not ids to re-fetch', () => {
    const table = code('client/src/components/crm/BusinessRecordsDataTable.tsx');
    expect(table).toContain("id: 'enroll-sequence'");
    expect(table).toContain('new Map(records.map(');
  });

  it('only sequence campaigns are offered', () => {
    // A one-off blast has no steps, so enrolling into it completes immediately
    // and sends nothing - which reads to the rep as a sequence that silently
    // did not work.
    expect(dialog).toContain("['drip', 'automated']");
  });

  it('a record with no address is reported rather than dropped', () => {
    // The endpoint rejects the WHOLE batch if any recipient has no valid email.
    expect(dialog).toContain('have no email address and will be left out');
  });

  it('the result says how many were skipped, not just how many were added', () => {
    // "Already enrolled" and "unsubscribed" both come back as enrolled:false,
    // and a count of successes alone hides them (the AUDIT-038 shape).
    expect(dialog).toContain('skipped');
    expect(dialog).toContain('already enrolled or unsubscribed');
  });
});

describe('the enrollment list names the record', () => {
  const edge = code('supabase/functions/email-sequences/index.ts');

  it('both tables are tried, because WF-S-01 is unsettled', () => {
    // /api/leads serves LeadDetail from business_records; the CRM list serves
    // companies. An enrollment's business_record_id can have been minted by
    // either.
    expect(edge).toContain("for (const table of ['business_records', 'companies'])");
  });

  it('one query per table, not one per row', () => {
    expect(edge).toContain(".in('id', recordIds)");
  });

  it('an unresolved record keeps a null name rather than borrowing its email', () => {
    // A list that silently shows an address where a name should be cannot be
    // told from one where the name is missing.
    expect(edge).toContain('businessRecordName');
    expect(edge).not.toMatch(/businessRecordName:.*recipientEmail/);
  });
});
