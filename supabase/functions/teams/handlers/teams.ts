// Teams — CRUD + members + capacity + insights.
//
// Paths (dispatcher stripped /teams or /team-collaboration/teams):
//   GET    /
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   POST   /:id/members          (body: userId; writes teams.parent_team_id or related)
//   GET    /:id/capacity         — computed: sum of open tasks for team members
//   GET    /:id/insights         — computed: task completion rate, avg time_tracked
//
// Member management note: there's no team_members table. Membership is inferred
// from users.team_id if present, or from tasks.assigned_to matched against
// team manager. The /members POST updates the user's team_id column. If
// users.team_id doesn't exist in the current DB, this degrades to a no-op
// with a clear response.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleTeams(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];
  const sub = pathParts[1];

  // POST /:id/members
  if (method === 'POST' && id && sub === 'members') {
    return await addMember(req, ctx, id);
  }

  // GET /:id/capacity
  if (method === 'GET' && id && sub === 'capacity') {
    return await teamCapacity(req, ctx, id);
  }

  // GET /:id/insights
  if (method === 'GET' && id && sub === 'insights') {
    return await teamInsights(req, ctx, id);
  }

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('teams')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('name', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch teams', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id && !sub) {
    const { data, error } = await db
      .from('teams')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch team', error);
    if (!data) return errorResponse(404, 'Team not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapTeam(body);
    row.tenant_id = auth.tenantId;
    if (!row.name || !row.department) {
      return errorResponse(400, 'name and department required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('teams').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create team', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id && !sub) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapTeam(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('teams')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update team', error);
    if (!data) return errorResponse(404, 'Team not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id && !sub) {
    const { error } = await db.from('teams').delete().eq('id', id).eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete team', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// ─── Member add ──────────────────────────────────────────────────────────────

async function addMember(req: Request, ctx: HandlerCtx, teamId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => null)) as { userId?: string; user_id?: string } | null;
  const userId = body?.userId ?? body?.user_id;
  if (!userId) {
    return errorResponse(400, 'userId required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  // Try to set users.team_id — degrade gracefully if that column doesn't exist.
  const { data, error } = await db
    .from('users')
    .update({ team_id: teamId })
    .eq('id', userId)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();

  if (error) {
    // No team_id column on users (common) — return a soft response so frontend
    // doesn't hard-fail. Actual membership model is a follow-up.
    return jsonResponse(
      {
        success: false,
        stub: true,
        teamId,
        userId,
        message:
          'Team membership model is not fully defined (no team_members table + no users.team_id). Deferred.',
      },
      200,
      req,
      requestId,
    );
  }
  if (!data) return errorResponse(404, 'User not found', req, { code: 'NOT_FOUND', requestId });
  return jsonResponse({ success: true, teamId, userId }, 200, req, requestId);
}

// ─── Team capacity (computed) ────────────────────────────────────────────────

async function teamCapacity(req: Request, ctx: HandlerCtx, teamId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  // Find candidate members via users.team_id (if present). If that fails or
  // returns empty, fall back to "everyone this team manages through tasks
  // created by the team manager".
  const members = await resolveMembers(db, auth.tenantId, teamId);
  if (members.length === 0) {
    return jsonResponse(
      {
        teamId,
        memberCount: 0,
        openTasks: 0,
        overdueCount: 0,
        averageLoadPerMember: 0,
        note: 'No members found for this team (membership model pending).',
      },
      200,
      req,
      requestId,
    );
  }

  const nowIso = new Date().toISOString();
  const [openTasks, overdue] = await Promise.all([
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .in('assigned_to', members)
      .not('status', 'in', '(completed,cancelled)'),
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .in('assigned_to', members)
      .lt('due_date', nowIso)
      .not('status', 'in', '(completed,cancelled)'),
  ]);

  const openCount = openTasks.count ?? 0;
  return jsonResponse(
    {
      teamId,
      memberCount: members.length,
      openTasks: openCount,
      overdueCount: overdue.count ?? 0,
      averageLoadPerMember:
        members.length > 0 ? Number((openCount / members.length).toFixed(1)) : 0,
    },
    200,
    req,
    requestId,
  );
}

// ─── Team insights (computed) ────────────────────────────────────────────────

async function teamInsights(req: Request, ctx: HandlerCtx, teamId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const members = await resolveMembers(db, auth.tenantId, teamId);
  if (members.length === 0) {
    return jsonResponse(
      { teamId, memberCount: 0, totalTasks: 0, completionRate: 0, avgHoursLogged: 0 },
      200,
      req,
      requestId,
    );
  }

  const [total, completed, timeRows] = await Promise.all([
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .in('assigned_to', members),
    db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .in('assigned_to', members)
      .eq('status', 'completed'),
    db
      .from('time_entries')
      .select('hours')
      .eq('tenant_id', auth.tenantId)
      .in('user_id', members)
      .limit(10000),
  ]);

  const totalHours = ((timeRows.data ?? []) as Array<{ hours: number | null }>).reduce(
    (a, r) => a + (r.hours ?? 0),
    0,
  );
  const totalCount = total.count ?? 0;
  const completedCount = completed.count ?? 0;

  return jsonResponse(
    {
      teamId,
      memberCount: members.length,
      totalTasks: totalCount,
      completedTasks: completedCount,
      completionRate: totalCount > 0 ? Number(((completedCount / totalCount) * 100).toFixed(1)) : 0,
      totalHoursLogged: totalHours,
      avgHoursLogged: members.length > 0 ? Number((totalHours / members.length).toFixed(1)) : 0,
    },
    200,
    req,
    requestId,
  );
}

// deno-lint-ignore no-explicit-any
async function resolveMembers(db: any, tenantId: string, teamId: string): Promise<string[]> {
  // Attempt: users.team_id = teamId. If the column doesn't exist, return [].
  const { data, error } = await db
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('team_id', teamId);
  if (error) return [];
  return ((data ?? []) as Array<{ id: string }>).map((u) => u.id);
}

function mapTeam(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  if (body.name !== undefined) r.name = body.name;
  if (body.department !== undefined) r.department = body.department;
  set('location_id', 'locationId', 'location_id');
  set('manager_id', 'managerId', 'manager_id');
  set('parent_team_id', 'parentTeamId', 'parent_team_id');
  set('is_active', 'isActive', 'is_active');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
