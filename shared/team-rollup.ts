/**
 * Team roll-ups for the My Day workspace (COP-B01 AC6).
 *
 * PostgREST has no GROUP BY, so the rows come back flat and the grouping
 * happens here - which is the right place for it anyway, because the rules
 * below are the kind that get quietly dropped when they live inside a handler.
 *
 * FOUR RULES, each one paid for elsewhere in this repo:
 *
 * AN EXPLICIT UNASSIGNED BUCKET (COP-B10). A deal whose owner is null, or
 * whose owner is not on this team, does not vanish: it is counted separately
 * and reported. Omitting those rows is how a grouped view stops adding up to
 * the total shown beside it, and a manager reading per-rep numbers that sum to
 * less than the board has no way to tell.
 *
 * A MEMBER WITH NOTHING APPEARS WITH ZERO. They are on the team, so zero is a
 * measurement about them rather than an absence of data - the opposite of the
 * NULL-IS-NOT-ZERO rule, and the difference is whether the row was looked for.
 *
 * A TOTAL OVER AN UNCOSTED ROW IS A FLOOR AND MUST SAY SO (COP-B05). A deal
 * with no amount contributes nothing to the money column, so the total is a
 * lower bound; `uncostedCount` is what lets the card say that instead of
 * presenting a short number as the pipeline.
 *
 * ORDER IS BY SIZE, THEN NAME. A roll-up sorted by id is a list a manager has
 * to scan; the point of the card is who is carrying what.
 */

export interface TeamMember {
  userId: string;
  name: string;
}

export interface PipelineRow {
  ownerId?: string | null;
  amount?: string | number | null;
  status?: string | null;
}

export interface ActivityRow {
  createdBy?: string | null;
  activityType?: string | null;
}

export interface PipelineMemberRollup {
  userId: string;
  name: string;
  openCount: number;
  openAmount: number;
  /** Open deals carrying no amount. Their value is not in `openAmount`. */
  uncostedCount: number;
}

export interface PipelineRollup {
  members: PipelineMemberRollup[];
  /** Deals with no owner, or an owner outside this team. Never silently dropped. */
  unassigned: { count: number; amount: number; uncostedCount: number };
  totalCount: number;
  totalAmount: number;
  /** True when any counted deal had no amount, so `totalAmount` is a lower bound. */
  totalIsFloor: boolean;
}

export interface ActivityMemberRollup {
  userId: string;
  name: string;
  total: number;
  byType: Record<string, number>;
}

export interface ActivityRollup {
  members: ActivityMemberRollup[];
  unassigned: number;
  total: number;
}

/** A Drizzle decimal arrives as a string; anything unparseable is not a zero. */
function money(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function rollUpPipeline(
  rows: readonly PipelineRow[],
  members: readonly TeamMember[],
): PipelineRollup {
  const byId = new Map<string, PipelineMemberRollup>();
  for (const m of members) {
    byId.set(m.userId, {
      userId: m.userId,
      name: m.name,
      openCount: 0,
      openAmount: 0,
      uncostedCount: 0,
    });
  }

  const unassigned = { count: 0, amount: 0, uncostedCount: 0 };

  for (const row of rows) {
    const amount = money(row.amount);
    const owner = row.ownerId ? byId.get(row.ownerId) : undefined;

    if (owner) {
      owner.openCount += 1;
      if (amount === null) owner.uncostedCount += 1;
      else owner.openAmount += amount;
    } else {
      unassigned.count += 1;
      if (amount === null) unassigned.uncostedCount += 1;
      else unassigned.amount += amount;
    }
  }

  const memberRows = [...byId.values()].sort(
    (a, b) =>
      b.openAmount - a.openAmount || b.openCount - a.openCount || a.name.localeCompare(b.name),
  );

  const totalCount = memberRows.reduce((s, m) => s + m.openCount, 0) + unassigned.count;
  const totalAmount = memberRows.reduce((s, m) => s + m.openAmount, 0) + unassigned.amount;
  const uncosted = memberRows.reduce((s, m) => s + m.uncostedCount, 0) + unassigned.uncostedCount;

  return {
    members: memberRows,
    unassigned,
    totalCount,
    totalAmount,
    totalIsFloor: uncosted > 0,
  };
}

export function rollUpActivity(
  rows: readonly ActivityRow[],
  members: readonly TeamMember[],
): ActivityRollup {
  const byId = new Map<string, ActivityMemberRollup>();
  for (const m of members) {
    byId.set(m.userId, { userId: m.userId, name: m.name, total: 0, byType: {} });
  }

  let unassigned = 0;

  for (const row of rows) {
    const member = row.createdBy ? byId.get(row.createdBy) : undefined;
    if (!member) {
      unassigned += 1;
      continue;
    }
    member.total += 1;
    // An activity with no type still counts toward the total; it is a logged
    // interaction whose kind nobody recorded, not a row to discard.
    const type = (row.activityType ?? '').trim() || 'unspecified';
    member.byType[type] = (member.byType[type] ?? 0) + 1;
  }

  const memberRows = [...byId.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );

  return {
    members: memberRows,
    unassigned,
    total: memberRows.reduce((s, m) => s + m.total, 0) + unassigned,
  };
}

/** `first_name last_name`, falling back to the email, then to a marker. */
export function memberName(user: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user.email) return user.email;
  // Never an empty label: a blank row in a roll-up reads as a rendering bug.
  return 'Unnamed user';
}
