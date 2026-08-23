/**
 * QUALITY-002: the Today dashboard's activity formatter, locked against the
 * shape it used to invent.
 *
 * The version this replaces read six field names business_record_activities
 * does not have (title, type, priority, status, customerName, notes). Each was
 * the left side of an `||`, so they resolved to undefined and the fallback won -
 * except priority and status, which had constant fallbacks and therefore
 * emitted 'medium' and 'pending' for every activity in the tenant, regardless
 * of whether the activity was finished.
 */
import { describe, it, expect } from 'vitest';
import { formatActivity } from '../../routes-today-dashboard';

const base = {
  id: 'act-1',
  tenantId: 't-1',
  businessRecordId: 'rec-1',
  companyId: null,
  activityType: 'call',
  subject: 'Follow up on quote',
  description: 'Left a voicemail',
  direction: 'outbound',
  emailFrom: null,
  emailTo: null,
  emailCc: null,
  emailSubject: null,
  emailBody: null,
  isShared: false,
  callDuration: null,
  callOutcome: null,
  scheduledDate: new Date('2026-08-20T15:00:00.000Z'),
  completedDate: null,
  dueDate: new Date('2026-08-21T15:00:00.000Z'),
  outcome: null,
  nextAction: null,
  followUpDate: null,
  relatedRecords: null,
  attachments: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-08-19T00:00:00.000Z'),
  updatedAt: new Date('2026-08-19T00:00:00.000Z'),
};

const names = new Map<string, string | null>([['rec-1', 'Acme Copiers']]);

describe('formatActivity', () => {
  it('reads subject and activity_type, the columns that exist', () => {
    const out = formatActivity(base, names);
    expect(out.title).toBe('Follow up on quote');
    expect(out.type).toBe('call');
    expect(out.notes).toBe('Left a voicemail');
  });

  it('derives status from completed_date instead of asserting pending', () => {
    expect(formatActivity(base, names).status).toBe('pending');
    expect(
      formatActivity({ ...base, completedDate: new Date('2026-08-21T16:00:00.000Z') }, names)
        .status,
    ).toBe('completed');
  });

  it('emits no priority, because no column backs one', () => {
    expect('priority' in formatActivity(base, names)).toBe(false);
  });

  it('resolves the company name from the record map, and omits it when unknown', () => {
    expect(formatActivity(base, names).customerName).toBe('Acme Copiers');
    expect(formatActivity({ ...base, businessRecordId: 'rec-missing' }, names).customerName).toBe(
      undefined,
    );
    expect(formatActivity({ ...base, businessRecordId: null }, names).customerName).toBe(undefined);
  });

  it('falls back only where the column is genuinely empty', () => {
    expect(formatActivity({ ...base, subject: '' }, names).title).toBe('Untitled Activity');
    expect(formatActivity({ ...base, activityType: '' }, names).type).toBe('task');
  });
});
