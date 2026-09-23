import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addDaysToDate,
  buildContactActivity,
  type ContactActivityForm,
} from '../../../client/src/lib/contact-activity';

/**
 * Round 191. The Contacts page's Log Activity dialog was inert (type buttons,
 * notes, date and follow-up unbound; submit did nothing), Export and Import had
 * no handlers, and "Add view (4/5)" offered a feature that does not exist with
 * a count nobody computed.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(readFileSync(join(root, 'client/src/pages/Contacts.tsx'), 'utf8'));
const COMPANIES = strip(readFileSync(join(root, 'supabase/functions/companies/index.ts'), 'utf8'));
const CONTACTS_FN = strip(
  readFileSync(join(root, 'supabase/functions/company-contacts/index.ts'), 'utf8'),
);

const form = (over: Partial<ContactActivityForm> = {}): ContactActivityForm => ({
  type: 'call',
  notes: '  discussed renewal  ',
  date: '2026-09-23',
  followUpDays: 7,
  ...over,
});

describe('addDaysToDate', () => {
  it('steps calendar days across month and year ends', () => {
    expect(addDaysToDate('2026-09-23', 7)).toBe('2026-09-30');
    expect(addDaysToDate('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDate('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('refuses something that is not a calendar date', () => {
    expect(addDaysToDate('2026-09-23T10:00:00Z', 1)).toBeNull();
    expect(addDaysToDate('', 1)).toBeNull();
  });
});

describe('buildContactActivity', () => {
  it('names the contact in the subject and trims the notes', () => {
    const { activity } = buildContactActivity({ firstName: 'Dana', lastName: 'Lee' }, form());
    expect(activity.subject).toBe('Call with Dana Lee');
    expect(activity.notes).toBe('discussed renewal');
    expect(activity.activity_type).toBe('call');
    expect(activity.completed_date).toBe('2026-09-23');
  });
  it('falls back to the email when there is no name', () => {
    const { activity } = buildContactActivity({ email: 'x@y.com' }, form({ type: 'note' }));
    expect(activity.subject).toBe('Note with x@y.com');
  });
  it('sets the follow-up on both the activity and the contact', () => {
    const { activity, contactPatch } = buildContactActivity({ firstName: 'A' }, form());
    expect(activity.follow_up_date).toBe('2026-09-30');
    expect(contactPatch).toEqual({ lastContactDate: '2026-09-23', nextFollowUpDate: '2026-09-30' });
  });
  it('leaves an existing follow-up alone when none is chosen', () => {
    const { activity, contactPatch } = buildContactActivity(
      { firstName: 'A' },
      form({ followUpDays: 0 }),
    );
    expect(activity.follow_up_date).toBeUndefined();
    expect(contactPatch).toEqual({ lastContactDate: '2026-09-23' });
  });
  it('sends only fields the two endpoints read', () => {
    const { activity, contactPatch } = buildContactActivity({ firstName: 'A' }, form());
    for (const k of Object.keys(activity)) {
      expect(COMPANIES, k).toContain(`body.${k}`);
    }
    for (const k of Object.keys(contactPatch)) {
      expect(CONTACTS_FN, k).toContain(`body.${k}`);
    }
  });
});

describe('the page', () => {
  it('submits the dialog through the mutation', () => {
    expect(PAGE).toMatch(
      /logActivityMutation\.mutate\(\{ contact: selectedContact, form: activityForm \}\)/,
    );
    expect(PAGE).toMatch(
      /apiRequest\(`\/api\/companies\/\$\{contact\.companyId\}\/activities`, 'POST'/,
    );
    expect(PAGE).toMatch(/apiRequest\(`\/api\/company-contacts\/\$\{contact\.id\}`, 'PUT'/);
    expect(PAGE).toMatch(/value=\{activityForm\.notes\}/);
    expect(PAGE).not.toMatch(/defaultValue=\{todayLocalDate\(\)\}/);
  });
  it('wires Export and Import and drops the fake view counter', () => {
    expect(PAGE).toMatch(/exportToCSV\(contacts, CONTACTS_PAGE_EXPORT_COLUMNS/);
    expect(PAGE).toContain('Export this page');
    expect(PAGE).toMatch(/<Link href="\/import"/);
    expect(PAGE).not.toContain('Add view');
  });
});
