/**
 * The Advanced Reporting page's figures (UI-DEAD-BUTTONS-001, round 208).
 *
 * Every derivation the page used to do inline was wrong in a way that read as
 * a quiet business rather than a broken report:
 *  - revenue read `issuedAt`/`totalAmount` off rows the normaliser gave
 *    `issueDate` and the raw `total_amount`, so every invoice was filtered out
 *    and the revenue chart and Total Revenue were permanently empty/$0;
 *  - a "target" line was revenue x 1.1 - a number that tracks whatever
 *    happened, drawn as if it were a goal;
 *  - customer "profitability" priced service at an invented $75 per labour
 *    hour, ranked only the FIRST TEN customers the list returned, and joined
 *    invoices through contracts, dropping any invoice with no contract;
 *  - contract volume summed `black_copies`/`color_copies`, which default to 0
 *    (COP-B05), and divided a MONTHLY base by an all-time copy count;
 *  - every figure was computed over ONE PAGE of each list (contracts default
 *    to 50 rows) and presented as the whole.
 *
 * Here, each figure comes from a real column, a missing value stays null, and
 * the rows passed in are every page (fetch-all-records.ts).
 */
import { normalizeTicketStatus, normalizeTicketPriority } from '@shared/service-ticket-vocabulary';
import { monthlyVolumeFor, type AssessmentReading } from '@shared/fleet-assessment';

type Row = Record<string, unknown>;
const pick = (r: Row, ...keys: string[]): unknown => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const time = (v: unknown): number | null => {
  if (!v) return null;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : null;
};

export interface DateRange {
  from: Date;
  to: Date;
}
const inRange = (t: number | null, r: DateRange) =>
  t !== null && t >= r.from.getTime() && t <= r.to.getTime();

/** yyyy-MM in UTC, so a month bucket does not move with the viewer's offset. */
const monthKey = (t: number) => new Date(t).toISOString().slice(0, 7);

export interface MonthRevenue {
  month: string;
  revenue: number;
  invoices: number;
}

