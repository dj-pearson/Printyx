import { describe, it, expect } from 'vitest';
import {
  localHourInTimeZone,
  localDateInTimeZone,
  localWeekdayInTimeZone,
  isDueForBriefing,
  dueBriefingUsers,
  BRIEFING_HOUR,
} from '@shared/briefing-schedule';

// Reference instants (verified offsets):
//   2026-06-15T10:00:00Z -> America/New_York Mon 06:00 (EDT, UTC-4); LA 03:00
//   2026-01-15T11:00:00Z -> America/New_York Thu 06:00 (EST, UTC-5)
//   2026-06-16T10:00:00Z -> America/New_York Tue 06:00
//   2026-06-15T12:00:00Z -> America/New_York Mon 08:00
const NY_MON_6AM_EDT = new Date('2026-06-15T10:00:00Z');
const NY_THU_6AM_EST = new Date('2026-01-15T11:00:00Z');
const NY_TUE_6AM = new Date('2026-06-16T10:00:00Z');
const NY_MON_8AM = new Date('2026-06-15T12:00:00Z');

describe('localHourInTimeZone (DST-aware)', () => {
  it('reads 6am in New York across DST', () => {
    expect(localHourInTimeZone(NY_MON_6AM_EDT, 'America/New_York')).toBe(6);
    expect(localHourInTimeZone(NY_THU_6AM_EST, 'America/New_York')).toBe(6);
  });
  it('differs by zone for the same instant', () => {
    expect(localHourInTimeZone(NY_MON_6AM_EDT, 'America/Los_Angeles')).toBe(3);
  });
  it('returns NaN for an invalid zone', () => {
    expect(Number.isNaN(localHourInTimeZone(NY_MON_6AM_EDT, 'Not/AZone'))).toBe(true);
  });
});

describe('localDateInTimeZone / localWeekdayInTimeZone', () => {
  it('renders the local calendar date', () => {
    expect(localDateInTimeZone(NY_MON_6AM_EDT, 'America/New_York')).toBe('2026-06-15');
  });
  it('renders the local weekday (Mon=1)', () => {
    expect(localWeekdayInTimeZone(NY_MON_6AM_EDT, 'America/New_York')).toBe(1);
    expect(localWeekdayInTimeZone(NY_TUE_6AM, 'America/New_York')).toBe(2);
  });
});

describe('isDueForBriefing', () => {
  const user = (over: Partial<Parameters<typeof isDueForBriefing>[0]> = {}) => ({
    timezone: 'America/New_York',
    frequency: 'daily',
    lastSentDate: null,
    ...over,
  });

  it('is due at local 6am for a daily user not yet sent today', () => {
    expect(isDueForBriefing(user(), NY_MON_6AM_EDT)).toBe(true);
    expect(isDueForBriefing(user(), NY_THU_6AM_EST)).toBe(true);
  });

  it('is not due outside the 6am hour', () => {
    expect(isDueForBriefing(user(), NY_MON_8AM)).toBe(false);
  });

  it('respects frequency off', () => {
    expect(isDueForBriefing(user({ frequency: 'off' }), NY_MON_6AM_EDT)).toBe(false);
  });

  it('dedupes when already sent today (local)', () => {
    expect(isDueForBriefing(user({ lastSentDate: '2026-06-15' }), NY_MON_6AM_EDT)).toBe(false);
    // sent a different day -> still due
    expect(isDueForBriefing(user({ lastSentDate: '2026-06-14' }), NY_MON_6AM_EDT)).toBe(true);
  });

  it('weekly fires Monday only', () => {
    expect(isDueForBriefing(user({ frequency: 'weekly' }), NY_MON_6AM_EDT)).toBe(true);
    expect(isDueForBriefing(user({ frequency: 'weekly' }), NY_TUE_6AM)).toBe(false);
  });

  it('uses a different zone correctly (LA user not due at NY 6am)', () => {
    expect(isDueForBriefing(user({ timezone: 'America/Los_Angeles' }), NY_MON_6AM_EDT)).toBe(false);
  });

  it('falls back to a default zone when timezone is null', () => {
    // null timezone -> America/New_York default -> due at NY 6am
    expect(isDueForBriefing(user({ timezone: null }), NY_MON_6AM_EDT)).toBe(true);
  });

  it('treats null frequency as daily', () => {
    expect(isDueForBriefing(user({ frequency: null }), NY_MON_6AM_EDT)).toBe(true);
  });
});

describe('dueBriefingUsers', () => {
  it('filters a mixed cohort to those due now', () => {
    const cohort = [
      { id: 'a', timezone: 'America/New_York', frequency: 'daily', lastSentDate: null },
      { id: 'b', timezone: 'America/Los_Angeles', frequency: 'daily', lastSentDate: null }, // 3am LA
      { id: 'c', timezone: 'America/New_York', frequency: 'off', lastSentDate: null },
      { id: 'd', timezone: 'America/New_York', frequency: 'daily', lastSentDate: '2026-06-15' }, // sent
    ];
    const due = dueBriefingUsers(cohort, NY_MON_6AM_EDT);
    expect(due.map((u) => u.id)).toEqual(['a']);
  });
});

describe('BRIEFING_HOUR', () => {
  it('is 6am', () => {
    expect(BRIEFING_HOUR).toBe(6);
  });
});
