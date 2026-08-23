// AI Employee analytics — /ai-employee/ai-employees/analytics/overview
// Replaces server/routes/ai-employee-routes.ts + services/ai-employee-service.ts
// ::getAnalyticsOverview.
//
// PROD-008b: this handler was written against the PRE-AUDIT-015 Express file,
// which returned mock data. AUDIT-015 then rewrote the Express side to aggregate
// real rows and to return four more keys — costSavings, customerSatisfaction,
// recentTasks, performanceTrends — and this port was never updated. That is not
// cosmetic: AIEmployeeDashboard.tsx does `analytics.recentTasks.map(...)` and
// `analytics.performanceTrends.tasksCompleted.map(...)` with no guard, and the
// `?? EMPTY_ANALYTICS` fallback never fires because `data` is a truthy object.
// So the page threw a TypeError on render. All four keys are returned now.
//
// costSavings stays null on purpose: nothing in the schema records a saving, and
// the Express version is explicit that it is "never invented". Same here.
//
// KNOWN DIVERGENCE, deliberate: Express averages quality and response time over
// EVERY task the tenant has ever had (its AVG columns carry no date predicate).
// Reproducing that here would mean scanning the whole table through PostgREST,
// which silently truncates at db-max-rows and would make the figure quietly
// wrong for any busy tenant — the exact failure AUDIT-006 fixed in billing. These
// averages are scoped to today's tasks, which is bounded and defensible; moving
// both sides onto one definition is a follow-up.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const TREND_DAYS = 7;

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  // pathParts: ['ai-employees', 'analytics', 'overview']
  if (method !== 'GET' || pathParts[1] !== 'analytics' || pathParts[2] !== 'overview') {
    return null;
  }

  const { data: employeesRaw, error: employeesError } = await db
    .from('ai_employees')
    .select('id, employee_name, employee_type, status, success_rate, user_satisfaction_rating')
    .eq('tenant_id', auth.tenantId);
  if (employeesError) {
    return errorResponse(500, 'Failed to fetch AI employee analytics', req, {
      code: 'DB_ERROR',
      details: employeesError.message,
      requestId,
    });
  }
  const employees = (employeesRaw ?? []) as Array<{
    id: string;
    employee_name: string | null;
    employee_type: string;
    status: string | null;
    success_rate: number | null;
    user_satisfaction_rating: number | null;
  }>;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const trendStart = new Date(todayStart);
  trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));

  const { data: todayTasksRaw } = await db
    .from('ai_employee_tasks')
    .select('status, quality_score, execution_time_minutes')
    .eq('tenant_id', auth.tenantId)
    .gte('assigned_at', todayStart.toISOString());
  const todayTasks = (todayTasksRaw ?? []) as Array<{
    status: string | null;
    quality_score: number | null;
    execution_time_minutes: number | null;
  }>;

  // Ten most recent tasks, employee name resolved from the list already loaded
  // rather than a PostgREST embed (the FK name is not relied on here).
  const { data: recentRaw } = await db
    .from('ai_employee_tasks')
    .select('id, task_type, status, employee_id, execution_time_minutes')
    .eq('tenant_id', auth.tenantId)
    .order('assigned_at', { ascending: false })
    .limit(10);
  const nameById = new Map(employees.map((e) => [String(e.id), e.employee_name ?? '']));
  const recentTasks = ((recentRaw ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ''),
    type: String(r.task_type ?? ''),
    status: String(r.status ?? ''),
    employee: nameById.get(String(r.employee_id ?? '')) || 'Unassigned',
    duration: r.execution_time_minutes == null ? '—' : `${Number(r.execution_time_minutes)}m`,
  }));

  // Seven day-buckets, oldest first. Days with no tasks stay at 0 rather than
  // collapsing out of the series, which would misalign the chart against its
  // axis — the reason the Express query uses generate_series.
  const { data: trendRaw } = await db
    .from('ai_employee_tasks')
    .select('status, quality_score, execution_time_minutes, assigned_at')
    .eq('tenant_id', auth.tenantId)
    .gte('assigned_at', trendStart.toISOString());
  const buckets = Array.from({ length: TREND_DAYS }, () => ({
    completed: 0,
    qualitySum: 0,
    qualityCount: 0,
    timeSum: 0,
    timeCount: 0,
  }));
  const dayMs = 24 * 60 * 60 * 1000;
  for (const row of (trendRaw ?? []) as Array<Record<string, unknown>>) {
    if (!row.assigned_at) continue;
    const index = Math.floor(
      (new Date(String(row.assigned_at)).getTime() - trendStart.getTime()) / dayMs,
    );
    if (index < 0 || index >= TREND_DAYS) continue;
    const bucket = buckets[index];
    if (row.status === 'completed') bucket.completed += 1;
    const quality = Number(row.quality_score);
    if (Number.isFinite(quality)) {
      bucket.qualitySum += quality;
      bucket.qualityCount += 1;
    }
    const minutes = Number(row.execution_time_minutes);
    if (Number.isFinite(minutes)) {
      bucket.timeSum += minutes;
      bucket.timeCount += 1;
    }
  }

  const mean = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === 'active').length;
  const totalTasksToday = todayTasks.length;
  const completedTasksToday = todayTasks.filter((t) => t.status === 'completed').length;

  const avgQuality = mean(
    todayTasks.map((t) => Number(t.quality_score)).filter((n) => Number.isFinite(n)),
  );
  const avgResponseTime = mean(
    todayTasks.map((t) => Number(t.execution_time_minutes)).filter((n) => Number.isFinite(n)),
  );
  const customerSatisfaction = mean(
    employees.map((e) => Number(e.user_satisfaction_rating)).filter((n) => Number.isFinite(n)),
  );

  // Group employees by type with efficiency = mean success_rate, reported on the
  // column's own scale exactly as the Express aggregate does.
  const byType = new Map<string, { count: number; sumSuccessRate: number }>();
  for (const e of employees) {
    const bucket = byType.get(e.employee_type) ?? { count: 0, sumSuccessRate: 0 };
    bucket.count += 1;
    bucket.sumSuccessRate += Number(e.success_rate ?? 0);
    byType.set(e.employee_type, bucket);
  }
  const employeeTypes = Array.from(byType.entries()).map(([type, bucket]) => ({
    type,
    count: bucket.count,
    efficiency: bucket.count > 0 ? bucket.sumSuccessRate / bucket.count : 0,
  }));

  return jsonResponse(
    {
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        totalTasksToday,
        completedTasksToday,
        averageQualityScore: Math.round(avgQuality),
        averageResponseTime: Number(avgResponseTime.toFixed(1)),
        costSavings: null,
        customerSatisfaction,
        employeeTypes,
        recentTasks,
        performanceTrends: {
          tasksCompleted: buckets.map((b) => b.completed),
          qualityScores: buckets.map((b) => (b.qualityCount ? b.qualitySum / b.qualityCount : 0)),
          responseTime: buckets.map((b) => (b.timeCount ? b.timeSum / b.timeCount : 0)),
        },
      },
    },
    200,
    req,
    requestId,
  );
}
