/**
 * The My Day workspace layout (COP-B01 AC2, AC6).
 *
 * Pure. Which cards a rep sees, in what order, and which ones their role is
 * allowed to see at all.
 *
 * TWO DIFFERENT RULES GOVERN THIS AND CONFLATING THEM IS THE BUG TO AVOID.
 * Visibility is a PREFERENCE: a rep hid the wins card because they do not want
 * it, and hiding is theirs to undo. Eligibility is a PERMISSION: a rep does not
 * see a team roll-up because the data is not theirs, and no saved layout may
 * turn that on. So the saved layout is applied FIRST and filtered by role
 * SECOND - never the other way round, or a stale layout from a demotion keeps
 * showing a manager card.
 *
 * The three merge rules are the ones CRM-008's record layout engine already
 * pays for, for the same reasons: a saved layout is authoritative but NOT
 * total (a card shipped after it was saved is appended rather than made
 * invisible to everyone who ever customised), a card the running version does
 * not have is reported rather than swallowed, and a deliberate hide says so
 * out loud instead of being inferred from absence.
 */

export type MyDayCardId =
  | 'overdue'
  | 'due-today'
  | 'stalled-deals'
  | 'meetings-followup'
  | 'awaiting-signature'
  | 'suggested-tasks'
  | 'hot-leads'
  | 'recent-wins'
  | 'team-pipeline'
  | 'team-activity';

export interface MyDayCard {
  id: MyDayCardId;
  title: string;
  /**
   * Minimum role level. Absent means every tenant member.
   * Matches ROLE_LEVEL in supabase/functions/_shared/rbac.ts (MANAGER = 4).
   */
  minRoleLevel?: number;
  /** A card whose data is the whole team's, not the rep's own. */
  teamScope?: boolean;
}

/** Everything the workspace can render. The page supplies a renderer per id. */
export const MY_DAY_CARDS: readonly MyDayCard[] = [
  { id: 'overdue', title: 'Overdue' },
  { id: 'due-today', title: 'Due today' },
  { id: 'suggested-tasks', title: 'Suggested next actions' },
  { id: 'awaiting-signature', title: 'Awaiting signature' },
  { id: 'stalled-deals', title: 'Stalled deals' },
  { id: 'meetings-followup', title: 'Meetings needing follow-up' },
  { id: 'hot-leads', title: 'Hot leads' },
  { id: 'recent-wins', title: 'Recent wins' },
  // AC6: managers additionally see team roll-ups. MANAGER is level 4.
  { id: 'team-pipeline', title: 'Team pipeline', minRoleLevel: 4, teamScope: true },
  { id: 'team-activity', title: 'Team activity', minRoleLevel: 4, teamScope: true },
];

export interface MyDayCardPref {
  id: string;
  /** Position. Lower first. */
  order: number;
  /** A deliberate hide. Absent from the saved list means "never seen", not "hidden". */
  hidden?: boolean;
}

export interface ResolvedMyDayCard extends MyDayCard {
  order: number;
  hidden: boolean;
}

export interface ResolvedMyDayLayout {
  /** Visible, in order. What the page renders. */
  cards: ResolvedMyDayCard[];
  /** Eligible but hidden by the rep. What the customiser offers to turn back on. */
  hidden: ResolvedMyDayCard[];
  /** Saved preferences naming a card this version does not have. */
  unknown: string[];
  /** Cards the saved layout asks for that this role may not see. */
  withheld: string[];
}

/** Whether a role level may see a card at all. Eligibility, not preference. */
export function isEligible(card: MyDayCard, roleLevel: number): boolean {
  return card.minRoleLevel == null || roleLevel >= card.minRoleLevel;
}

/** The shipped layout for a role: every card they are allowed, in catalogue order. */
export function defaultLayout(roleLevel: number): MyDayCardPref[] {
  return MY_DAY_CARDS.filter((c) => isEligible(c, roleLevel)).map((c, i) => ({
    id: c.id,
    order: i,
  }));
}

/**
 * Saved preferences first, role second.
 *
 * A card the rep never saw (shipped after they last saved) is APPENDED rather
 * than dropped, so releasing a card does not make it invisible to everyone who
 * has ever customised their workspace. A card they hid stays hidden. A card
 * their role may not see is withheld whatever the layout says, and is REPORTED
 * rather than silently removed - a manager demoted to rep should be able to
 * find out why two cards vanished.
 */
export function resolveMyDayLayout(
  saved: MyDayCardPref[] | null | undefined,
  roleLevel: number,
): ResolvedMyDayLayout {
  const catalogue = new Map(MY_DAY_CARDS.map((c) => [String(c.id), c]));
  const prefs = (saved ?? []).filter((p) => p && typeof p.id === 'string');

  const unknown: string[] = [];
  const withheld: string[] = [];
  const seen = new Set<string>();
  const resolved: ResolvedMyDayCard[] = [];

  for (const pref of prefs) {
    seen.add(pref.id);
    const card = catalogue.get(pref.id);
    if (!card) {
      unknown.push(pref.id);
      continue;
    }
    if (!isEligible(card, roleLevel)) {
      withheld.push(pref.id);
      continue;
    }
    resolved.push({
      ...card,
      order: Number.isFinite(pref.order) ? pref.order : resolved.length,
      hidden: pref.hidden === true,
    });
  }

  // Appended after everything saved, so a new card never reorders a workspace
  // somebody arranged on purpose.
  let next = resolved.reduce((max, c) => Math.max(max, c.order), -1) + 1;
  for (const card of MY_DAY_CARDS) {
    if (seen.has(String(card.id))) continue;
    if (!isEligible(card, roleLevel)) continue;
    resolved.push({ ...card, order: next, hidden: false });
    next += 1;
  }

  resolved.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return {
    cards: resolved.filter((c) => !c.hidden),
    hidden: resolved.filter((c) => c.hidden),
    unknown,
    withheld,
  };
}

/**
 * Turn a resolved layout back into storable preferences.
 *
 * Hidden cards are KEPT in the saved list. Dropping them would make a hide
 * indistinguishable from never having seen the card, and the next resolve
 * would helpfully append it again - the rep would hide the same card forever.
 */
export function toPrefs(cards: ResolvedMyDayCard[]): MyDayCardPref[] {
  return [...(cards ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ id: c.id, order: i, ...(c.hidden ? { hidden: true } : {}) }));
}

/** Move a card by one position among its siblings, preserving the rest. */
export function reorder(
  cards: ResolvedMyDayCard[],
  id: string,
  direction: 'up' | 'down',
): ResolvedMyDayCard[] {
  const ordered = [...(cards ?? [])].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((c) => c.id === id);
  if (index < 0) return ordered;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return ordered;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((c, i) => ({ ...c, order: i }));
}
