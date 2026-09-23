/**
 * Logging an activity against a contact from the Contacts list.
 *
 * The dialog on that page was inert: four type buttons with no handler, an
 * uncontrolled notes box, date and follow-up fields nothing read, and a submit
 * button that did nothing. It now writes two things:
 *
 * 1. an activity on the contact's COMPANY timeline
 *    (POST /api/companies/:companyId/activities) - business_record_activities
 *    has no contact column, so the contact is named in the subject; and
 * 2. the contact's own last_contact_date / next_follow_up_date
 *    (PUT /api/company-contacts/:id), which the list's "last contacted" and
 *    follow-up views read.
 *
 * Dates are calendar dates (yyyy-MM-dd on the user's calendar), never instants.
 */

export const ACTIVITY_TYPES = ['note', 'email', 'call', 'meeting'] as const;
export type ContactActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_LABELS: Record<ContactActivityType, string> = {
  note: 'Note',
  email: 'Email',
  call: 'Call',
  meeting: 'Meeting',
};

export interface ContactActivityForm {
  type: ContactActivityType;
  notes: string;
  /** yyyy-MM-dd */
  date: string;
  /** Days after `date` to follow up; 0 means no follow-up. */
  followUpDays: number;
}

/** yyyy-MM-dd plus n calendar days, computed on the calendar, not in UTC. */
export function addDaysToDate(date: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildContactActivity(
  contact: { firstName?: string | null; lastName?: string | null; email?: string | null },
  form: ContactActivityForm,
) {
  const name =
    [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() ||
    contact.email ||
    'contact';
  const followUp = form.followUpDays > 0 ? addDaysToDate(form.date, form.followUpDays) : null;
  return {
    activity: {
      activity_type: form.type,
      subject: `${ACTIVITY_LABELS[form.type]} with ${name}`,
      notes: form.notes.trim() || undefined,
      activity_date: form.date,
      completed_date: form.date,
      follow_up_date: followUp ?? undefined,
    },
    contactPatch: {
      lastContactDate: form.date,
      ...(followUp ? { nextFollowUpDate: followUp } : {}),
    },
  };
}
