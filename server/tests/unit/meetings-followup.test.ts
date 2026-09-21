/**
 * COP-B01 AC1/AC3/AC6, round 105.
 *
 * Three defects in one card area, and the biggest was not the card.
 *
 *  1. EVERY read in the dashboards /today branch filtered on `tenant_id` alone,
 *     on a page headed "Good morning, {firstName}! Here's your day at a glance"
 *     - so a rep's own day listed every other rep's overdue tasks and meetings.
 *     A real list of the wrong set, which COP-I01 records as harder to spot than
 *     an invented one because every row on it is true of somebody. AC6 read as
 *     satisfied because the TEAM roll-up cards were scoped from the start.
 *  2. The `meetings-followup` slot rendered UPCOMING activities under the
 *     heading "Coming Up", so the card AC1 names had never been built.
 *  3. It was the only card with no action at all, and it carried
 *     `hover:bg-gray-50` - styling that promises one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  meetingsNeedingFollowUp,
  type FollowUpActivityRow,
} from '../../../shared/meetings-followup';
import { MY_DAY_CARDS } from '../../../shared/my-day-layout';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const NOW = new Date('2026-09-21T12:00:00.000Z');
const ago = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();
const ahead = (days: number) => new Date(NOW.getTime() + days * 86400000).toISOString();

const meeting = (over: Partial<FollowUpActivityRow> = {}): FollowUpActivityRow => ({
  id: 'm1',
  subject: 'Discovery call',
  activity_type: 'meeting',
  scheduled_date: ago(3),
  completed_date: null,
  business_record_id: 'acct-1',
  ...over,
});

describe('a meeting needs follow-up when nothing happened after it', () => {
  it('lists a past meeting with no later activity', () => {
    const r = meetingsNeedingFollowUp([meeting()], [meeting()], NOW);
    expect(r.meetings.map((m) => m.id)).toEqual(['m1']);
    expect(r.meetings[0].daysSince).toBe(3);
    expect(r.unlinkedMeetings).toBe(0);
  });

  it('does not list one a later activity closed out, whatever its type', () => {
    // A logged call, an email, a task - any of them is the rep having done
    // something since, and listing the meeting anyway trains people to ignore
    // the card.
    const later: FollowUpActivityRow = {
      id: 'a2',
      activity_type: 'call',
      scheduled_date: ago(1),
      completed_date: ago(1),
      business_record_id: 'acct-1',
    };
    const r = meetingsNeedingFollowUp([meeting()], [meeting(), later], NOW);
    expect(r.meetings).toEqual([]);
  });

  it('counts a BOOKED next step as follow-up even though it has not happened', () => {
    // A future task on the account IS the loop closed: the rep has decided what
    // happens next, which is the thing the card exists to prompt.
    const booked: FollowUpActivityRow = {
      id: 'a3',
      activity_type: 'task',
      scheduled_date: ahead(2),
      completed_date: null,
      business_record_id: 'acct-1',
    };
    expect(meetingsNeedingFollowUp([meeting()], [meeting(), booked], NOW).meetings).toEqual([]);
  });

  it('is not fooled by an EARLIER activity on the same account', () => {
    const before: FollowUpActivityRow = {
      id: 'a0',
      activity_type: 'email',
      scheduled_date: ago(9),
      completed_date: ago(9),
      business_record_id: 'acct-1',
    };
    expect(meetingsNeedingFollowUp([meeting()], [meeting(), before], NOW).meetings).toHaveLength(1);
  });

  it('never treats a meeting as its own follow-up', () => {
    // The activity set contains the meeting itself; matching by id is what
    // keeps every meeting from closing itself out.
    expect(meetingsNeedingFollowUp([meeting()], [meeting()], NOW).meetings).toHaveLength(1);
  });

  it('still lists a meeting the rep TICKED OFF after the fact', () => {
    // The id guard reads as redundant beside the strict `>` - a meeting cannot
    // be later than itself - and mutation testing said otherwise. An activity
    // is stamped at `completed_date ?? scheduled_date`, so a meeting held on
    // Monday and ticked off on Tuesday has its OWN entry later than its own
    // scheduled_date, and without the id check it closes itself out. That would
    // hide exactly the meetings a diligent rep marks complete.
    const tickedLate = meeting({ scheduled_date: ago(3), completed_date: ago(2) });
    const r = meetingsNeedingFollowUp([tickedLate], [tickedLate], NOW);
    expect(r.meetings.map((m) => m.id)).toEqual(['m1']);
  });

  it('leaves a FUTURE meeting alone - that is preparation, not follow-up', () => {
    const r = meetingsNeedingFollowUp([meeting({ scheduled_date: ahead(1) })], [], NOW);
    expect(r.meetings).toEqual([]);
  });

  it('counts a meeting with no account rather than listing or dropping it', () => {
    // Nothing to look for a follow-up ON, so neither answer is true of it.
    const r = meetingsNeedingFollowUp([meeting({ business_record_id: null })], [], NOW);
    expect(r.meetings).toEqual([]);
    expect(r.unlinkedMeetings).toBe(1);
  });

  it("ignores the meeting's own completed_date", () => {
    // A rep who never ticks a meeting off has not failed to follow it up, and
    // one who ticks every meeting off has not followed any of them up.
    const ticked = meeting({ completed_date: ago(3) });
    expect(meetingsNeedingFollowUp([ticked], [ticked], NOW).meetings).toHaveLength(1);
  });

  it('skips a meeting with no usable date rather than guessing one', () => {
    expect(meetingsNeedingFollowUp([meeting({ scheduled_date: null })], [], NOW).meetings).toEqual(
      [],
    );
    expect(
      meetingsNeedingFollowUp([meeting({ scheduled_date: 'not a date' })], [], NOW).meetings,
    ).toEqual([]);
  });

  it('puts the longest-waiting meeting first', () => {
    const rows = [
      meeting({ id: 'recent', scheduled_date: ago(1) }),
      meeting({ id: 'oldest', scheduled_date: ago(11), business_record_id: 'acct-2' }),
      meeting({ id: 'middle', scheduled_date: ago(5), business_record_id: 'acct-3' }),
    ];
    const r = meetingsNeedingFollowUp(rows, rows, NOW);
    expect(r.meetings.map((m) => m.id)).toEqual(['oldest', 'middle', 'recent']);
  });

  it('resolves the account name when given one and never invents it', () => {
    const named = meetingsNeedingFollowUp(
      [meeting()],
      [meeting()],
      NOW,
      new Map([['acct-1', 'Acme Copiers']]),
    );
    expect(named.meetings[0].accountName).toBe('Acme Copiers');
    expect(
      meetingsNeedingFollowUp([meeting()], [meeting()], NOW).meetings[0].accountName,
    ).toBeNull();
  });

  it('falls back to a subject rather than rendering a blank row', () => {
    expect(
      meetingsNeedingFollowUp([meeting({ subject: '   ' })], [], NOW).meetings[0].subject,
    ).toBe('Meeting');
  });
});

describe('the /today branch scopes every activity read to the caller', () => {
  const FN = stripComments(read('supabase/functions/dashboards/index.ts'));

  it('resolves the scope once', () => {
    expect(FN).toContain('resolveScope(admin');
    expect(FN).toMatch(/appMetadata: user\.app_metadata/);
  });

  it('applies it to every business_record_activities read, walked one by one', () => {
    // A COUNT is not a property - five times over in this repo now. Each chain
    // is checked on its own, so scoping three of four still fails.
    const chains = [...FN.matchAll(/\.from\('business_record_activities'\)/g)].map((m) => m.index!);
    expect(chains.length).toBeGreaterThanOrEqual(4);
    for (const at of chains) {
      // The scope wraps the chain, so applyUserScope opens BEFORE the .from and
      // 'created_by' closes it after. Bound to the 400 chars either side of the
      // chain rather than to a fixed window from the top of the function.
      const before = FN.slice(Math.max(0, at - 400), at);
      // Bounded by the NEXT chain, never by a character count and never by a
      // guessed indent: a 900-character slice ran into the following chain,
      // whose `scope,` then satisfied the assertion for a read that had none
      // (a survivor proved it - the sixth window-crossing this repo records),
      // and these six chains sit at three different indents, so a closing-paren
      // search finds the wrong one. No two chains share a `.from(`, so this
      // boundary is a construct rather than a distance.
      const next = chains.find((c) => c > at);
      const after = FN.slice(at, next ?? FN.length);
      // Bound to the ARGUMENT, not just the call: swapping the third argument
      // for a widened copy leaves `applyUserScope(` and `'created_by'` in place
      // and scopes nobody.
      const scoped =
        before.includes('applyUserScope(') && /'created_by',\s*\n\s*scope,/.test(after);
      // The follow-up lookup is deliberately unscoped: a colleague covering the
      // territory closes the loop just as well. It is the one that selects the
      // narrow column list, which is how it is told apart.
      const isFollowUpLookup = after.slice(0, 200).includes("'id, scheduled_date, completed_date");
      expect({ at, scoped: scoped || isFollowUpLookup }).toEqual({ at, scoped: true });
    }
  });

  it('scopes on created_by, the one ownership column the table has', () => {
    // business_record_activities has created_by NOT NULL and no assigned_to;
    // scoping a table on a column it lacks filters nothing and reads as
    // protected.
    expect(FN).not.toMatch(/applyUserScope\([\s\S]{0,900}?'(owner_id|assigned_to)',\s*scope/);
  });

  it('reports the tier so a narrowed list says it was narrowed', () => {
    expect(FN).toMatch(/scopeTier: scope\.tier/);
    expect(FN).toMatch(/scopeDegradedFrom: scope\.degradedFrom/);
    expect(stripComments(read('client/src/pages/TodayDashboard.tsx'))).toContain(
      'scopeDegradedFrom &&',
    );
  });
});

describe('the card the AC names is rendered, and the one it replaced kept a home', () => {
  const PAGE = read('client/src/pages/TodayDashboard.tsx');

  /**
   * The meetings-followup slot's own body, bounded by the NEXT slot key
   * whatever its quoting - not by a literal `'upcoming':`, whose quotes
   * prettier's `quoteProps: "as-needed"` removes because it is a valid
   * identifier. Running past that boundary pulled the next card's markup into
   * the assertion, and that card is the one still carrying the hover styling
   * this slot had to lose, so format:write turned a correct page red.
   */
  const followUpSlot = () => {
    const start = PAGE.indexOf("    'meetings-followup':");
    expect(start).toBeGreaterThan(-1);
    const next = PAGE.slice(start + 10).search(/\n {4}'?[a-z-]+'?:/);
    expect(next).toBeGreaterThan(-1);
    return PAGE.slice(start, start + 10 + next);
  };

  it('every catalogue id has a slot, and every slot an id', () => {
    // COP-B01 AC6's check: a card declared and never rendered is absent in the
    // politest possible way - a blank a manager reads as a quiet week.
    const start = PAGE.indexOf('const cardSlots: Record<string, ReactNode> = {');
    expect(start).toBeGreaterThan(-1);
    const block = PAGE.slice(start, PAGE.indexOf('\n  };', start));
    // prettier's `quoteProps: "as-needed"` strips the quotes from a key that
    // is a valid identifier, so `overdue:` and `upcoming:` are unquoted while
    // `'due-today':` and `'meetings-followup':` keep theirs. Matching only the
    // quoted form pins the FORMATTING rather than the property, and a plain
    // format:write then fails a correct page.
    const slots = new Set([...block.matchAll(/^ {4}'?([a-z-]+)'?:/gm)].map((m) => m[1]));
    const ids = MY_DAY_CARDS.map((c) => c.id);
    expect(ids.length).toBeGreaterThan(8);
    for (const id of ids) expect({ id, hasSlot: slots.has(id) }).toEqual({ id, hasSlot: true });
    for (const slot of slots)
      expect({ slot, inCatalogue: ids.includes(slot) }).toEqual({ slot, inCatalogue: true });
  });

  it('keeps "Coming up" as its own card rather than losing it', () => {
    expect(MY_DAY_CARDS.some((c) => c.id === 'upcoming')).toBe(true);
    expect(MY_DAY_CARDS.some((c) => c.id === 'meetings-followup')).toBe(true);
  });

  it('the follow-up card is actionable, which it was not', () => {
    const body = followUpSlot();
    expect(body).toContain('<Link');
    expect(body).toContain('/customers/${meeting.businessRecordId}');
    // The row it replaced had hover styling and no handler, which promises an
    // action and is worse than a plain row.
    expect(body).not.toMatch(/hover:bg-gray-50/);
  });

  it('renders an honest empty state instead of hiding the card', () => {
    const body = followUpSlot();
    expect(body).toContain('meetingsNeedingFollowUp.length === 0');
    expect(body).toContain('Every meeting followed up');
    // Null is the FAILED read and stays hidden; [] is a measurement.
    expect(body).toContain('meetingsNeedingFollowUp === null ? null');
  });

  it('names the meetings it could not check rather than folding them in', () => {
    expect(PAGE).toContain('unlinkedMeetings');
    expect(PAGE).toContain('follow-up could not be checked');
  });
});
