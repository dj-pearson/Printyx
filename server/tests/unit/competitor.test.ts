// COP-B10: one competitor vocabulary across four free-text columns, and a
// win/loss summary that refuses to quote a rate it cannot support.
//
// The resolution rules are what stop 'Xerox', 'xerox' and 'Xerox Corp.'
// becoming three competitors on one report, and the sample-size rule is what
// stops a rep reading "we win 100% against Ricoh" off two deals and saying it
// in a room. Neither is visible to tsc and neither fails loudly.
import { describe, it, expect } from 'vitest';

import {
  MIN_DECIDED_FOR_RATE,
  buildBattlecardIndex,
  normalizeCompetitorKey,
  resolveCompetitor,
  splitCompetitorList,
  summarizeWinLoss,
  unmatchedCompetitors,
  type BattlecardLike,
  type DealOutcomeRow,
} from '../../../supabase/functions/_shared/competitor';

const CARDS: BattlecardLike[] = [
  { id: 'c-xerox', name: 'Xerox', slug: 'xerox', aliases: ['Xerox Corporation'] },
  { id: 'c-km', name: 'Konica Minolta', slug: 'konicaminolta', aliases: ['KM', 'Konica'] },
];
const INDEX = buildBattlecardIndex(CARDS);

describe('normalizeCompetitorKey', () => {
  it('folds the spellings reps actually type into one key', () => {
    const key = normalizeCompetitorKey('Xerox');
    for (const spelling of ['xerox', 'XEROX', 'Xerox Corp.', 'Xerox Corporation', ' Xerox  Inc ']) {
      expect(normalizeCompetitorKey(spelling)).toBe(key);
    }
  });

  it('matches a two-word name written with and without the space', () => {
    expect(normalizeCompetitorKey('Konica Minolta')).toBe(normalizeCompetitorKey('KonicaMinolta'));
  });

  it('strips a suffix even when punctuation runs straight into it', () => {
    // 'Xerox,Inc.' with no space is how this gets typed into a single-value
    // field. Punctuation becomes a SPACE rather than nothing, so 'inc' is still
    // its own word and still recognised as a suffix - replacing it with '' gives
    // 'xeroxinc', a competitor that matches no battlecard.
    expect(normalizeCompetitorKey('Xerox,Inc.')).toBe(normalizeCompetitorKey('Xerox'));
    expect(normalizeCompetitorKey('Ricoh-Corp')).toBe(normalizeCompetitorKey('Ricoh'));
  });

  it('keeps a suffix that is the whole name, rather than normalizing to nothing', () => {
    expect(normalizeCompetitorKey('Corp')).toBe('corp');
  });

  it('does not merge companies that only share a suffix', () => {
    expect(normalizeCompetitorKey('Sharp Inc')).not.toBe(normalizeCompetitorKey('Canon Inc'));
  });

  it('returns empty for text with nothing to match on', () => {
    expect(normalizeCompetitorKey('')).toBe('');
    expect(normalizeCompetitorKey('   ')).toBe('');
    expect(normalizeCompetitorKey('-- ,')).toBe('');
    expect(normalizeCompetitorKey(null)).toBe('');
  });
});

describe('splitCompetitorList — main_competitors is a list in one column', () => {
  it('splits on the separators people use', () => {
    expect(splitCompetitorList('Xerox, Ricoh; Canon / Sharp')).toEqual([
      'Xerox',
      'Ricoh',
      'Canon',
      'Sharp',
    ]);
  });

  it('drops empties and punctuation-only fragments', () => {
    expect(splitCompetitorList('Xerox,, ,-,Ricoh')).toEqual(['Xerox', 'Ricoh']);
    expect(splitCompetitorList(null)).toEqual([]);
  });
});

describe('resolveCompetitor', () => {
  it('finds the battlecard through the canonical name', () => {
    expect(resolveCompetitor('XEROX Corp.', INDEX)?.battlecard?.id).toBe('c-xerox');
  });

  it('finds it through an alias', () => {
    expect(resolveCompetitor('KM', INDEX)?.battlecard?.id).toBe('c-km');
    expect(resolveCompetitor('konica', INDEX)?.battlecard?.id).toBe('c-km');
  });

  it('KEEPS THE REP’S OWN TEXT when nothing claims it', () => {
    const resolved = resolveCompetitor('Toshiba', INDEX);
    expect(resolved?.battlecard).toBeNull();
    // Not blank, and not "Unknown": the rep wrote something and it is shown.
    expect(resolved?.displayName).toBe('Toshiba');
    expect(resolved?.raw).toBe('Toshiba');
  });

  it('is null for a column with nothing in it', () => {
    expect(resolveCompetitor(null, INDEX)).toBeNull();
    expect(resolveCompetitor('  ', INDEX)).toBeNull();
  });

  it('prefers a card named for the competitor over one that lists it as an alias', () => {
    const cards: BattlecardLike[] = [
      { id: 'c-other', name: 'Other', slug: 'other', aliases: ['Ricoh'] },
      { id: 'c-ricoh', name: 'Ricoh', slug: 'ricoh', aliases: [] },
    ];
    expect(resolveCompetitor('ricoh', buildBattlecardIndex(cards))?.battlecard?.id).toBe('c-ricoh');
  });
});

