/**
 * The numbers on the React Native home and reports screens (PROD-008).
 *
 * `/api/mobile/dashboard` had three consumers and three different ideas of what
 * it returns, and none of them matched what it actually sent:
 *
 *   mobile/(dashboard)/index.tsx   reads openLeads, activeTickets, revenueMtd,
 *                                  totalEquipment, revenueTrend, leadsTrend
 *   mobile/(service)/field-service reads the response as a ticket LIST -
 *                                  `assignments?.tickets || assignments?.assignments`
 *   client/src/MobileServiceApp    reads jobsQueue
 *
 * and the Express handler answered a FIXTURE: "TECH-001", a 4.8 rating, 1247
 * completed jobs, $2,340.50 of revenue today, and invented customers at
 * invented coordinates. So the dashboard screen showed "$—" and blanks, the
 * field-service screen had nothing to act on, and only the web page's key
 * happened to line up - with fiction.
 *
 * The arithmetic lives here rather than in the handler because these are the
 * rules that get quietly dropped inside one:
 *
 * A TREND OVER AN EMPTY PREVIOUS WINDOW IS NULL, NOT ZERO (AUDIT-021). A tenant
 * in its first month has no trend, and 0% is a claim that nothing changed.
 *
 * ZERO IS A MEASUREMENT WHEN THE ROWS WERE LOOKED FOR. An empty ticket queue on
 * a quiet Tuesday is a real answer; it is the sections that could not be READ
 * that answer null, and the handler decides which by catching per section.
 *
 * A TOTAL OVER AN UNPAID INVOICE IS NOT REVENUE. `revenueMtd` sums `amount_paid`
 * on invoices settled this month, not `total_amount` on invoices raised - money
 * billed is not money collected, and a home screen that conflates them tells a
 * dealer they are doing better than they are.
 */

