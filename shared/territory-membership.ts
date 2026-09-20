/**
 * Which territories a person belongs to (COP-B09 AC3).
 *
 * AC3 has two halves and only the roll-up half was built: managers could read
 * across every territory, and nothing DEFAULTED a rep to their own. Doing that
 * needs an answer to "which territory is this person's", and `sales_territories`
 * carries three different relationships that all look like one from a distance.
 *
 * THE THREE ARE NOT INTERCHANGEABLE, and conflating them is the defect this
 * module exists to prevent:
 *
 *   owner_id      the territory's primary rep. Their book.
 *   team_members  additional reps working the same territory. Also their book.
 *   manager_id    the person the territory REPORTS TO. Not their book.
 *
 * A MANAGER RELATIONSHIP MUST NOT NARROW A VIEW. If `manager_id` counted
 * toward the default, a sales manager over four territories would open the
 * radar filtered to those four and see it as their own pipeline, while a
 * manager over none would see everything - the narrower answer arriving for
 * the more senior person, which is backwards. Managing is what the roll-up is
 * FOR, so it contributes to `allTerritoryIds` and never to
 * `defaultTerritoryIds`.
 *
 * A PERSON IN NO TERRITORY GETS NO NARROWING. An empty default means "do not
 * filter", not "filter to nothing" - a rep whose territory nobody has recorded
 * must not open an empty board and conclude they have no work. That is the
 * same NULL-IS-NOT-ZERO distinction the rest of this repo keeps making, on a
 * filter instead of a count.
 *
 * AN INACTIVE TERRITORY BINDS NOBODY. A retired territory still names its old
 * owner, and letting it narrow their view would pin a rep to a territory the
 * company has closed.
 */

export interface TerritoryMembershipRow {
  id: string;
  ownerId?: string | null;
  teamMembers?: readonly string[] | null;
  managerId?: string | null;
  isActive?: boolean | null;
}

export type TerritoryRole = 'none' | 'rep' | 'manager' | 'both';

export interface TerritoryMembership {
  /** Territories where this person is the primary rep. */
  owned: string[];
  /** Territories where they are listed among the additional reps. */
  member: string[];
  /** Territories reporting to them. A roll-up, never a default filter. */
  managed: string[];
  /**
   * What a default view should narrow to. Empty means DO NOT NARROW - either
   * the person has no territory, or their only relationship is managerial.
   */
  defaultTerritoryIds: string[];
  /** Every territory they have any relationship with, for the switcher. */
  allTerritoryIds: string[];
  role: TerritoryRole;
}

function includesUser(members: readonly string[] | null | undefined, userId: string): boolean {
  if (!Array.isArray(members)) return false;
  return members.some((m) => typeof m === 'string' && m.trim() === userId);
}

export function territoryMembership(
  rows: readonly TerritoryMembershipRow[],
  userId: string,
): TerritoryMembership {
  const owned: string[] = [];
  const member: string[] = [];
  const managed: string[] = [];

  /**
   * A blank user id matches nothing rather than everything: an anonymous or
   * unresolved caller must not inherit somebody's book. The `!me` break below
   * is what carries that; the `.trim()` here is belt-and-braces, since the
   * comparisons trim their own side too, so a whitespace id could not match a
   * real one either way. Mutation testing said so rather than my guessing it.
   */
  const me = (userId ?? '').trim();

  for (const row of rows) {
    if (!me) break;
    if (row.isActive === false) continue;
    const id = String(row.id);
    if ((row.ownerId ?? '').trim() === me) owned.push(id);
    else if (includesUser(row.teamMembers, me)) member.push(id);
    // Managing is recorded even when they also work the territory: the
    // switcher should offer it, and `defaultTerritoryIds` already excludes it.
    if ((row.managerId ?? '').trim() === me) managed.push(id);
  }

  const defaultTerritoryIds = [...new Set([...owned, ...member])];
  const allTerritoryIds = [...new Set([...owned, ...member, ...managed])];

  const isRep = defaultTerritoryIds.length > 0;
  const isManager = managed.length > 0;
  const role: TerritoryRole =
    isRep && isManager ? 'both' : isRep ? 'rep' : isManager ? 'manager' : 'none';

  return { owned, member, managed, defaultTerritoryIds, allTerritoryIds, role };
}

/**
 * The territory ids a request should be filtered to, given what the caller
 * asked for and what they belong to.
 *
 * An EXPLICIT request wins, including `all`, so the switcher AC3 asks for
 * works and a manager is never trapped in a default. Only the absence of a
 * request falls back to the person's own territories.
 */
export function resolveTerritoryFilter(
  requested: string | null | undefined,
  membership: TerritoryMembership,
): { territoryIds: string[] | null; source: 'requested' | 'default' | 'none' } {
  const asked = (requested ?? '').trim();
  if (asked === 'all') return { territoryIds: null, source: 'requested' };
  if (asked) return { territoryIds: [asked], source: 'requested' };
  if (membership.defaultTerritoryIds.length > 0) {
    return { territoryIds: [...membership.defaultTerritoryIds], source: 'default' };
  }
  return { territoryIds: null, source: 'none' };
}
