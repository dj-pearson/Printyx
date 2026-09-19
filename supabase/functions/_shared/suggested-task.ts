/**
 * Suggested Tasks — ranked next actions from signals that already exist (COP-B03).
 *
 * Pure. THE POINT OF THIS FILE IS THAT IT DETECTS ALMOST NOTHING ITSELF.
 *
 * AC2's signal list is half deal-side (no activity in N days, past the stage
 * SLA, a quote about to expire) and half installed-base (lease window, volume
 * over tier, service spike). Both halves already have an implementation:
 * `shared/deal-score.ts` computes the deal risks for COP-B11, and COP-B04's
 * radar detects the installed-base plays. A third detection engine would mean
 * three places to change a threshold and three chances for the rep's "gone
 * quiet" list to disagree with the score on the same deal's record page.
 *
 * So this module MAPS: a deal risk becomes a suggestion, a radar play becomes a
 * suggestion, and what it adds is the part neither of those has - a suggested
 * ACTION in the imperative, a stable dedupe key, and a rank across the two
 * sources.
 *
 * AUTO-EXPIRY IS A SET DIFFERENCE, WHICH IS THE ONLY WAY IT IS REAL (AC4). The
 * sweep recomputes every live signal, and any OPEN suggestion whose key is not
 * in that set is expired. A suggestion cannot linger after the rep logs the
 * call, because nothing has to remember to retract it - it simply stops being
 * regenerated. `expireKeys` is that difference, and it is tested against the
 * case that matters: the condition clearing.
 */

import { scoreDeal, type DealScoreInput } from '../../../shared/deal-score.ts';

export const SUGGESTION_TYPES = [
  'deal_gone_quiet',
  'deal_next_step_overdue',
  'deal_no_next_step',
  'deal_stage_sla_breached',
  'deal_close_date_passed',
  'deal_single_threaded',
  'quote_expiring',
  'installed_base_play',
] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

/**
 * Which deal-score risk becomes which suggestion, and what the rep should do.
 *
 * The action is IMPERATIVE and specific. "Review this deal" is not an action,
 * it is a category, and a list of them is a list nobody works.
 */
const RISK_TO_SUGGESTION: Record<string, { type: SuggestionType; action: string; weight: number }> =
  {
    gone_quiet: {
      type: 'deal_gone_quiet',
      action: 'Call the contact and log what you learn.',
      weight: 80,
    },
    next_step_overdue: {
      type: 'deal_next_step_overdue',
      action: 'Do the follow-up you booked, or move the date.',
      weight: 75,
    },
    no_next_step: {
      type: 'deal_no_next_step',
      action: 'Agree a next step with the customer and put it on the deal.',
      weight: 60,
    },
    stage_sla_breached: {
      type: 'deal_stage_sla_breached',
      action: 'Move the deal on, or move it back - it has stalled in this stage.',
      weight: 70,
    },
    close_date_passed: {
      type: 'deal_close_date_passed',
      action: 'Re-date the close or close it out. The forecast is carrying it.',
      weight: 85,
    },
    single_threaded: {
      type: 'deal_single_threaded',
      action: 'Find a second contact before this goes further.',
      weight: 55,
    },
  };

export interface SuggestionDraft {
  dedupeKey: string;
  suggestionType: SuggestionType;
  /** deal | quote | account. */
  recordType: string;
  recordId: string;
  /** Plain language, shown to the rep verbatim. */
  reason: string;
  /** Imperative. What to actually do. */
  action: string;
  score: number;
  ownerId: string | null;
  customerId: string | null;
  companyName: string | null;
}

export interface SuggestionDealRow extends DealScoreInput {
  id: string;
  owner_id?: string | null;
  customer_id?: string | null;
  company_name?: string | null;
  title?: string | null;
}

/**
 * A suggestion's key names the CONDITION, not the moment. Two sweeps on the
 * same unchanged deal produce the same key and collide (AC7); the condition
 * clearing makes the key stop appearing, which is what expires it (AC4).
 *
 * Deliberately NOT date-stamped - that is the opposite of the radar, where a
 * lease date moving is a genuinely new opportunity. Here a deal that has been
 * quiet for 30 days and one quiet for 45 are the same unfinished task, and
 * re-raising it every day would be the "stale suggestion" AC4 forbids wearing
 * a fresh id.
 */
export function suggestionKey(type: SuggestionType, recordId: string): string {
  return `${type}:${recordId}`;
}

export interface SuggestionThresholds {
  /** Days before a quote's expiry that it becomes a suggestion. */
  quoteExpiryWindowDays: number;
  /** Suggestion types an admin has switched off (AC5). */
  disabledTypes: string[];
}

export const DEFAULT_SUGGESTION_THRESHOLDS: SuggestionThresholds = {
  quoteExpiryWindowDays: 14,
  disabledTypes: [],
};

export interface SuggestionQuoteRow {
  id: string;
  proposal_number?: string | null;
  title?: string | null;
  valid_until?: string | null;
  deal_id?: string | null;
  business_record_id?: string | null;
  assigned_to?: string | null;
  status?: string | null;
}

export interface RadarPlayRow {
  id: string;
  play_type?: string | null;
  reason?: string | null;
  score?: number | null;
  owner_id?: string | null;
  customer_id?: string | null;
  company_name?: string | null;
  status?: string | null;
}

