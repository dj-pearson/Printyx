/**
 * Pure logic for the proactive-maintenance half of the `service` edge function
 * (PROD-011), ported from server/routes-proactive-maintenance.ts.
 *
 * THE EXPRESS ENDPOINT HAS NEVER RUN. Its SELECT names two columns that do not
 * exist on `equipment` — `current_meter_reading` and `status` (the real one is
 * `equipment_status`) — so the query throws and GET /api/service/proactive-maintenance
 * 500s every time. None of the health-score logic below has ever executed in
 * either environment. Porting it verbatim would have ported a 500.
 *
 * THE METER FACTOR IS DROPPED, NOT FAKED. The original formula penalised health
 * when a meter reading exceeded a 50,000-page PM interval, but no such column
 * exists and there is no equivalent: readings live in `meter_readings`, which
 * stores bw and colour separately, so "the" reading is bw, colour or their sum —
 * three different health scores, and picking one is a product decision this port
 * will not invent (the Express file's own comment says exactly this). Health is
 * therefore computed from service dates alone and `meterReading` is reported as
 * null rather than 0. Reporting 0 would be a fabricated number that reads as a
 * brand-new machine. The dashboard never renders the field, so nothing is lost.
 */

export type Urgency = 'overdue' | 'urgent' | 'soon' | 'scheduled';

export interface EquipmentRow {
  id: string;
  serial_number?: string | null;
  manufacturer?: string | null;
  model_number?: string | null;
  customer_id?: string | null;
  location_description?: string | null;
  last_service_date?: string | null;
  next_service_due_date?: string | null;
  install_date?: string | null;
  equipment_status?: string | null;
}

export interface MaintenanceItem {
  equipmentId: string;
  serialNumber: string;
  make: string;
  model: string;
  customerName: string;
  customerId: string | null;
  location: string;
  lastServiceDate: string | null;
  daysSinceService: number;
  nextServiceDue: string;
  daysUntilDue: number;
  healthScore: number;
  /** Always null — see the file header. */
  meterReading: number | null;
  urgency: Urgency;
  estimatedIssues?: string[];
}

const DAY_MS = 86_400_000;
const DEFAULT_DUE_WINDOW_MS = 90 * DAY_MS;

/** Sentinel for "never serviced" — carried over from Express so the penalty saturates. */
export const NEVER_SERVICED_DAYS = 9999;

export function daysSinceService(lastServiceDate: string | null | undefined, now: number): number {
  if (!lastServiceDate) return NEVER_SERVICED_DAYS;
  const last = new Date(lastServiceDate).getTime();
  if (!Number.isFinite(last)) return NEVER_SERVICED_DAYS;
  return Math.floor((now - last) / DAY_MS);
}

/** Equipment with no due date is treated as due in 90 days. */
export function nextDueDate(nextServiceDue: string | null | undefined, now: number): Date {
  if (nextServiceDue) {
    const parsed = new Date(nextServiceDue);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return new Date(now + DEFAULT_DUE_WINDOW_MS);
}

/**
 * 0-100, starting at 100 and penalised for being overdue and for a long gap
 * since the last service. Both penalties are capped so one factor cannot sink
 * the score on its own.
 */
export function healthScore(daysUntilDue: number, sinceService: number): number {
  let score = 100;
  if (daysUntilDue < 0) {
    score -= Math.min(50, Math.abs(daysUntilDue) * 2);
  }
  if (sinceService > 180) {
    score -= Math.min(30, (sinceService - 180) / 10);
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Note the boundary: due TODAY (0 days) is 'overdue', not 'urgent'. A machine
 * whose PM is due today has no slack left, so it belongs in the same bucket as
 * one that is late.
 */
export function urgencyFor(daysUntilDue: number): Urgency {
  if (daysUntilDue <= 0) return 'overdue';
  if (daysUntilDue <= 7) return 'urgent';
  if (daysUntilDue <= 30) return 'soon';
  return 'scheduled';
}

export function estimatedIssues(score: number, daysUntilDue: number): string[] {
  const issues: string[] = [];
  if (score < 40) issues.push('High risk of failure');
  else if (score < 60) issues.push('Preventive maintenance recommended');
  else if (score < 80) issues.push('Minor adjustments may be needed');

  if (daysUntilDue < 0) issues.push(`${Math.abs(daysUntilDue)} days overdue`);
  return issues;
}

export function buildMaintenanceItem(
  row: EquipmentRow,
  customerName: string | null,
  now: number,
): MaintenanceItem {
  const sinceService = daysSinceService(row.last_service_date, now);
  const due = nextDueDate(row.next_service_due_date, now);
  const daysUntilDue = Math.floor((due.getTime() - now) / DAY_MS);
  const score = healthScore(daysUntilDue, sinceService);
  const issues = estimatedIssues(score, daysUntilDue);

  return {
    equipmentId: row.id,
    serialNumber: row.serial_number || 'N/A',
    make: row.manufacturer || 'Unknown',
    model: row.model_number || 'Unknown',
    customerName: customerName || 'Unknown Customer',
    customerId: row.customer_id ?? null,
    location: row.location_description || 'Unknown',
    lastServiceDate: row.last_service_date ?? null,
    nextServiceDue: due.toISOString(),
    daysSinceService: sinceService,
    daysUntilDue,
    healthScore: score,
    meterReading: null,
    urgency: urgencyFor(daysUntilDue),
    ...(issues.length > 0 ? { estimatedIssues: issues } : {}),
  };
}

export interface MaintenanceSummary {
  totalEquipment: number;
  overdueCount: number;
  urgentCount: number;
  soonCount: number;
  scheduledCount: number;
  averageHealthScore: number;
  preventableEmergencies: number;
}

/**
 * `preventableEmergencies` is an ESTIMATE, not a count of anything that
 * happened: 70% of the machines currently below a health score of 60, floored.
 * Carried over from Express unchanged, and it is the one number on this
 * dashboard with no observation behind it.
 */
export function summarize(items: MaintenanceItem[]): MaintenanceSummary {
  const count = (u: Urgency) => items.filter((i) => i.urgency === u).length;
  const average =
    items.length > 0 ? items.reduce((sum, i) => sum + i.healthScore, 0) / items.length : 100;

  return {
    totalEquipment: items.length,
    overdueCount: count('overdue'),
    urgentCount: count('urgent'),
    soonCount: count('soon'),
    scheduledCount: count('scheduled'),
    averageHealthScore: Math.round(average),
    preventableEmergencies: Math.floor(items.filter((i) => i.healthScore < 60).length * 0.7),
  };
}

/** PM-<base36 timestamp>, matching the Express ticket-number format. */
export function proactiveTicketNumber(now: number): string {
  return `PM-${now.toString(36).toUpperCase()}`;
}
