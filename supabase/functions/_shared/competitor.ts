/**
 * Competitor vocabulary and win/loss maths (COP-B10).
 *
 * Pure. Two jobs, both of which have to be one implementation or the numbers on
 * the deal card and the numbers on the report will disagree:
 *
 *  1. RESOLUTION. Four free-text columns hold what reps typed -
 *     deals.incumbent_vendor, business_records.competitor_name,
 *     business_records.main_competitors (comma-separated) and the churn reason.
 *     They are normalized here and matched against a battlecard's slug or one
 *     of its aliases. Nothing rewrites the stored text.
 *
 *  2. AGGREGATION. PostgREST has no GROUP BY, so win/loss by competitor is
 *     computed in memory from the deal rows.
 *
 * THE RULE THAT MATTERS IS THE ONE ABOUT SMALL SAMPLES. A win rate over three
 * deals is not a win rate, it is an anecdote with a percent sign, and a rep who
 * reads "we win 100% against Ricoh" off two deals will say it to a customer.
 * `winRate` is NULL below MIN_DECIDED_FOR_RATE and the counts are still shown,
 * so the page can say "not enough decided deals yet" instead of a number
 * (AC6).
 */

/** Below this many decided (won+lost) deals, a rate is an anecdote. */
export const MIN_DECIDED_FOR_RATE = 5;

/** The churn reason that marks an account lost to a competitor. */
export const COMPETITOR_CHURN_REASON = 'competitor_switch';

/**
 * Corporate suffixes dropped before matching, so 'Xerox Corp.' and 'Xerox'
 * are one competitor. Deliberately short: an aggressive list would merge
 * companies that really are different, and an alias is the escape hatch.
 */
const SUFFIXES = new Set([
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'llc',
  'ltd',
  'co',
  'company',
]);

/**
 * 'Konica Minolta, Inc.' -> 'konicaminolta'. Lowercase, strip punctuation,
 * drop a trailing corporate suffix, remove spaces.
 *
 * Whitespace is removed rather than collapsed so 'KonicaMinolta' and
 * 'Konica Minolta' match: reps type both, and treating them as rival
 * competitors is the drift this function exists to stop.
 */
export function normalizeCompetitorKey(value: string | null | undefined): string {
  const cleaned = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join('');
}

/**
 * `main_competitors` is one free-text column holding a list. Split on the
 * separators people actually use, and drop anything that normalizes to nothing.
 */
