/**
 * Pre-meeting briefing (COP-B12 AC4).
 *
 * "Assembles the account's recent activity, open deals, installed base, and
 * service state" - the one criterion on that story that needs no transcript,
 * no speech-to-text provider and no entity that does not exist yet. It reads
 * four tables a dealer already fills and answers what a rep should know before
 * they walk in.
 *
 * PostgREST has no GROUP BY, so the grouping is here, and the rules are the
 * ones this repo keeps paying for:
 *
 * A SECTION THAT COULD NOT BE READ IS NULL, NOT EMPTY. The caller passes null
 * for a query that failed, and this returns null for that section rather than
 * a zeroed one. "No open deals" and "we could not look" are different facts,
 * and a briefing is read minutes before a conversation - the wrong one of
 * those sends a rep in believing something.
 *
 * A TOTAL OVER AN UNCOSTED DEAL IS A FLOOR AND SAYS SO (COP-B05). A deal with
 * no amount is counted but adds no money, so the pipeline figure is a lower
 * bound rather than a number the rep can quote.
 *
 * ZERO IS A MEASUREMENT WHEN THE ROWS WERE LOOKED FOR. An account with no
 * equipment gets `machineCount: 0`, because the query ran and found none -
 * which is exactly the fact a rep selling a first machine needs.
 */

export interface BriefingDeal {
  id?: string | null;
  title?: string | null;
  amount?: string | number | null;
  status?: string | null;
  expectedCloseDate?: string | null;
}

export interface BriefingEquipment {
  id?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  equipmentStatus?: string | null;
}

export interface BriefingTicket {
  id?: string | null;
  status?: string | null;
  priority?: string | null;
  createdAt?: string | null;
}

export interface BriefingActivity {
  activityType?: string | null;
  subject?: string | null;
  createdAt?: string | null;
}

export interface MeetingBriefing {
  openDeals: {
    count: number;
    totalAmount: number;
    uncostedCount: number;
    totalIsFloor: boolean;
    soonest: { title: string | null; expectedCloseDate: string | null } | null;
  } | null;
  installedBase: {
    machineCount: number;
    /** Model counts, largest first. A fleet is a shape, not a number. */
    models: Array<{ model: string; count: number }>;
  } | null;
  serviceState: {
    openTickets: number;
    urgentTickets: number;
    lastTicketAt: string | null;
  } | null;
  recentActivity: {
    count: number;
    lastAt: string | null;
    byType: Record<string, number>;
  } | null;
  /** What this briefing cannot answer, named rather than left as a zero. */
  unbacked: string[];
}

const OPEN_TICKET_STATUSES = new Set(['open', 'new', 'in_progress', 'assigned', 'on_hold']);
const URGENT_PRIORITIES = new Set(['urgent', 'critical', 'high']);

function money(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Latest ISO timestamp in a list, or null when none of them carries one. */
function latest(values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isNaN(t)) continue;
    if (best === null || t > Date.parse(best)) best = v;
  }
  return best;
}

export function buildMeetingBriefing(input: {
  deals: readonly BriefingDeal[] | null;
  equipment: readonly BriefingEquipment[] | null;
  tickets: readonly BriefingTicket[] | null;
  activities: readonly BriefingActivity[] | null;
}): MeetingBriefing {
  const unbacked: string[] = [];

  let openDeals: MeetingBriefing['openDeals'] = null;
  if (input.deals === null) {
    unbacked.push('Open deals could not be read for this account.');
  } else {
    let total = 0;
    let uncosted = 0;
    for (const d of input.deals) {
      const amount = money(d.amount);
      if (amount === null) uncosted += 1;
      else total += amount;
    }
    // Soonest close first; a deal with no date cannot be the soonest, because
    // "no date" is not "far away".
    const dated = input.deals
      .filter((d) => d.expectedCloseDate && !Number.isNaN(Date.parse(d.expectedCloseDate)))
      .sort((a, b) => Date.parse(a.expectedCloseDate!) - Date.parse(b.expectedCloseDate!));
    openDeals = {
      count: input.deals.length,
      totalAmount: total,
      uncostedCount: uncosted,
      totalIsFloor: uncosted > 0,
      soonest: dated.length
        ? { title: dated[0].title ?? null, expectedCloseDate: dated[0].expectedCloseDate ?? null }
        : null,
    };
  }

  let installedBase: MeetingBriefing['installedBase'] = null;
  if (input.equipment === null) {
    unbacked.push('The installed base could not be read for this account.');
  } else {
    const counts = new Map<string, number>();
    for (const e of input.equipment) {
      // A machine whose model nobody recorded is still a machine on the floor.
      const model = (e.modelNumber ?? '').trim() || 'Model not recorded';
      counts.set(model, (counts.get(model) ?? 0) + 1);
    }
    installedBase = {
      machineCount: input.equipment.length,
      models: [...counts.entries()]
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model)),
    };
  }

  let serviceState: MeetingBriefing['serviceState'] = null;
  if (input.tickets === null) {
    unbacked.push('Service history could not be read for this account.');
  } else {
    const open = input.tickets.filter((t) =>
      OPEN_TICKET_STATUSES.has((t.status ?? '').trim().toLowerCase()),
    );
    serviceState = {
      openTickets: open.length,
      urgentTickets: open.filter((t) =>
        URGENT_PRIORITIES.has((t.priority ?? '').trim().toLowerCase()),
      ).length,
      lastTicketAt: latest(input.tickets.map((t) => t.createdAt)),
    };
  }

  let recentActivity: MeetingBriefing['recentActivity'] = null;
  if (input.activities === null) {
    unbacked.push('Recent activity could not be read for this account.');
  } else {
    const byType: Record<string, number> = {};
    for (const a of input.activities) {
      const type = (a.activityType ?? '').trim() || 'unspecified';
      byType[type] = (byType[type] ?? 0) + 1;
    }
    recentActivity = {
      count: input.activities.length,
      lastAt: latest(input.activities.map((a) => a.createdAt)),
      byType,
    };
  }

  return { openDeals, installedBase, serviceState, recentActivity, unbacked };
}
