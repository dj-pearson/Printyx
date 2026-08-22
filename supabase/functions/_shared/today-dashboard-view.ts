// Row -> response shapes for GET /dashboards/today (PROD-008).
//
// The page at client/src/pages/TodayDashboard.tsx ("My Day" in the sidebar)
// types TodayViewData and destructures it with `= []` defaults. The edge
// function used to answer with {activitiesCount, newTickets, newDeals,
// newDealValue} - four keys the page never reads - so in production every panel
// rendered empty and every stat read 0, with no error to explain it. Dev ran a
// different handler entirely (server/routes-today-dashboard.ts, unproxied
// prefix), which is why this went unnoticed.
//
// The mappers live here, taking snake_case PostgREST rows, so the response shape
// is testable from Node without a database or a Deno runtime. Locked by
// server/tests/unit/today-dashboard-view.test.ts.

import { toNumber } from './quote-math.ts';

export interface ActivityRow {
  id?: unknown;
  subject?: unknown;
  activity_type?: unknown;
  scheduled_date?: unknown;
  due_date?: unknown;
  completed_date?: unknown;
  description?: unknown;
  business_record_id?: unknown;
}

export interface ActivityView {
  id: string;
  title: string;
  type: string;
  scheduledDate: string | null;
  dueDate: string | null;
  status: 'pending' | 'completed';
  customerName?: string;
  customerId: string | null;
  notes: string | null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function nullableStr(value: unknown): string | null {
  return value == null || value === '' ? null : str(value);
}

/**
 * business_record_activities has no `priority` and no `status` column. The
 * Express handler used to emit a hardcoded 'medium' and 'pending' for both on
 * every row; priority is omitted entirely here (nothing backs it) and status is
 * derived from completed_date, which is the only record of whether the activity
 * is done.
 */
export function toActivityView(
  row: ActivityRow,
  companyNames: Map<string, string | null>,
): ActivityView {
  const recordId = nullableStr(row.business_record_id);
  const name = recordId ? companyNames.get(recordId) : null;
  return {
    id: str(row.id),
    title: str(row.subject) || 'Untitled Activity',
    type: str(row.activity_type) || 'task',
    scheduledDate: nullableStr(row.scheduled_date),
    dueDate: nullableStr(row.due_date),
    status: row.completed_date ? 'completed' : 'pending',
    customerName: name ?? undefined,
    customerId: recordId,
    notes: nullableStr(row.description),
  };
}

export interface LeadScoreRow {
  id?: unknown;
  lead_id?: unknown;
  total_score?: unknown;
  lead_grade?: unknown;
  lead_tier?: unknown;
}

export interface BusinessRecordRow {
  id?: unknown;
  company_name?: unknown;
  primary_contact_name?: unknown;
  // The DB column is estimated_deal_value. Drizzle exposes it under the
  // property name `estimatedAmount`, which is what the Express handler reads -
  // the two names are not interchangeable and PostgREST only knows the first.
  estimated_deal_value?: unknown;
  status?: unknown;
  last_contact_date?: unknown;
}

export interface LeadView {
  id: string;
  companyName: string;
  contactName?: string;
  estimatedValue: number;
  score: number;
  status: string;
  lastContact: string | null;
  reason: string;
}

export function toLeadView(
  lead: LeadScoreRow,
  recordsById: Map<string, BusinessRecordRow>,
): LeadView {
  const leadId = nullableStr(lead.lead_id);
  const record = leadId ? recordsById.get(leadId) : undefined;
  return {
    id: leadId || str(lead.id),
    companyName: str(record?.company_name) || 'Unknown',
    contactName: nullableStr(record?.primary_contact_name) ?? undefined,
    // numeric; PostgREST returns numeric as a string.
    estimatedValue: toNumber(record?.estimated_deal_value),
    score: toNumber(lead.total_score),
    status: str(record?.status) || 'lead',
    lastContact: nullableStr(record?.last_contact_date),
    reason: `${str(lead.lead_grade) || 'A'} grade lead - ${str(lead.lead_tier) || 'qualified'}`,
  };
}

export interface DealRow {
  id?: unknown;
  title?: unknown;
  company_name?: unknown;
  amount?: unknown;
  probability?: unknown;
  stage_id?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface DealView {
  id: string;
  title: string;
  companyName: string;
  value: number;
  stage: string;
  daysSinceUpdate: number;
  probability: number;
  staleReason?: string;
}

export function daysSince(row: DealRow, now: Date): number {
  const raw = row.updated_at ?? row.created_at;
  if (raw == null) return 0;
  const then = new Date(str(raw)).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 86400000));
}

/**
 * A deal's stage is a FK (deals.stage_id -> pipeline_stages), not a string on
 * the deal. An id with no matching stage row renders as 'Unknown' rather than
 * leaking the uuid into the UI.
 */
export function toStaleDealView(
  row: DealRow,
  stageNames: Map<string, string>,
  now: Date,
): DealView {
  const stage = stageNames.get(str(row.stage_id)) ?? 'Unknown';
  const days = daysSince(row, now);
  return {
    id: str(row.id),
    title: str(row.title) || 'Unnamed Deal',
    companyName: str(row.company_name) || 'Unknown',
    value: toNumber(row.amount),
    stage,
    daysSinceUpdate: days,
    probability: Math.round(toNumber(row.probability)),
    staleReason: `Stalled in ${stage} stage for ${days} days`,
  };
}

export function toWonDealView(row: DealRow): DealView {
  return {
    id: str(row.id),
    title: str(row.title) || 'Unnamed Deal',
    companyName: str(row.company_name) || 'Unknown',
    value: toNumber(row.amount),
    stage: 'won',
    daysSinceUpdate: 0,
    probability: 100,
  };
}

export interface TodayStats {
  /**
   * null, not 0. Both of these are a SUM over the tenant's whole deals table and
   * PostgREST has no aggregate, so the only ways to produce them here are to
   * pull every row (which truncates silently at db-max-rows and would report a
   * quietly wrong pipeline value for exactly the busy tenants who care - the
   * failure AUDIT-006 fixed in billing) or to add a versioned Postgres function
   * and call it through rpc, which needs PA-037 settled first. A number the
   * viewer cannot trust is worse than an absent one, so the page renders these
   * as unavailable. See the PROD-008 note.
   */
  pipelineValue: number | null;
  quotaAttainment: number | null;
  /** Exact: PostgREST counts these server-side with head + count: 'exact'. */
  conversionRate: number;
  tasksCompleted: number;
}

export function conversionRate(leadCount: number, customerCount: number): number {
  const total = leadCount + customerCount;
  return total > 0 ? Math.round((customerCount / total) * 100) : 0;
}

/** UTC day/week windows. The panels below are all "since/until" filters. */
export function todayWindows(now: Date) {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  endOfDay.setUTCMilliseconds(-1);

  const yesterday = new Date(startOfDay);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // +1ms past the end of today. setUTCMilliseconds(1) does NOT do this - it sets
  // the millisecond field within the same second, giving 23:59:59.001.
  const upcomingFrom = new Date(endOfDay.getTime() + 1);
  const upcomingTo = new Date(startOfDay);
  upcomingTo.setUTCDate(upcomingTo.getUTCDate() + 4);

  // Week starts Sunday, matching date-fns' default in the Express handler.
  const weekStart = new Date(startOfDay);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  weekEnd.setUTCMilliseconds(-1);

  return { startOfDay, endOfDay, yesterday, upcomingFrom, upcomingTo, weekStart, weekEnd };
}
