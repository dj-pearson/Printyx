// AI Employee analytics — /ai-employee/ai-employees/analytics/overview
// Replaces server/routes/ai-employee-routes.ts::266-335.
//
// Express file returned mock data; we aggregate from real ai_employee_tasks
// where possible and fall back to defaults when the tenant has no history.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  // pathParts: ['ai-employees', 'analytics', 'overview']
  if (method !== 'GET' || pathParts[1] !== 'analytics' || pathParts[2] !== 'overview') {
    return null;
  }

  const { data: employeesRaw } = await db
    .from('ai_employees')
    .select('id, employee_type, status, success_rate, total_tasks_completed')
    .eq('tenant_id', auth.tenantId);
  const employees = (employeesRaw ?? []) as Array<{
    id: string;
    employee_type: string;
    status: string | null;
    success_rate: number | null;
    total_tasks_completed: number | null;
  }>;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

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

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === 'active').length;
  const totalTasksToday = todayTasks.length;
  const completedTasksToday = todayTasks.filter((t) => t.status === 'completed').length;

  const avgQuality =
    todayTasks
      .map((t) => Number(t.quality_score))
      .filter((n) => Number.isFinite(n))
      .reduce((sum, v, _, arr) => sum + v / arr.length, 0) || 0;

  const avgResponseTime =
    todayTasks
      .map((t) => Number(t.execution_time_minutes))
      .filter((n) => Number.isFinite(n))
      .reduce((sum, v, _, arr) => sum + v / arr.length, 0) || 0;

  // Group employees by type with efficiency = mean success_rate.
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
    efficiency: bucket.count > 0 ? Math.round((bucket.sumSuccessRate / bucket.count) * 100) : 0,
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
        employeeTypes,
      },
    },
    200,
    req,
    requestId,
  );
}
