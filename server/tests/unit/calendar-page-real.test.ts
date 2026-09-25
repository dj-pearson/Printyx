import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calendarEventFromRow, monthEventsUrl, syncSummary } from '@/lib/calendar-events';

const root = resolve(__dirname, '../../..');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGE = strip(readFileSync(resolve(root, 'client/src/pages/CalendarPage.tsx'), 'utf8'));
const VIEW = strip(
  readFileSync(resolve(root, 'client/src/components/calendar/CalendarView.tsx'), 'utf8'),
);
const EVENTS = readFileSync(
  resolve(root, 'supabase/functions/meetings/handlers/events.ts'),
  'utf8',
);

describe('calendar rows (round 219)', () => {
  it('maps a snake_case calendar_events row to what the grid reads', () => {
    const ev = calendarEventFromRow({
      id: 'e1',
      title: 'QBR',
      start_time: '2026-09-03T15:00:00Z',
      end_time: '2026-09-03T16:00:00Z',
      is_all_day: false,
      location: '',
      attendees: [{ email: 'a@x.com' }, 'b@x.com', { displayName: 'C' }, 7],
      event_type: 'meeting',
      is_ai_generated: true,
      ai_confidence: '0.80',
    });
    expect(ev).toMatchObject({
      id: 'e1',
      title: 'QBR',
      startTime: '2026-09-03T15:00:00Z',
      location: null,
      attendees: ['a@x.com', 'b@x.com', 'C'],
      isAiGenerated: true,
      aiConfidence: 0.8,
    });
  });

  it('a missing confidence is null, not 0%, and a missing type is not an AI event', () => {
    const ev = calendarEventFromRow({ id: 'e', start_time: 'x', end_time: 'y' });
    expect(ev.aiConfidence).toBeNull();
    expect(ev.isAiGenerated).toBe(false);
    expect(ev.title).toBe('Untitled event');
    expect(ev.attendees).toEqual([]);
  });

  it('asks for the whole month shown, start and end both, as the endpoint requires', () => {
    const u = new URL(monthEventsUrl(new Date(2026, 8, 17)), 'http://x');
    expect(u.pathname).toBe('/api/meetings/calendar/events');
    const start = new Date(u.searchParams.get('start')!);
    const end = new Date(u.searchParams.get('end')!);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(8);
    expect(end.getMonth()).toBe(9);
    expect(end.getDate()).toBe(1);
    expect(EVENTS).toMatch(/if \(!start \|\| !end\)/);
  });

  it('reports what a sync counted, and a refused one as refused', () => {
    expect(
      syncSummary({ status: 'success', eventsSynced: 3, eventsCreated: 2, eventsUpdated: 1 }),
    ).toBe('3 events synced (2 new, 1 updated).');
    expect(syncSummary({ status: 'success', eventsSynced: 0 })).toMatch(/No events/);
    expect(syncSummary({ status: 'error', error: 'token expired' })).toBe('token expired');
  });
});

describe('calendar page (round 219)', () => {
  it('the view reads the events endpoint, not a mock list', () => {
    expect(VIEW).toMatch(/queryKey: \[monthEventsUrl\(currentDate\)\]/);
    expect(VIEW).not.toMatch(/mockEvents|ABC Corp|XYZ Manufacturing/);
  });

  it('offers no week or day view it cannot render', () => {
    expect(VIEW).not.toMatch(/'week'|'day'/);
  });

  it('the page syncs through the real endpoint and carries none of the typed-in claims', () => {
    expect(PAGE).toMatch(/`\/api\/meetings\/calendar\/sync\/\$\{id\}`/);
    expect(PAGE).toMatch(/queryKey: \['\/api\/meetings\/calendar\/connections'\]/);
    expect(PAGE).not.toMatch(/setTimeout/);
    for (const s of [
      'aiOptimizationSavings',
      'ABC Corp',
      'Schedule Focus Time',
      'AI Schedule Optimization',
      'Smart Meeting Finder',
      'peak productivity',
    ]) {
      expect(PAGE).not.toContain(s);
    }
  });
});