/** Invoiced revenue per month, by invoice date, oldest first. */
export function revenueByMonth(invoices: Row[], range: DateRange): MonthRevenue[] {
  const byMonth = new Map<string, MonthRevenue>();
  for (const inv of invoices) {
    const t = time(pick(inv, 'invoice_date', 'invoiceDate', 'issued_at', 'issuedAt'));
    if (!inRange(t, range)) continue;
    const key = monthKey(t!);
    const cur = byMonth.get(key) ?? { month: key, revenue: 0, invoices: 0 };
    cur.revenue += num(pick(inv, 'total_amount', 'totalAmount')) ?? 0;
    cur.invoices += 1;
    byMonth.set(key, cur);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface CustomerRevenue {
  customerId: string;
  customer: string;
  revenue: number;
  unpaid: number;
  invoices: number;
}

/**
 * Invoiced revenue and unpaid balance per customer in the range, highest
 * revenue first. Taken from invoices.customer_id directly, so an invoice with
 * no contract still counts. No cost, profit or margin: nothing records what
 * serving a customer costs.
 */
export function revenueByCustomer(
  invoices: Row[],
  customers: Row[],
  range: DateRange,
  limit = 10,
): CustomerRevenue[] {
  const names = new Map(
    customers.map((c) => [
      String(c.id),
      String(pick(c, 'company_name', 'companyName', 'business_name') ?? ''),
    ]),
  );
  const by = new Map<string, CustomerRevenue>();
  for (const inv of invoices) {
    const t = time(pick(inv, 'invoice_date', 'invoiceDate', 'issued_at', 'issuedAt'));
    if (!inRange(t, range)) continue;
    const id = String(pick(inv, 'customer_id', 'customerId') ?? 'unknown');
    const cur = by.get(id) ?? {
      customerId: id,
      customer: names.get(id) || (id === 'unknown' ? 'No customer' : 'Unknown customer'),
      revenue: 0,
      unpaid: 0,
      invoices: 0,
    };
    cur.revenue += num(pick(inv, 'total_amount', 'totalAmount')) ?? 0;
    cur.unpaid += num(pick(inv, 'balance_due', 'balanceDue')) ?? 0;
    cur.invoices += 1;
    by.set(id, cur);
  }
  return [...by.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export interface ServiceMetrics {
  totalTickets: number;
  completedTickets: number;
  /** Mean hours from raised to resolved; null when nothing resolved. */
  averageResolutionHours: number | null;
  byPriority: { priority: string; count: number }[];
}

export function serviceMetrics(tickets: Row[], range: DateRange): ServiceMetrics {
  const inWindow = tickets.filter((t) => inRange(time(pick(t, 'created_at', 'createdAt')), range));
  const completed = inWindow.filter(
    (t) => normalizeTicketStatus(pick(t, 'status')) === 'completed',
  );
  const hours = completed
    .map((t) => {
      const a = time(pick(t, 'created_at', 'createdAt'));
      const b = time(pick(t, 'resolved_at', 'resolvedAt'));
      return a !== null && b !== null && b >= a ? (b - a) / 3_600_000 : null;
    })
    .filter((h): h is number => h !== null);
  const priorities = ['low', 'medium', 'high', 'urgent'] as const;
  return {
    totalTickets: inWindow.length,
    completedTickets: completed.length,
    averageResolutionHours: hours.length
      ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10
      : null,
    byPriority: priorities.map((p) => ({
      priority: p[0].toUpperCase() + p.slice(1),
      count: inWindow.filter((t) => normalizeTicketPriority(pick(t, 'priority')) === p).length,
    })),
  };
}

export interface ContractVolume {
  contract: string;
  customer: string;
  monthlyBase: number | null;
  /** Pages per month from the lifetime counters; null when not derivable. */
  monthlyPages: number | null;
  /** Monthly base over monthly pages; null when either is missing. */
  basePerPage: number | null;
  machines: number;
}

/**
 * Monthly page volume per contract, from each machine's lifetime counters
 * (shared/fleet-assessment.ts). A contract whose machines have too few
 * readings, or a counter that went backwards, has no volume - null, not 0.
 */
export function contractVolumes(
  contracts: Row[],
  readings: Row[],
  customers: Row[],
): ContractVolume[] {
  const names = new Map(
    customers.map((c) => [
      String(c.id),
      String(pick(c, 'company_name', 'companyName', 'business_name') ?? ''),
    ]),
  );
  const byContract = new Map<string, AssessmentReading[]>();
  for (const r of readings) {
    const cid = pick(r, 'contract_id', 'contractId');
    const eid = pick(r, 'equipment_id', 'equipmentId');
    const date = pick(r, 'reading_date', 'readingDate');
    if (!cid || !eid || !date) continue;
    const list = byContract.get(String(cid)) ?? [];
    list.push({
      equipmentId: String(eid),
      readingDate: String(date),
      bwMeterReading: num(pick(r, 'bw_meter_reading', 'bwMeterReading')),
      colorMeterReading: num(pick(r, 'color_meter_reading', 'colorMeterReading')),
    });
    byContract.set(String(cid), list);
  }
  return contracts.map((c) => {
    const rs = byContract.get(String(c.id)) ?? [];
    const machines = [...new Set(rs.map((r) => r.equipmentId))];
    let pages: number | null = null;
    for (const m of machines) {
      const v = monthlyVolumeFor(m, rs);
      if (v.monthlyBlack === null && v.monthlyColor === null) continue;
      pages = (pages ?? 0) + (v.monthlyBlack ?? 0) + (v.monthlyColor ?? 0);
    }
    const base = num(pick(c, 'monthly_base', 'monthlyBase'));
    return {
      contract: String(pick(c, 'contract_number', 'contractNumber') ?? c.id),
      customer: names.get(String(pick(c, 'customer_id', 'customerId'))) || 'Unknown customer',
      monthlyBase: base,
      monthlyPages: pages === null ? null : Math.round(pages),
      basePerPage: base !== null && pages ? base / pages : null,
      machines: machines.length,
    };
  });
}