describe('summarizeWinLoss', () => {
  const deals = (n: number, status: string, vendor: string, extra: Partial<DealOutcomeRow> = {}) =>
    Array.from({ length: n }, () => ({ status, incumbent_vendor: vendor, ...extra }));

  it('counts the same competitor written every which way as one row', () => {
    const rows: DealOutcomeRow[] = [
      ...deals(2, 'won', 'Xerox'),
      ...deals(1, 'won', 'XEROX Corp.'),
      ...deals(3, 'lost', 'xerox'),
    ];
    const out = summarizeWinLoss(rows, INDEX);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Xerox', won: 3, lost: 3, decided: 6 });
  });

  it('gives a rate once there are enough decided deals, and null below that', () => {
    const thin = summarizeWinLoss(
      [...deals(2, 'won', 'Xerox'), ...deals(1, 'lost', 'Xerox')],
      INDEX,
    );
    expect(thin[0].decided).toBe(3);
    expect(thin[0].winRate).toBeNull();
    // The counts are still real — counting is something three deals support.
    expect(thin[0].won).toBe(2);

    const enough = summarizeWinLoss(
      [...deals(3, 'won', 'Xerox'), ...deals(2, 'lost', 'Xerox')],
      INDEX,
    );
    expect(enough[0].decided).toBe(MIN_DECIDED_FOR_RATE);
    expect(enough[0].winRate).toBeCloseTo(0.6);
  });

  it('does not let open deals buy a rate', () => {
    const out = summarizeWinLoss(
      [...deals(1, 'won', 'Xerox'), ...deals(20, 'open', 'Xerox')],
      INDEX,
    );
    expect(out[0].open).toBe(20);
    expect(out[0].winRate).toBeNull();
  });

  it('EXCLUDES deals with no incumbent rather than counting a win against nobody', () => {
    const out = summarizeWinLoss(
      [
        ...deals(5, 'won', 'Xerox'),
        { status: 'won', incumbent_vendor: null },
        { status: 'won', incumbent_vendor: '  ' },
      ],
      INDEX,
    );
    expect(out).toHaveLength(1);
    expect(out[0].won).toBe(5);
  });

  it('sums won value only from deals that carry an amount', () => {
    const out = summarizeWinLoss(
      [
        { status: 'won', incumbent_vendor: 'Xerox', amount: '12000.50' },
        { status: 'won', incumbent_vendor: 'Xerox', amount: null },
        { status: 'lost', incumbent_vendor: 'Xerox', amount: '99999' },
      ],
      INDEX,
    );
    expect(out[0].wonValue).toBeCloseTo(12000.5);
  });

  it('ranks loss reasons by how often reps wrote them', () => {
    const out = summarizeWinLoss(
      [
        { status: 'lost', incumbent_vendor: 'Xerox', lost_reason: 'price' },
        { status: 'lost', incumbent_vendor: 'Xerox', lost_reason: 'price' },
        { status: 'lost', incumbent_vendor: 'Xerox', lost_reason: 'service terms' },
        { status: 'lost', incumbent_vendor: 'Xerox', lost_reason: null },
      ],
      INDEX,
    );
    expect(out[0].topLossReasons[0]).toEqual({ reason: 'price', count: 2 });
    expect(out[0].topLossReasons.map((r) => r.reason)).not.toContain('');
  });

  it('carries the unmatched competitor under the name the rep typed', () => {
    const out = summarizeWinLoss(deals(1, 'won', 'Toshiba'), INDEX);
    expect(out[0]).toMatchObject({ name: 'Toshiba', battlecardId: null });
  });

  it('orders by how much evidence there is, not alphabetically', () => {
    const out = summarizeWinLoss(
      [...deals(1, 'won', 'Konica Minolta'), ...deals(6, 'won', 'Xerox')],
      INDEX,
    );
    expect(out.map((c) => c.name)).toEqual(['Xerox', 'Konica Minolta']);
  });

  it('returns nothing at all for an empty deal set', () => {
    expect(summarizeWinLoss([], INDEX)).toEqual([]);
  });
});

describe('unmatchedCompetitors — the admin worklist', () => {
  it('lists only spellings no battlecard claims, most common first', () => {
    const out = unmatchedCompetitors(
      ['Xerox', 'Toshiba', 'toshiba', 'TOSHIBA', 'Sharp', 'KM', null, ''],
      INDEX,
    );
    expect(out.map((u) => [u.name, u.count])).toEqual([
      ['Toshiba', 3],
      ['Sharp', 1],
    ]);
  });

  it('is empty when every spelling is claimed', () => {
    expect(unmatchedCompetitors(['Xerox', 'KM', 'Konica Minolta'], INDEX)).toEqual([]);
  });
});
