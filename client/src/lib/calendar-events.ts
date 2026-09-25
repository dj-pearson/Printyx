/**
 * Calendar rows as the /calendar page reads them (round 219).
 *
 * GET /api/meetings/calendar/events answers raw calendar_events rows in
 * snake_case and requires a start and an end. The calendar used to render a
 * hardcoded list of four events (a "Follow up with ABC Corp" call at 85% AI
 * confidence among them) and never asked the endpoint anything.
 */
import { addMonths, startOfMonth } from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location: string | null;
  attendees: string[];
  status: string;
  eventType: string;
  isAiGenerated: boolean;
  aiConfidence: number | null;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** A synced Google attendee is an object; an Outlook one is an address string. */
function attendeeLabel(a: unknown): string | null {
  if (typeof a === 'string') return a || null;
  if (a && typeof a === 'object') {
    const o = a as Row;
    return str(o.email) ?? str(o.displayName) ?? null;
  }
  return null;
}

export function calendarEventFromRow(row: Row): CalendarEvent {
  const attendees = Array.isArray(row.attendees)
    ? row.attendees.map(attendeeLabel).filter((a): a is string => a !== null)
    : [];
  // numeric(3,2) arrives as a string from PostgREST; a missing or junk value
  // is no confidence rather than 0%.
  const conf = row.ai_confidence == null ? NaN : Number(row.ai_confidence);
  return {
    id: String(row.id),
    title: str(row.title) ?? 'Untitled event',
    description: str(row.description),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    isAllDay: row.is_all_day === true,
    location: str(row.location),
    attendees,
    status: str(row.status) ?? 'confirmed',
    eventType: str(row.event_type) ?? 'meeting',
    isAiGenerated: row.is_ai_generated === true,
    aiConfidence: Number.isFinite(conf) ? conf : null,
  };
}

/** The month shown, as the start/end the endpoint requires. */
export function monthEventsUrl(month: Date): string {
  const start = startOfMonth(month);
  const end = startOfMonth(addMonths(month, 1));
  const q = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  return `/api/meetings/calendar/events?${q.toString()}`;
}

export interface SyncResult {
  status?: string;
  eventsSynced?: number;
  eventsCreated?: number;
  eventsUpdated?: number;
  error?: string | null;
}

/** What a sync actually did, from the counts the endpoint measured. */
export function syncSummary(r: SyncResult): string {
  if (r.status && r.status !== 'success') return r.error || 'The provider refused the sync.';
  const n = r.eventsSynced ?? 0;
  if (n === 0) return 'No events in the last or next 30 days.';
  return `${n} event${n === 1 ? '' : 's'} synced (${r.eventsCreated ?? 0} new, ${r.eventsUpdated ?? 0} updated).`;
}
