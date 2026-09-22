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

// ─── Manager reports (PROD-008) ─────────────────────────────────────────────
//
// The iOS manager reports screen is the ONLY caller of /api/team-reports -
// nothing in client/src requests that prefix - and all four of its cards were
// blank, for two different reasons. `activities` and `no-touch` 404'd (the
// branch is spelled `activity`, singular, and no-touch was never written), and
// `pipeline` and `leaderboard` answered 200 under key names the app does not
// read, so every field decoded to nil. That second half is the harder one to
// see: the request succeeds, nothing logs, and the screen is empty.
//
// The shapes below are the ones ManagerReportsModels.swift decodes. They live
// here, with the roll-ups above, because the rules are the same rules and a
// second copy inside the handler is how they drift.

/** Matches ManagerReportsModels.TeamPipelineSummary. */
export interface TeamPipelineSummary {
  pipelineValue: number;
  weightedValue: number;
  openOpportunityCount: number;
  closedWonThisMonth: number;
  closedWonCount: number;
  /** Open deals carrying no amount, so pipelineValue is a lower bound (COP-B05). */
  uncostedOpenCount: number;
  totalIsFloor: boolean;
}

/** Matches ManagerReportsModels.TeamLeaderboardEntry. */
export interface TeamLeaderboardEntry {
  userId: string;
  name: string;
  closedWonAmount: number;
  closedWonCount: number;
  rank: number;
}

/** Matches ManagerReportsModels.TeamRepActivity. */
export interface TeamRepActivity {
  userId: string;
  name: string;
  callCount: number;
  emailCount: number;
  meetingCount: number;
  noteCount: number;
  /** Logged interactions whose type is none of the four above. Never dropped. */
  otherCount: number;
}

/** Matches ManagerReportsModels.TeamNoTouchAlert. */
export interface TeamNoTouchAlert {
  userId: string;
  repName: string;
  opportunityId: string;
  opportunityName: string;
  customerName: string | null;
  daysSinceLastActivity: number;
  openAmount: number | null;
  /**
   * Whether `daysSinceLastActivity` is measured from a logged activity or,
   * when there has never been one, from the day the deal was created. A
   * manager acting on this list needs to know which - "nobody has touched it
   * since it was raised" and "nobody has touched it since the last call" are
   * different conversations.
   */
  measuredFrom: 'activity' | 'deal_created';
}

export interface DealSummaryRow {
  id?: string | null;
  title?: string | null;
  ownerId?: string | null;
  amount?: string | number | null;
  probability?: string | number | null;
  status?: string | null;
  actualCloseDate?: string | null;
  companyName?: string | null;
  createdAt?: string | null;
}

function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Roll every deal the caller can see into the five numbers the pipeline card
 * shows.
 *
 * `status` is the discriminator rather than the stage, and that is a checked
 * choice: the canonical stage-move path in supabase/functions/pipeline-config
 * writes `status`, `probability` and `actual_close_date` together when a deal
 * enters a closed-won or closed-lost stage, so the column is maintained by the
 * same write that moves the card.
 *
 * WEIGHTED VALUE USES A MISSING PROBABILITY AS ZERO, NOT AS CERTAINTY. The
 * column defaults to 0 and the stage-move path overwrites it from the stage,
 * so a null here means nobody has said - and weighting it at 100% would make
 * the forecast read higher than the pipeline.
 */
export function summariseTeamPipeline(
  rows: readonly DealSummaryRow[],
  now: Date,
): TeamPipelineSummary {
  const monthStart = utcMonthStart(now);
  let pipelineValue = 0;
  let weightedValue = 0;
  let openOpportunityCount = 0;
  let uncostedOpenCount = 0;
  let closedWonThisMonth = 0;
  let closedWonCount = 0;

  for (const row of rows) {
    const amount = money(row.amount);
    const status = (row.status ?? '').trim().toLowerCase();

    if (status === 'won') {
      closedWonCount += 1;
      const closed = row.actualCloseDate ? new Date(row.actualCloseDate) : null;
      if (closed && !Number.isNaN(closed.getTime()) && closed >= monthStart && amount !== null) {
        closedWonThisMonth += amount;
      }
      continue;
    }
    // Anything that is not won and not lost is still in play. A status nobody
    // recognises counts as open rather than disappearing from the pipeline.
    if (status === 'lost') continue;

    openOpportunityCount += 1;
    if (amount === null) {
      uncostedOpenCount += 1;
      continue;
    }
    pipelineValue += amount;
    const probability = money(row.probability);
    const pct = probability === null ? 0 : Math.max(0, Math.min(100, probability));
    weightedValue += (amount * pct) / 100;
  }

  return {
    pipelineValue,
    weightedValue,
    openOpportunityCount,
    closedWonThisMonth,
    closedWonCount,
    uncostedOpenCount,
    totalIsFloor: uncostedOpenCount > 0,
  };
}