/** A Drizzle/PostgREST decimal arrives as a string; anything unparseable is not a zero. */
function money(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface PaidInvoiceRow {
  amountPaid?: string | number | null;
  paidDate?: string | null;
}

export interface LeadRow {
  createdAt?: string | null;
}

export interface MobileDashboardTotals {
  revenueMtd: number;
  /** Invoices settled this month carrying no amount - the total is a floor. */
  uncostedPaidCount: number;
  revenueTrend: number | null;
  leadsTrend: number | null;
  openLeads: number;
}

/** Start of the UTC month containing `now`. */
export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of the UTC month before the one containing `now`. */
export function previousUtcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

/**
 * Percentage change, or null when the baseline cannot support one.
 *
 * A previous window of zero has no percentage: going from nothing to something
 * is not "up 100%", it is the first of its kind, and printing a number there is
 * how a home screen invents momentum.
 */
export function percentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface MonthToDateRevenue {
  /** Collected this calendar month, in UTC. */
  revenueMtd: number;
  /** Collected in the month before it, for a trend. */
  revenuePrev: number;
  /** Invoices settled this month carrying no amount - the total is a floor. */
  uncostedPaidCount: number;
}

/**
 * Money COLLECTED in the current and previous UTC month.
 *
 * The one definition of revenue these screens share. The home screen shows it
 * with a trend and the reports screen shows it alone; computing it twice is how
 * two surfaces of one app end up quoting different figures for the same month.
 *
 * It sums `amount_paid` on invoices with a `paid_date`, never `total_amount` on
 * invoices raised - money billed is not money collected. An invoice settled
 * this month with no amount recorded is COUNTED rather than treated as zero, so
 * the caller can say the total is a floor (COP-B05).
 */
export function monthToDateRevenue(
  paidInvoices: readonly PaidInvoiceRow[],
  now: Date,
): MonthToDateRevenue {
  const monthStart = utcMonthStart(now).getTime();
  const prevStart = previousUtcMonthStart(now).getTime();

  let revenueMtd = 0;
  let revenuePrev = 0;
  let uncostedPaidCount = 0;

  for (const row of paidInvoices) {
    if (!row.paidDate) continue;
    const at = new Date(row.paidDate).getTime();
    if (Number.isNaN(at) || at < prevStart) continue;
    const amount = money(row.amountPaid);
    if (amount === null) {
      if (at >= monthStart) uncostedPaidCount += 1;
      continue;
    }
    if (at >= monthStart) revenueMtd += amount;
    else revenuePrev += amount;
  }

  return { revenueMtd, revenuePrev, uncostedPaidCount };
}

/**
 * Month-to-date revenue and the two trends, from rows spanning BOTH months.
 *
 * One fetch covering the whole window, split here, so the two halves cannot be
 * measured against different boundaries - the defect AUDIT-021 found in the
 * customer portal, where a "previous period" was the current one times 0.9.
 */
export function summariseMobileDashboard(
  paidInvoices: readonly PaidInvoiceRow[],
  leads: readonly LeadRow[],
  now: Date,
): MobileDashboardTotals {
  const monthStart = utcMonthStart(now).getTime();
  const prevStart = previousUtcMonthStart(now).getTime();

  const { revenueMtd, revenuePrev, uncostedPaidCount } = monthToDateRevenue(paidInvoices, now);

  let openLeads = 0;
  let leadsPrev = 0;
  for (const row of leads) {
    if (!row.createdAt) {
      // A lead with no created date is still a lead. It counts toward the
      // total and toward neither month, so it cannot skew the trend.
      openLeads += 1;
      continue;
    }
    const at = new Date(row.createdAt).getTime();
    if (Number.isNaN(at)) {
      openLeads += 1;
      continue;
    }
    openLeads += 1;
    if (at >= monthStart) continue;
    if (at >= prevStart) leadsPrev += 1;
  }

  const leadsThisMonth = leads.filter((l) => {
    if (!l.createdAt) return false;
    const at = new Date(l.createdAt).getTime();
    return !Number.isNaN(at) && at >= monthStart;
  }).length;

  return {
    revenueMtd,
    uncostedPaidCount,
    revenueTrend: percentageChange(revenueMtd, revenuePrev),
    leadsTrend: percentageChange(leadsThisMonth, leadsPrev),
    openLeads,
  };
}

export interface TicketRow {
  id?: string | null;
  ticketNumber?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  customerId?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  scheduledDate?: string | null;
  estimatedDuration?: number | string | null;
  requiredParts?: unknown;
}

export interface MobileTicket {
  id: string;
  ticketNumber: string | null;
  title: string | null;
  issueDescription: string | null;
  priority: string | null;
  status: string | null;
  customerId: string | null;
  customerName: string | null;
  address: string | null;
  contactPhone: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  requiredParts: unknown[];
}

/**
 * The technician's queue, in the order they will work it.
 *
 * Scheduled first and soonest first; anything unscheduled goes last rather than
 * to the top, because a ticket with no time on it is not the most urgent thing
 * in the day - it is the one nobody has placed yet.
 */
export function toMobileTickets(
  rows: readonly TicketRow[],
  customerNames: ReadonlyMap<string, string>,
): MobileTicket[] {
  const tickets = rows
    .filter((r): r is TicketRow & { id: string } => Boolean(r.id))
    .map((r) => ({
      id: r.id,
      ticketNumber: r.ticketNumber ?? null,
      title: r.title ?? null,
      issueDescription: r.description ?? null,
      priority: r.priority ?? null,
      status: r.status ?? null,
      customerId: r.customerId ?? null,
      customerName: (r.customerId && customerNames.get(r.customerId)) || null,
      address: r.customerAddress ?? null,
      contactPhone: r.customerPhone ?? null,
      scheduledTime: r.scheduledDate ?? null,
      estimatedDuration:
        r.estimatedDuration == null || r.estimatedDuration === ''
          ? null
          : Number(r.estimatedDuration),
      requiredParts: Array.isArray(r.requiredParts) ? r.requiredParts : [],
    }));

  return tickets.sort((a, b) => {
    if (a.scheduledTime && b.scheduledTime) {
      return a.scheduledTime.localeCompare(b.scheduledTime) || a.id.localeCompare(b.id);
    }
    if (a.scheduledTime) return -1;
    if (b.scheduledTime) return 1;
    return a.id.localeCompare(b.id);
  });
}

export interface CloseRateDealRow {
  status?: string | null;
  actualCloseDate?: string | null;
}

export interface CloseRateSummary {
  /** Won as a percentage of DECIDED deals, or null when nothing was decided. */
  closeRate: number | null;
  wonCount: number;
  lostCount: number;
  /** Deals that reached a decision in the window - the denominator. */
  decidedCount: number;
  /** Decided deals carrying no close date, so the window could not place them. */
  undatedDecidedCount: number;
}

/**
 * Close rate over deals DECIDED in a window.
 *
 * The denominator is won plus lost, not every deal the tenant has. A pipeline
 * full of open deals is not a pile of losses, and dividing by it produces a
 * figure that falls whenever a rep prospects well - the opposite of what the
 * card is read as saying.
 *
 * `status` is the discriminator, matching shared/team-rollup.ts: the canonical
 * stage-move path writes `status`, `probability` and `actual_close_date`
 * together, so the column is maintained by the same write that moves the card.
 * A status nobody recognises is neither won nor lost and stays out of both.
 *
 * NULL WHEN NOTHING CLOSED. A tenant with an all-open pipeline has no close
 * rate, and 0% is a claim that every attempt failed.
 *
 * A decided deal with no close date is COUNTED SEPARATELY rather than assumed
 * to be in the window: placing it here would move the rate whenever an old deal
 * happened to be missing a date, and dropping it silently understates activity.
 */
export function summariseCloseRate(
  rows: readonly CloseRateDealRow[],
  since: Date,
  now: Date,
): CloseRateSummary {
  const from = since.getTime();
  const to = now.getTime();
  let wonCount = 0;
  let lostCount = 0;
  let undatedDecidedCount = 0;

  for (const row of rows) {
    const status = (row.status ?? '').trim().toLowerCase();
    if (status !== 'won' && status !== 'lost') continue;

    if (!row.actualCloseDate) {
      undatedDecidedCount += 1;
      continue;
    }
    const at = new Date(row.actualCloseDate).getTime();
    if (Number.isNaN(at)) {
      undatedDecidedCount += 1;
      continue;
    }
    if (at < from || at > to) continue;

    if (status === 'won') wonCount += 1;
    else lostCount += 1;
  }

  const decidedCount = wonCount + lostCount;
  return {
    closeRate: decidedCount === 0 ? null : (wonCount / decidedCount) * 100,
    wonCount,
    lostCount,
    decidedCount,
    undatedDecidedCount,
  };
}

export interface TurnaroundTicketRow {
  createdAt?: string | null;
  resolvedAt?: string | null;
}

export interface TurnaroundSummary {
  /** Mean hours from raised to resolved, or null when nothing was resolved. */
  avgTicketHours: number | null;
  resolvedCount: number;
  /** Resolved tickets whose timestamps could not produce an interval. */
  unmeasurableCount: number;
}

/**
 * Average time from a ticket being raised to it being resolved.
 *
 * Only tickets RESOLVED in the window count, and each is measured from its own
 * `created_at` - so a ticket opened in March and closed in April is an April
 * resolution with a six-week turnaround, which is the number a service manager
 * is asking for. Counting by creation date instead would hide every long one
 * until it closed and then attribute it to a month nobody was looking at.
 *
 * A RESOLUTION EARLIER THAN ITS OWN CREATION YIELDS NO INTERVAL. That is a
 * clock skew or a backfilled row, not a ticket closed before it was opened, and
 * a negative duration in a mean drags the average toward a number no ticket
 * took. It is counted as unmeasurable, the same refusal COP-B05 makes on a
 * meter counter that reads lower than it did.
 *
 * NULL WHEN NOTHING RESOLVED, because 0 hours is instant service.
 */
export function summariseTicketTurnaround(
  rows: readonly TurnaroundTicketRow[],
  since: Date,
  now: Date,
): TurnaroundSummary {
  const from = since.getTime();
  const to = now.getTime();
  let totalMs = 0;
  let resolvedCount = 0;
  let unmeasurableCount = 0;

  for (const row of rows) {
    if (!row.resolvedAt) continue;
    const resolved = new Date(row.resolvedAt).getTime();
    if (Number.isNaN(resolved)) continue;
    if (resolved < from || resolved > to) continue;

    const created = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
    if (Number.isNaN(created) || resolved < created) {
      unmeasurableCount += 1;
      continue;
    }
    totalMs += resolved - created;
    resolvedCount += 1;
  }

  return {
    avgTicketHours: resolvedCount === 0 ? null : totalMs / resolvedCount / 3_600_000,
    resolvedCount,
    unmeasurableCount,
  };
}
