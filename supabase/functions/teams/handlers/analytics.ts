// Collaboration analytics — computed from tasks + projects + time_entries.
//
// Path: GET /collaboration/analytics

import { jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  if (ctx.method !== 'GET') return null;
  const { auth, db, requestId } = ctx;

  const [taskTotal, completed, overdue, projectsActive, timeRows] = await Promise.all([
    db.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', auth.tenantId),
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'completed'),
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .lt('due_date', new Date().toISOString())
      .not('status', 'in', '(completed,cancelled)'),
    db
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'active'),
    db
      .from('time_entries')
      .select('hours, user_id, entry_date')
      .eq('tenant_id', auth.tenantId)
      .gte('entry_date', new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(10000),
  ]);

  const times = (timeRows.data ?? []) as Array<{
    hours: number | null;
    user_id: string;
    entry_date: string;
  }>;

  const hoursByUser: Record<string, number> = {};
  let totalHours = 0;
  for (const r of times) {
    const h = r.hours ?? 0;
    totalHours += h;
    hoursByUser[r.user_id] = (hoursByUser[r.user_id] ?? 0) + h;
  }

  const topContributors = Object.entries(hoursByUser)
    .map(([userId, hours]) => ({ userId, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  return jsonResponse(
    {
      period: 'last_30_days',
      tasks: {
        total: taskTotal.count ?? 0,
        completed: completed.count ?? 0,
        overdue: overdue.count ?? 0,
        completionRate:
          (taskTotal.count ?? 0) > 0
            ? Number((((completed.count ?? 0) / (taskTotal.count ?? 1)) * 100).toFixed(1))
            : 0,
      },
      projects: {
        active: projectsActive.count ?? 0,
      },
      time: {
        totalHoursLogged: totalHours,
        topContributors,
      },
    },
    200,
    req,
    requestId,
  );
}
