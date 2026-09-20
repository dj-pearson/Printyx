// COP-B01 AC2 and AC6: a customisable workspace whose role gate a saved
// layout cannot talk its way past.
//
// The distinction these tests exist to hold: VISIBILITY is a preference a rep
// owns, ELIGIBILITY is a permission they do not. Applying them in the wrong
// order is how a stale layout from a demotion keeps showing a manager card.
import { describe, it, expect } from 'vitest';

import {
  MY_DAY_CARDS,
  defaultLayout,
  isEligible,
  reorder,
  resolveMyDayLayout,
  toPrefs,
  type MyDayCardPref,
} from '@shared/my-day-layout';

const REP = 2;
const MANAGER = 4;

describe('the catalogue', () => {
  it('has a unique id per card', () => {
    const ids = MY_DAY_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships the six cards AC1 names', () => {
    const ids = MY_DAY_CARDS.map((c) => c.id);
    for (const id of [
      'overdue',
      'due-today',
      'stalled-deals',
      'meetings-followup',
      'awaiting-signature',
      'suggested-tasks',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('marks every team roll-up as manager-only', () => {
    for (const card of MY_DAY_CARDS.filter((c) => c.teamScope)) {
      expect(card.minRoleLevel, card.id).toBeGreaterThanOrEqual(MANAGER);
    }
  });
});

describe('eligibility is a permission', () => {
  it('keeps team cards away from a rep and gives them to a manager', () => {
    const team = MY_DAY_CARDS.find((c) => c.id === 'team-pipeline')!;
    expect(isEligible(team, REP)).toBe(false);
    expect(isEligible(team, MANAGER)).toBe(true);
  });

  it('gives an ungated card to everyone', () => {
    expect(isEligible({ id: 'overdue', title: 'Overdue' }, 1)).toBe(true);
  });
});

describe('defaultLayout', () => {
  it('gives a rep every card they may see and no others', () => {
    const ids = defaultLayout(REP).map((p) => p.id);
    expect(ids).toContain('overdue');
    expect(ids).not.toContain('team-pipeline');
  });

  it('gives a manager strictly more', () => {
    expect(defaultLayout(MANAGER).length).toBeGreaterThan(defaultLayout(REP).length);
  });
});

describe('resolveMyDayLayout', () => {
  it('falls back to the shipped layout when nothing is saved', () => {
    const r = resolveMyDayLayout(null, REP);
    expect(r.cards.map((c) => c.id)).toEqual(defaultLayout(REP).map((p) => p.id));
    expect(r.hidden).toEqual([]);
  });

  it('honours the saved ORDER', () => {
    const saved: MyDayCardPref[] = [
      { id: 'awaiting-signature', order: 0 },
      { id: 'overdue', order: 1 },
    ];
    const ids = resolveMyDayLayout(saved, REP).cards.map((c) => c.id);
    expect(ids.slice(0, 2)).toEqual(['awaiting-signature', 'overdue']);
  });

  it('honours a deliberate HIDE and offers it back', () => {
    const saved: MyDayCardPref[] = [{ id: 'recent-wins', order: 0, hidden: true }];
    const r = resolveMyDayLayout(saved, REP);
    expect(r.cards.map((c) => c.id)).not.toContain('recent-wins');
    expect(r.hidden.map((c) => c.id)).toEqual(['recent-wins']);
  });

  it('APPENDS a card shipped after the layout was saved', () => {
    // Otherwise releasing a card makes it invisible to everyone who has ever
    // customised their workspace, with nothing saying so.
    const saved: MyDayCardPref[] = [{ id: 'overdue', order: 0 }];
    const ids = resolveMyDayLayout(saved, REP).cards.map((c) => c.id);
    expect(ids[0]).toBe('overdue');
    expect(ids).toContain('suggested-tasks');
    expect(ids.length).toBeGreaterThan(1);
  });

  it('WITHHOLDS a manager card a rep saved before a demotion, and says so', () => {
    // The permission wins over the preference, and the rep can find out why
    // two cards vanished.
    const saved: MyDayCardPref[] = [
      { id: 'team-pipeline', order: 0 },
      { id: 'overdue', order: 1 },
    ];
    const r = resolveMyDayLayout(saved, REP);
    expect(r.cards.map((c) => c.id)).not.toContain('team-pipeline');
    expect(r.withheld).toEqual(['team-pipeline']);
  });

  it('still gives a manager the card the same layout asks for', () => {
    const saved: MyDayCardPref[] = [{ id: 'team-pipeline', order: 0 }];
    const r = resolveMyDayLayout(saved, MANAGER);
    expect(r.cards[0].id).toBe('team-pipeline');
    expect(r.withheld).toEqual([]);
  });

  it('REPORTS a saved card this version no longer has', () => {
    const r = resolveMyDayLayout([{ id: 'retired-in-v2', order: 0 }], REP);
    expect(r.unknown).toEqual(['retired-in-v2']);
    expect(r.cards.some((c) => String(c.id) === 'retired-in-v2')).toBe(false);
  });

  it('ignores malformed entries rather than throwing', () => {
    const r = resolveMyDayLayout([null as never, { order: 1 } as never], REP);
    expect(r.cards.length).toBeGreaterThan(0);
  });
});

describe('toPrefs — a hide must survive a round trip', () => {
  it('KEEPS hidden cards in the saved list', () => {
    // Dropping them would make a hide indistinguishable from never having seen
    // the card, and the next resolve would append it again - the rep would hide
    // the same card forever.
    const first = resolveMyDayLayout([{ id: 'recent-wins', order: 0, hidden: true }], REP);
    const saved = toPrefs([...first.cards, ...first.hidden]);
    expect(saved.find((p) => p.id === 'recent-wins')?.hidden).toBe(true);

    const second = resolveMyDayLayout(saved, REP);
    expect(second.cards.map((c) => c.id)).not.toContain('recent-wins');
  });

  it('renumbers to a dense 0..n so two saves cannot drift apart', () => {
    const cards = resolveMyDayLayout(null, REP).cards.map((c, i) => ({ ...c, order: i * 10 }));
    expect(toPrefs(cards).map((p) => p.order)).toEqual(cards.map((_, i) => i));
  });
});

describe('reorder', () => {
  const cards = () => resolveMyDayLayout(null, REP).cards;

  it('moves a card up and renumbers densely', () => {
    const before = cards();
    const moved = reorder(before, before[2].id, 'up');
    expect(moved[1].id).toBe(before[2].id);
    expect(moved.map((c) => c.order)).toEqual(moved.map((_, i) => i));
  });

  it('moves a card down', () => {
    const before = cards();
    const moved = reorder(before, before[0].id, 'down');
    expect(moved[1].id).toBe(before[0].id);
  });

  it('does nothing at the ends, rather than wrapping', () => {
    const before = cards();
    expect(reorder(before, before[0].id, 'up').map((c) => c.id)).toEqual(before.map((c) => c.id));
    expect(reorder(before, before[before.length - 1].id, 'down').map((c) => c.id)).toEqual(
      before.map((c) => c.id),
    );
  });

  it('does nothing for a card that is not there', () => {
    const before = cards();
    expect(reorder(before, 'nope', 'up').map((c) => c.id)).toEqual(before.map((c) => c.id));
  });
});
