// Task stats — replaces supabase/functions/tasks-stats/.
//
// Path: GET /tasks/stats
// Returns: counts by status, priority, overdue, due-today, my-tasks (current user).

import { jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { startOfNextUtcDay, startOfUtcDay } from '../../_shared/date-months.ts';

export async function handleStats(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId } = ctx;
  if (method !== 'GET') return null;

  const now = new Date();
  // DATE-LOCAL-002. due_date is a calendar date stored at midnight, so a
  // boundary carrying a time of day misclassifies the current day. These two
  // counts used to OVERLAP: "overdue" was `< now`, which from 00:00 onward
  // includes everything due today, and "due today" counted the same rows again.
  // The day starts at UTC midnight and ends at the start of the next one, so
  // the two sets are disjoint and neither has a sub-millisecond gap.
  const startOfDay = startOfUtcDay(now).toISOString();
  const startOfTomorrow = startOfNextUtcDay(now).toISOString();

  const [all, byStatus, byPriority, overdue, dueToday, mine] = await Promise.all([
    db.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', auth.tenantId),
    db.from('tasks').select('status').eq('tenant_id', auth.tenantId),
    db.from('tasks').select('priority').eq('tenant_id', auth.tenantId),
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .lt('due_date', startOfDay)
      .not('status', 'in', '(completed,cancelled)'),
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .gte('due_date', startOfDay)
      .lt('due_date', startOfTomorrow)
      .not('status', 'in', '(completed,cancelled)'),
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('assigned_to', auth.userId)
      .not('status', 'in', '(completed,cancelled)'),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const r of (byStatus.data ?? []) as Array<{ status: string }>) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }
  const priorityCounts: Record<string, number> = {};
  for (const r of (byPriority.data ?? []) as Array<{ priority: string }>) {
    priorityCounts[r.priority] = (priorityCounts[r.priority] ?? 0) + 1;
  }

  return jsonResponse(
    {
      total: all.count ?? 0,
      byStatus: statusCounts,
      byPriority: priorityCounts,
      overdue: overdue.count ?? 0,
      dueToday: dueToday.count ?? 0,
      myOpen: mine.count ?? 0,
    },
    200,
    req,
    requestId,
  );
}