/**
 * Deal-side suggestions, derived from the SAME scorer the deal record shows.
 *
 * Reusing scoreDeal is what stops the rep's task list and the deal's own
 * insights panel disagreeing about whether a deal has gone quiet.
 */
export function suggestionsFromDeals(
  deals: SuggestionDealRow[],
  now: Date,
  thresholds: SuggestionThresholds,
): SuggestionDraft[] {
  const out: SuggestionDraft[] = [];
  const disabled = new Set(thresholds.disabledTypes ?? []);

  for (const deal of deals ?? []) {
    const result = scoreDeal(deal, now);
    for (const risk of result.risks) {
      const mapping = RISK_TO_SUGGESTION[risk.key];
      if (!mapping) continue;
      if (disabled.has(mapping.type)) continue;

      out.push({
        dedupeKey: suggestionKey(mapping.type, deal.id),
        suggestionType: mapping.type,
        recordType: 'deal',
        recordId: deal.id,
        reason: risk.message,
        action: mapping.action,
        // A critical risk outranks a warning of the same kind, so the list
        // leads with the deal that is actually on fire.
        score: Math.min(100, mapping.weight + (risk.severity === 'critical' ? 15 : 0)),
        ownerId: deal.owner_id ?? null,
        customerId: deal.customer_id ?? null,
        companyName: deal.company_name ?? null,
      });
    }
  }
  return out;
}

/** Quotes about to lapse. A quote nobody chases is a deal nobody closes. */
export function suggestionsFromQuotes(
  quotes: SuggestionQuoteRow[],
  now: Date,
  thresholds: SuggestionThresholds,
  companyNames: Map<string, string>,
): SuggestionDraft[] {
  if ((thresholds.disabledTypes ?? []).includes('quote_expiring')) return [];

  const out: SuggestionDraft[] = [];
  for (const quote of quotes ?? []) {
    if (!quote.valid_until) continue;
    const expiry = new Date(quote.valid_until);
    if (Number.isNaN(expiry.getTime())) continue;

    const days = Math.round((expiry.getTime() - now.getTime()) / 86_400_000);
    if (days > thresholds.quoteExpiryWindowDays) continue;
    // A quote that lapsed months ago is not today's task.
    if (days < -30) continue;

    out.push({
      dedupeKey: suggestionKey('quote_expiring', quote.id),
      suggestionType: 'quote_expiring',
      recordType: 'quote',
      recordId: quote.id,
      reason:
        days < 0
          ? `Quote ${quote.proposal_number ?? ''} expired ${Math.abs(days)} days ago and was never answered.`.trim()
          : `Quote ${quote.proposal_number ?? ''} expires in ${days} days.`.trim(),
      action:
        days < 0 ? 'Re-issue it or close the deal out.' : 'Chase the signature before it lapses.',
      // An expired quote outranks one with a fortnight left.
      score: days < 0 ? 90 : Math.min(85, 60 + (thresholds.quoteExpiryWindowDays - days) * 2),
      ownerId: quote.assigned_to ?? null,
      customerId: quote.business_record_id ?? null,
      companyName: quote.business_record_id
        ? (companyNames.get(quote.business_record_id) ?? null)
        : null,
    });
  }
  return out;
}

/**
 * Installed-base plays, borrowed rather than re-detected.
 *
 * COP-B04 already found these and ranked them. Re-running that detection here
 * would be a second implementation of six threshold rules; instead an OPEN play
 * becomes a suggestion, and the radar's own score carries over.
 */
export function suggestionsFromPlays(
  plays: RadarPlayRow[],
  thresholds: SuggestionThresholds,
): SuggestionDraft[] {
  if ((thresholds.disabledTypes ?? []).includes('installed_base_play')) return [];

  return (plays ?? [])
    .filter((p) => String(p.status ?? 'open') === 'open')
    .map((play) => ({
      dedupeKey: suggestionKey('installed_base_play', play.id),
      suggestionType: 'installed_base_play' as const,
      recordType: 'play',
      recordId: play.id,
      reason: String(play.reason ?? 'An installed-base trigger is live on this account.'),
      action: 'Open the radar and turn it into a deal, or dismiss it.',
      score: Number(play.score) || 50,
      ownerId: play.owner_id ?? null,
      customerId: play.customer_id ?? null,
      companyName: play.company_name ?? null,
    }));
}

/** Highest score first, then stable by key so two sweeps agree on order. */
export function rankSuggestions(drafts: SuggestionDraft[]): SuggestionDraft[] {
  return [...(drafts ?? [])].sort(
    (a, b) => b.score - a.score || a.dedupeKey.localeCompare(b.dedupeKey),
  );
}

/**
 * AC4. Which OPEN suggestions no longer have a live signal behind them.
 *
 * This is the whole auto-expiry mechanism: nothing has to remember to retract a
 * suggestion, because a suggestion that stops being regenerated stops existing.
 * The rep logs the call, `gone_quiet` is no longer a risk on that deal, its key
 * is absent from the sweep, and it expires.
 */
export function expireKeys(openKeys: string[], liveKeys: string[]): string[] {
  const live = new Set(liveKeys ?? []);
  return (openKeys ?? []).filter((key) => !live.has(key));
}