/**
 * Rank won deals by rep.
 *
 * Every member appears, including at zero: they are on the team, so a zero is a
 * measurement about them. RANK IS DENSE and shared on a tie - two reps on the
 * same number are both second, and the next is third - because presenting a tie
 * as an ordering invents a difference the data does not carry.
 */
export function rankTeamLeaderboard(
  wonRows: readonly DealSummaryRow[],
  members: readonly TeamMember[],
): TeamLeaderboardEntry[] {
  const byId = new Map<string, TeamLeaderboardEntry>();
  for (const m of members) {
    byId.set(m.userId, {
      userId: m.userId,
      name: m.name,
      closedWonAmount: 0,
      closedWonCount: 0,
      rank: 0,
    });
  }

  for (const row of wonRows) {
    const entry = row.ownerId ? byId.get(row.ownerId) : undefined;
    if (!entry) continue;
    entry.closedWonCount += 1;
    const amount = money(row.amount);
    if (amount !== null) entry.closedWonAmount += amount;
  }

  const ordered = [...byId.values()].sort(
    (a, b) =>
      b.closedWonAmount - a.closedWonAmount ||
      b.closedWonCount - a.closedWonCount ||
      a.name.localeCompare(b.name),
  );

  let rank = 0;
  let lastAmount: number | null = null;
  let lastCount: number | null = null;
  ordered.forEach((entry, index) => {
    if (entry.closedWonAmount !== lastAmount || entry.closedWonCount !== lastCount) {
      rank = index + 1;
      lastAmount = entry.closedWonAmount;
      lastCount = entry.closedWonCount;
    }
    entry.rank = rank;
  });

  return ordered;
}

/** Which of the four cards a free-text activity_type belongs under. */
function activityBucket(type: string): 'call' | 'email' | 'meeting' | 'note' | 'other' {
  const t = type.toLowerCase();
  if (t.includes('call')) return 'call';
  if (t.includes('email')) return 'email';
  if (t.includes('meeting') || t.includes('demo')) return 'meeting';
  if (t.includes('note')) return 'note';
  return 'other';
}

/**
 * Per-rep call / email / meeting / note counts.
 *
 * `activity_type` is a free varchar with at least eleven values in the wild, so
 * an unrecognised one lands in `otherCount` rather than vanishing - the same
 * rule the record timeline's filter vocabulary encodes. A count that silently
 * drops rows does not add up to the total the manager sees elsewhere.
 */
export function teamActivityByRep(rollup: ActivityRollup): TeamRepActivity[] {
  return rollup.members.map((member) => {
    const counts = { call: 0, email: 0, meeting: 0, note: 0, other: 0 };
    for (const [type, n] of Object.entries(member.byType)) {
      counts[activityBucket(type)] += n;
    }
    return {
      userId: member.userId,
      name: member.name,
      callCount: counts.call,
      emailCount: counts.email,
      meetingCount: counts.meeting,
      noteCount: counts.note,
      otherCount: counts.other,
    };
  });
}

/**
 * Open deals nobody has touched in `days` days.
 *
 * `deals.last_activity_date` looks like the column for this and is written by
 * NOTHING - it is read in four places and set in none - so building the alert
 * on it would flag every open deal in the tenant forever. The touch date comes
 * from the activity rows instead, and when a deal has never had one the clock
 * runs from the day it was raised, with `measuredFrom` saying which.
 */
export function findNoTouchAlerts(
  openRows: readonly DealSummaryRow[],
  lastTouchByDeal: ReadonlyMap<string, string>,
  members: readonly TeamMember[],
  days: number,
  now: Date,
): TeamNoTouchAlert[] {
  const nameById = new Map(members.map((m) => [m.userId, m.name]));
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  const alerts: TeamNoTouchAlert[] = [];

  for (const row of openRows) {
    if (!row.id) continue;
    const touched = lastTouchByDeal.get(row.id);
    const basis = touched ?? row.createdAt ?? null;
    if (!basis) continue;
    const at = new Date(basis);
    if (Number.isNaN(at.getTime())) continue;
    if (at.getTime() > cutoffMs) continue;

    alerts.push({
      userId: row.ownerId ?? '',
      repName: (row.ownerId && nameById.get(row.ownerId)) || 'Unassigned',
      opportunityId: row.id,
      opportunityName: row.title ?? 'Untitled opportunity',
      customerName: row.companyName ?? null,
      daysSinceLastActivity: Math.floor((now.getTime() - at.getTime()) / (24 * 60 * 60 * 1000)),
      openAmount: money(row.amount),
      measuredFrom: touched ? 'activity' : 'deal_created',
    });
  }

  // Oldest first: the point of the list is what has been sitting longest.
  return alerts.sort(
    (a, b) =>
      b.daysSinceLastActivity - a.daysSinceLastActivity ||
      (b.openAmount ?? 0) - (a.openAmount ?? 0) ||
      a.opportunityName.localeCompare(b.opportunityName),
  );
}