export function splitCompetitorList(value: string | null | undefined): string[] {
  return String(value ?? '')
    .split(/[,;/|\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && normalizeCompetitorKey(part).length > 0);
}

export interface BattlecardLike {
  id: string;
  name: string;
  slug: string;
  aliases?: string[] | null;
  [key: string]: unknown;
}

/**
 * slug -> battlecard, including every alias, so one lookup answers whichever
 * spelling a row happens to carry.
 */
export function buildBattlecardIndex(cards: BattlecardLike[]): Map<string, BattlecardLike> {
  const index = new Map<string, BattlecardLike>();
  for (const card of cards ?? []) {
    if (!card?.slug) continue;
    // The canonical slug is set LAST so it wins over another card's alias:
    // a card named for a competitor beats a card that merely lists it.
    for (const alias of card.aliases ?? []) {
      const key = normalizeCompetitorKey(alias);
      if (key && !index.has(key)) index.set(key, card);
    }
  }
  for (const card of cards ?? []) {
    if (card?.slug) index.set(normalizeCompetitorKey(card.slug), card);
  }
  return index;
}

export interface ResolvedCompetitor {
  /** What the row actually says, preserved. */
  raw: string;
  key: string;
  /** The battlecard, when one claims this spelling. */
  battlecard: BattlecardLike | null;
  /** The name to display: the battlecard's, or the rep's own text. */
  displayName: string;
}

export function resolveCompetitor(
  raw: string | null | undefined,
  index: Map<string, BattlecardLike>,
): ResolvedCompetitor | null {
  const text = String(raw ?? '').trim();
  const key = normalizeCompetitorKey(text);
  if (!key) return null;
  const battlecard = index.get(key) ?? null;
  return { raw: text, key, battlecard, displayName: battlecard?.name ?? text };
}

// ── Win/loss ──────────────────────────────────────────────────────────

export interface DealOutcomeRow {
  status?: string | null;
  incumbent_vendor?: string | null;
  lost_reason?: string | null;
  amount?: string | number | null;
}

export interface CompetitorWinLoss {
  key: string;
  name: string;
  battlecardId: string | null;
  won: number;
  lost: number;
  open: number;
  decided: number;
  /** null below MIN_DECIDED_FOR_RATE - a rate over three deals is an anecdote. */
  winRate: number | null;
  /** Revenue won against this competitor. Sums only what carries an amount. */
  wonValue: number;
  /** The lost_reason values seen, most common first. Reps write these. */
  topLossReasons: Array<{ reason: string; count: number }>;
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Win/loss per competitor, from deals that name an incumbent.
 *
 * A deal with no incumbent recorded is NOT counted as a win against nobody -
 * it is excluded, because "we won 40 deals with no competitor" is a statement
 * about data entry and it would swamp every real comparison.
 */
export function summarizeWinLoss(
  deals: DealOutcomeRow[],
  index: Map<string, BattlecardLike>,
): CompetitorWinLoss[] {
  const buckets = new Map<string, CompetitorWinLoss & { reasons: Map<string, number> }>();

  for (const deal of deals ?? []) {
    const resolved = resolveCompetitor(deal.incumbent_vendor, index);
    if (!resolved) continue;

    let bucket = buckets.get(resolved.key);
    if (!bucket) {
      bucket = {
        key: resolved.key,
        name: resolved.displayName,
        battlecardId: (resolved.battlecard?.id as string) ?? null,
        won: 0,
        lost: 0,
        open: 0,
        decided: 0,
        winRate: null,
        wonValue: 0,
        topLossReasons: [],
        reasons: new Map<string, number>(),
      };
      buckets.set(resolved.key, bucket);
    }

    const status = String(deal.status ?? '').toLowerCase();
    if (status === 'won') {
      bucket.won += 1;
      bucket.wonValue += toNumber(deal.amount);
    } else if (status === 'lost') {
      bucket.lost += 1;
      const reason = String(deal.lost_reason ?? '').trim();
      if (reason) bucket.reasons.set(reason, (bucket.reasons.get(reason) ?? 0) + 1);
    } else {
      bucket.open += 1;
    }
  }

  return [...buckets.values()]
    .map(({ reasons, ...bucket }) => {
      const decided = bucket.won + bucket.lost;
      return {
        ...bucket,
        decided,
        winRate: decided >= MIN_DECIDED_FOR_RATE ? bucket.won / decided : null,
        topLossReasons: [...reasons.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
          .slice(0, 5),
      };
    })
    .sort((a, b) => b.decided - a.decided || b.open - a.open || a.name.localeCompare(b.name));
}

/**
 * Competitor spellings that appear on deals or accounts and match no
 * battlecard. This is the list an admin works through: each one is either a new
 * competitor worth a card or an alias of one that already exists.
 */
export function unmatchedCompetitors(
  raws: Array<string | null | undefined>,
  index: Map<string, BattlecardLike>,
): Array<{ key: string; name: string; count: number }> {
  const seen = new Map<string, { key: string; name: string; count: number }>();
  for (const raw of raws ?? []) {
    const resolved = resolveCompetitor(raw, index);
    if (!resolved || resolved.battlecard) continue;
    const entry = seen.get(resolved.key);
    if (entry) entry.count += 1;
    else seen.set(resolved.key, { key: resolved.key, name: resolved.raw, count: 1 });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
