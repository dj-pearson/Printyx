/**
 * Which records a list page asks for (WF-R-05).
 *
 * The server resolves the caller's tier from their role level and NEVER widens it
 * for anything the client sends - `?scope=` can only narrow, and a hand-written
 * URL asking for `company` from a level-1 account still gets `own`. So this module
 * is a convenience, not a control: it decides what the toggle OFFERS, using the
 * same ladder supabase/functions/_shared/scope.ts applies, so the page does not
 * present a choice the server would refuse.
 *
 * Kept in sync with the Deno module by
 * server/tests/unit/record-scope-parity.test.ts.
 */

export const SCOPE_TIERS = ['own', 'team', 'location', 'regional', 'company', 'platform'] as const;

export type ScopeTier = (typeof SCOPE_TIERS)[number];

/** The widest tier a role level is entitled to. */
export function tierForLevel(level: number): ScopeTier {
  if (level >= 8) return 'platform';
  if (level >= 7) return 'company';
  if (level >= 5) return 'regional';
  if (level >= 3) return 'team';
  return 'own';
}

/** Every tier this level may choose between, narrowest first. */
export function availableTiers(level: number): ScopeTier[] {
  const max = tierForLevel(level);
  return SCOPE_TIERS.slice(0, SCOPE_TIERS.indexOf(max) + 1) as ScopeTier[];
}

/**
 * What a page should ask for before the user touches anything: L1-2 their own
 * records, L3-4 their team, and above that the widest they hold. A director
 * opening a list to find it filtered to themselves would just widen it every time.
 */
export function defaultTier(level: number): ScopeTier {
  if (level <= 2) return 'own';
  if (level <= 4) return 'team';
  return tierForLevel(level);
}

const LABELS: Record<ScopeTier, string> = {
  own: 'Mine',
  team: 'My team',
  location: 'My location',
  regional: 'My region',
  company: 'Everyone',
  platform: 'All tenants',
};

export function tierLabel(tier: ScopeTier): string {
  return LABELS[tier];
}
