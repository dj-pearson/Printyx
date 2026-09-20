// CRM Edge Function
// Handles CRM goals, dashboard stats, teams, and progress tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { associationCreateError } from '../_shared/crm-associations.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';
import { toCamel } from '../_shared/case.ts';
import { calculateActivityFunnel } from '../_shared/activity-funnel.ts';

/** Rows out of PostgREST are snake_case; every page here reads camelCase. */
// deno-lint-ignore no-explicit-any
function toCamelRows(rows: any[] | null): any[] {
  return (rows ?? []).map((r) => toCamel(r));
}

/**
 * A sales_goals row from whatever the page sent.
 *
 * Only real columns: the table is
 * assigned_to_user_id / assigned_to_team_id / assigned_by / goal_type /
 * target_count / period / start_date / end_date / is_active / notes, and
 * PostgREST answers PGRST204 for anything else - which reaches the user as
 * "failed to create" with no reason.
 */
// deno-lint-ignore no-explicit-any
function goalRow(body: any, tenantId: string, actorId: string): Record<string, any> {
  const target = body.targetCount ?? body.target_count;
  return {
    tenant_id: tenantId,
    assigned_to_user_id: body.assignedToUserId ?? body.assigned_to_user_id ?? null,
    assigned_to_team_id: body.assignedToTeamId ?? body.assigned_to_team_id ?? null,
    assigned_by: actorId,
    goal_type: body.goalType ?? body.goal_type ?? null,
    target_count: target === undefined || target === null ? null : Number(target),
    period: body.period ?? 'monthly',
    start_date: body.startDate ?? body.start_date ?? null,
    end_date: body.endDate ?? body.end_date ?? null,
    is_active: body.isActive ?? true,
    notes: body.notes ?? null,
  };
}

/**
 * How far along one goal is, counted from the activity it is about.
 *
 * NULL WHEN NOTHING RECORDS THAT GOAL TYPE, which is the whole point of doing
 * this per type rather than returning a number for everything. A goal to book
 * meetings is countable; a goal expressed in a unit this system does not
 * capture is not, and answering 0 for it would read as "no progress" on a
 * dashboard where 0 is a judgement about a person.
 */
// deno-lint-ignore no-explicit-any
async function countGoalProgress(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  // deno-lint-ignore no-explicit-any
  goal: any,
): Promise<number | null> {
  const type = String(goal.goal_type ?? '').toLowerCase();
  const owner = goal.assigned_to_user_id as string | null;

  // Each entry is [table, the column holding the actor, an optional filter].
  const SOURCES: Record<string, [string, string, [string, string] | null]> = {
    calls: ['business_record_activities', 'created_by', ['activity_type', 'call']],
    emails: ['business_record_activities', 'created_by', ['activity_type', 'email']],
    meetings: ['business_record_activities', 'created_by', ['activity_type', 'meeting']],
    proposals: ['proposals', 'created_by', null],
    deals: ['deals', 'owner_id', null],
    revenue: ['deals', 'owner_id', ['status', 'won']],
  };

  const source = SOURCES[type];
  if (!source) return null;
  const [table, actorColumn, filter] = source;

  try {
    let query = admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if (owner) query = query.eq(actorColumn, owner);
    if (filter) query = query.eq(filter[0], filter[1]);
    if (goal.start_date) query = query.gte('created_at', goal.start_date);
    if (goal.end_date) query = query.lte('created_at', goal.end_date);

    const { count, error } = await query;
    return error ? null : (count ?? null);
  } catch {
    return null;
  }
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /crm, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'crm');
    const subRoute = parts[0]; // e.g., 'goals', 'dashboard-stats', 'teams', 'goal-progress'

    // ====================================================================
    // CRM GOALS (WF-S-06)
    //
    // WHAT WAS HERE. Four of these five branches were TODO stubs and the fifth
    // read the wrong table, so the whole CRM Goals page was inert in
    // production while dev - served by server/routes-crm-goals.ts - looked
    // fine. GET /goals answered `[]` unconditionally. POST /goals answered
    // `{ success: true, message: 'Goal created' }` at 201 and wrote NOTHING,
    // which is the AUDIT-038 shape on a live create button. dashboard-stats
    // returned eight hardcoded zeroes, which on a goals page reads as "nobody
    // has sold anything" rather than as a stub. goal-progress returned a single
    // mock OBJECT where the page does `rows.forEach`. And teams read `teams` -
    // a real table, but not the one this page is about, which is `sales_teams`;
    // two tables one word apart is why that one looked right.
    //
    // The story counted six missing branches. It is eleven: those five, plus
    // the six below that existed only on Express.
    // ====================================================================

    // GET /crm/goals - List sales goals
    if (req.method === 'GET' && subRoute === 'goals') {
      const { data, error } = await admin
        .from('sales_goals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales goals:', error);
        return createCorsResponse({ error: 'Failed to fetch goals' }, 500, req);
      }
      return createCorsResponse(toCamelRows(data), 200, req);
    }

    // POST /crm/goals - Create a sales goal
    if (req.method === 'POST' && subRoute === 'goals' && !parts[1]) {
      const body = await req.json().catch(() => ({}));
      const row = goalRow(body, tenantId, user.id);
      if (!row.goal_type || row.target_count === null) {
        return createCorsResponse({ error: 'goalType and targetCount are required' }, 400, req);
      }

      const { data, error } = await admin.from('sales_goals').insert(row).select().maybeSingle();
      if (error) {
        console.error('Error creating sales goal:', error);
        return createCorsResponse(
          { error: 'Failed to create goal', message: error.message },
          500,
          req,
        );
      }
      return createCorsResponse(toCamel(data), 201, req);
    }

    // POST /crm/goals/bulk-assign - one goal per assignee per target
    //
    // This existed on NEITHER host: the story calls it a production-only 404,
    // but Express has no handler for it either, so the Assign Goals dialog has
    // never worked anywhere. The page sends a template's `targets` map plus the
    // users and teams to assign it to; each entry becomes one sales_goals row,
    // because that table holds one goal_type per row.
    if (req.method === 'POST' && subRoute === 'goals' && parts[1] === 'bulk-assign') {
      const body = await req.json().catch(() => ({}));
      const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : [];
      const teamIds: string[] = Array.isArray(body.teamIds) ? body.teamIds : [];
      const targets = (body.targets ?? {}) as Record<string, unknown>;

      if (userIds.length === 0 && teamIds.length === 0) {
        return createCorsResponse({ error: 'Select at least one user or team' }, 400, req);
      }
      const targetEntries = Object.entries(targets).filter(([, v]) => Number(v) > 0);
      if (targetEntries.length === 0) {
        return createCorsResponse({ error: 'The template sets no targets' }, 400, req);
      }

      const rows: Record<string, unknown>[] = [];
      for (const [goalType, targetCount] of targetEntries) {
        for (const userId of userIds) {
          rows.push(
            goalRow(
              { ...body, goalType, targetCount, assignedToUserId: userId },
              tenantId,
              user.id,
            ),
          );
        }
        for (const teamId of teamIds) {
          rows.push(
            goalRow(
              { ...body, goalType, targetCount, assignedToTeamId: teamId },
              tenantId,
              user.id,
            ),
          );
        }
      }

      const { data, error } = await admin.from('sales_goals').insert(rows).select();
      if (error) {
        console.error('Error bulk-assigning goals:', error);
        return createCorsResponse(
          { error: 'Failed to assign goals', message: error.message },
          500,
          req,
        );
      }
      return createCorsResponse({ created: data?.length ?? 0, goals: toCamelRows(data) }, 201, req);
    }

    // GET /crm/dashboard-stats - counted, not typed in
    if (req.method === 'GET' && subRoute === 'dashboard-stats') {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const since = monthStart.toISOString();

      // PostgREST has no COUNT(*) over a filter set in one round trip, so each
      // figure is its own head request with { count: 'exact' }. Cheap: no rows
      // cross the wire.
      const countOf = async (
        table: string,
        apply: (q: any) => any = (q) => q,
      ): Promise<number | null> => {
        try {
          const { count, error } = await apply(
            admin
              .from(table)
              .select('id', { count: 'exact', head: true })
              .eq('tenant_id', tenantId),
          );
          // NULL IS NOT ZERO: a failed count must not render as "none".
          return error ? null : (count ?? null);
        } catch {
          return null;
        }
      };

      const [totalLeads, totalCustomers, activeDeals, leadsThisMonth, customersThisMonth] =
        await Promise.all([
          countOf('business_records', (q) => q.eq('record_type', 'lead')),
          countOf('business_records', (q) => q.eq('record_type', 'customer')),
          countOf('deals', (q) => q.eq('status', 'open')),
          countOf('business_records', (q) => q.eq('record_type', 'lead').gte('created_at', since)),
          countOf('business_records', (q) =>
            q.eq('record_type', 'customer').gte('created_at', since),
          ),
        ]);

      // Revenue is a SUM, which PostgREST also cannot do, so the won deals are
      // read and added here. Capped by fetchAllRows' paging upstream of a real
      // tenant size; a tenant past that gets a low number rather than a wrong
      // shape, which is named in `unbacked`.
      // actual_close_date, NOT closed_at. check:phantom-cols caught that in this
      // very branch before it shipped - `deals.closed_at` is a name eight other
      // edge functions have reached for and the table has never had, which is
      // why CLAUDE.md lists it by name.
      const { data: wonDeals, error: dealsError } = await admin
        .from('deals')
        .select('amount, actual_close_date')
        .eq('tenant_id', tenantId)
        .eq('status', 'won');

      const sum = (rows: { amount?: unknown }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

      const totalRevenue = dealsError ? null : sum(wonDeals);
      const revenueThisMonth = dealsError
        ? null
        : sum(
            (wonDeals ?? []).filter(
              (d: any) => d.actual_close_date && d.actual_close_date >= since,
            ),
          );

      const conversionRate =
        totalLeads && totalCustomers !== null && totalLeads > 0
          ? Math.round((totalCustomers / totalLeads) * 1000) / 10
          : null;

      return createCorsResponse(
        {
          totalLeads,
          totalCustomers,
          totalRevenue,
          activeDeals,
          revenueThisMonth,
          leadsThisMonth,
          customersThisMonth,
          conversionRate,
          unbacked: dealsError ? ['Revenue could not be read.'] : [],
        },
        200,
        req,
      );
    }

    // GET /crm/teams - sales_teams, which is what this page means by a team
    if (req.method === 'GET' && subRoute === 'teams' && !parts[1]) {
      const { data, error } = await admin
        .from('sales_teams')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching sales teams:', error);
        return createCorsResponse({ error: 'Failed to fetch teams' }, 500, req);
      }
      return createCorsResponse(toCamelRows(data), 200, req);
    }

    // POST /crm/teams - Create a sales team
    if (req.method === 'POST' && subRoute === 'teams' && !parts[1]) {
      const body = await req.json().catch(() => ({}));
      const name = body.name;
      if (!name) return createCorsResponse({ error: 'name is required' }, 400, req);

      const { data, error } = await admin
        .from('sales_teams')
        .insert({
          tenant_id: tenantId,
          name,
          description: body.description ?? null,
          parent_team_id: body.parentTeamId ?? null,
          team_level: body.teamLevel ?? null,
          manager_id: body.managerId ?? null,
          territory: body.territory ?? null,
          is_active: body.isActive ?? true,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error creating sales team:', error);
        return createCorsResponse(
          { error: 'Failed to create team', message: error.message },
          500,
          req,
        );
      }
      return createCorsResponse(toCamel(data), 201, req);
    }

    // GET /crm/teams/:teamId/members
    //
    // Two reads rather than a join: PostgREST embeds through a declared foreign
    // key, and sales_team_members.user_id has none to users in this schema, so
    // a `users(...)` select 400s. The member rows decide the order the ids are
    // fetched in and the names are attached afterwards.
    if (req.method === 'GET' && subRoute === 'teams' && parts[1] && parts[2] === 'members') {
      const { data: members, error } = await admin
        .from('sales_team_members')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('team_id', parts[1])
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching team members:', error);
        return createCorsResponse({ error: 'Failed to fetch team members' }, 500, req);
      }

      const ids = [...new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean))];
      const byId = new Map<string, any>();
      if (ids.length > 0) {
        const { data: people } = await admin
          .from('users')
          .select('id, first_name, last_name, email')
          .eq('tenant_id', tenantId)
          .in('id', ids);
        for (const person of people ?? []) byId.set(person.id, person);
      }

      const rows = (members ?? [])
        .map((m: any) => {
          const person = byId.get(m.user_id) ?? {};
          return {
            id: m.id,
            userId: m.user_id,
            role: m.role,
            joinedDate: m.joined_date,
            isActive: m.is_active,
            // The Express shape, kept exactly: the page reads these three.
            userName: person.first_name ?? null,
            userLastName: person.last_name ?? null,
            userEmail: person.email ?? null,
          };
        })
        .sort((a, b) => String(a.userName ?? '').localeCompare(String(b.userName ?? '')));

      return createCorsResponse(rows, 200, req);
    }

    // GET /crm/goal-progress - an ARRAY, because the page iterates it
    //
    // The stub returned one object, and the page does `rows.forEach` over it.
    // Progress is counted per goal from the activity the goal is about, so a
    // goal type nothing records is reported with a null current rather than a
    // zero that reads as "no progress".
    if (req.method === 'GET' && subRoute === 'goal-progress') {
      const goalId = url.searchParams.get('goalId');
      // QUERYKEY-002: SalesCommandCenter's Team/Me scope selector used to be a
      // path segment here, so it 404'd and picking "Me" changed nothing.
      // sales_goals.assigned_to_user_id is the column that answers it; a goal
      // assigned to a TEAM has no user id and is correctly excluded from "Me".
      const owner = url.searchParams.get('owner');
      let query = admin
        .from('sales_goals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (goalId) query = query.eq('id', goalId);
      if (owner === 'me') query = query.eq('assigned_to_user_id', user.id);

      const { data: goals, error } = await query;
      if (error) {
        console.error('Error fetching goals for progress:', error);
        return createCorsResponse({ error: 'Failed to fetch goal progress' }, 500, req);
      }

      const rows = [];
      for (const goal of goals ?? []) {
        const current = await countGoalProgress(admin, tenantId, goal);
        const target = Number(goal.target_count) || 0;
        rows.push({
          goalId: goal.id,
          goalType: goal.goal_type,
          assignedToUserId: goal.assigned_to_user_id,
          assignedToTeamId: goal.assigned_to_team_id,
          period: goal.period,
          startDate: goal.start_date,
          endDate: goal.end_date,
          targetCount: target,
          currentCount: current,
          percentage: current === null || target <= 0 ? null : Math.round((current / target) * 100),
        });
      }
      return createCorsResponse(rows, 200, req);
    }

    // GET /crm/manager-insights
    if (req.method === 'GET' && subRoute === 'manager-insights') {
      let query = admin
        .from('manager_insights')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      for (const [param, column] of [
        ['managerId', 'manager_id'],
        ['teamId', 'team_id'],
        ['userId', 'user_id'],
        ['category', 'insight_category'],
        ['priority', 'priority_level'],
      ] as const) {
        const value = url.searchParams.get(param);
        if (value) query = query.eq(column, value);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching manager insights:', error);
        return createCorsResponse({ error: 'Failed to fetch manager insights' }, 500, req);
      }
      return createCorsResponse(toCamelRows(data), 200, req);
    }

    if (subRoute === 'analytics') {
      // GET /crm/analytics/conversion-analysis
      if (req.method === 'GET' && parts[1] === 'conversion-analysis') {
        const period = url.searchParams.get('period') ?? 'monthly';
        let query = admin
          .from('sales_metrics')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('metric_period', period);

        /**
         * SEC-EDGE-001: `sales_metrics` is per-rep performance - conversion
         * rates, activity counts, quota movement - and the only thing deciding
         * whose rows came back was a `?userId=` the caller supplies, on a
         * tenant filter. Any member could read any colleague's numbers.
         *
         * The WF-R-04 scope now narrows the rows first; the parameters are
         * what they always read as, a caller-supplied preference applied ON
         * TOP, so they can filter within the tier and never widen past it.
         * Same shape as the deals board and the commission calculations.
         */
        const scope = await resolveScope(admin, {
          userId: user.id,
          tenantId,
          appMetadata: user.app_metadata,
          requestedScope: url.searchParams.get('scope'),
        });
        query = applyUserScope(query, 'user_id', scope);

        const userId = url.searchParams.get('userId');
        const teamId = url.searchParams.get('teamId');
        if (userId) query = query.eq('user_id', userId);
        if (teamId) query = query.eq('team_id', teamId);

        const { data, error } = await query.order('period_start_date', { ascending: false });
        if (error) {
          console.error('Error fetching conversion analysis:', error);
          return createCorsResponse({ error: 'Failed to fetch conversion analysis' }, 500, req);
        }

        const rows = toCamelRows(data);
        const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
        const teamIds = [...new Set((data ?? []).map((r: any) => r.team_id).filter(Boolean))];
        const people = new Map<string, any>();
        const teamNames = new Map<string, string>();
        if (userIds.length) {
          const { data: us } = await admin
            .from('users')
            .select('id, first_name, last_name')
            .eq('tenant_id', tenantId)
            .in('id', userIds);
          for (const u of us ?? []) people.set(u.id, u);
        }
        if (teamIds.length) {
          const { data: ts } = await admin
            .from('sales_teams')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .in('id', teamIds);
          for (const t of ts ?? []) teamNames.set(t.id, t.name);
        }

        return createCorsResponse(
          rows.map((r: any, i: number) => ({
            ...r,
            firstName: people.get((data ?? [])[i]?.user_id)?.first_name ?? null,
            lastName: people.get((data ?? [])[i]?.user_id)?.last_name ?? null,
            teamName: teamNames.get((data ?? [])[i]?.team_id) ?? null,
          })),
          200,
          req,
        );
      }

      // POST /crm/analytics/calculate-activities - pure arithmetic, no tenant
      if (req.method === 'POST' && parts[1] === 'calculate-activities') {
        const body = await req.json().catch(() => ({}));
        return createCorsResponse(calculateActivityFunnel(body), 200, req);
      }
    }

    // ─── CRMX-006: Notes ────────────────────────────────────────────
    const CRM_RECORD_TYPES = new Set(['deal', 'lead', 'contact', 'company']);
    if (subRoute === 'notes') {
      const noteId = parts[1];

      if (req.method === 'GET' && !noteId) {
        const parentType = url.searchParams.get('parentType');
        const parentId = url.searchParams.get('parentId');
        if (!parentType || !parentId)
          return createCorsResponse({ error: 'parentType and parentId are required' }, 400, req);
        const { data, error } = await admin
          .from('crm_notes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('parent_type', parentType)
          .eq('parent_id', parentId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        return createCorsResponse({ data: data ?? [], total: (data ?? []).length }, 200, req);
      }

      if (req.method === 'POST' && !noteId) {
        const body = await req.json().catch(() => ({}));
        if (!CRM_RECORD_TYPES.has(body.parentType) || !body.parentId || !body.body)
          return createCorsResponse(
            { error: 'parentType, parentId and body are required' },
            400,
            req,
          );
        const { data, error } = await admin
          .from('crm_notes')
          .insert({
            tenant_id: tenantId,
            parent_type: body.parentType,
            parent_id: body.parentId,
            body: body.body,
            is_pinned: body.isPinned ?? false,
            author_id: user.id,
          })
          .select()
          .single();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        return createCorsResponse(data, 201, req);
      }

      if (req.method === 'PATCH' && noteId) {
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.body !== undefined) patch.body = body.body;
        if (body.isPinned !== undefined) patch.is_pinned = body.isPinned;
        const { data, error } = await admin
          .from('crm_notes')
          .update(patch)
          .eq('id', noteId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Note not found' }, 404, req);
        return createCorsResponse(data, 200, req);
      }

      if (req.method === 'DELETE' && noteId) {
        const { data, error } = await admin
          .from('crm_notes')
          .delete()
          .eq('id', noteId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Note not found' }, 404, req);
        return createCorsResponse({ success: true }, 200, req);
      }
    }

    // ─── CRMX-006: Associations ─────────────────────────────────────
    if (subRoute === 'associations') {
      const assocId = parts[1];

      if (req.method === 'GET' && !assocId) {
        const type = url.searchParams.get('type');
        const id = url.searchParams.get('id');
        if (!type || !id)
          return createCorsResponse({ error: 'type and id are required' }, 400, req);
        const { data, error } = await admin
          .from('crm_associations')
          .select('*')
          .eq('tenant_id', tenantId)
          .or(
            `and(source_type.eq.${type},source_id.eq.${id}),and(target_type.eq.${type},target_id.eq.${id})`,
          )
          .order('created_at', { ascending: false });
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        return createCorsResponse({ data: data ?? [], total: (data ?? []).length }, 200, req);
      }

      if (req.method === 'POST' && !assocId) {
        const body = await req.json().catch(() => ({}));
        // COP-M05: this used to check only that the four fields were present, so
        // any string was accepted as a record type. Express validated against
        // CRM_ASSOCIABLE_TYPES via Zod, but production runs THIS handler, so the
        // validation lived on the host that does not serve users.
        const invalid = associationCreateError(body);
        if (invalid) return createCorsResponse({ error: invalid }, 400, req);
        const { data, error } = await admin
          .from('crm_associations')
          .insert({
            tenant_id: tenantId,
            source_type: body.sourceType,
            source_id: body.sourceId,
            target_type: body.targetType,
            target_id: body.targetId,
            relation: body.relation ?? 'related',
            created_by: user.id,
          })
          .select()
          .single();
        if (error) {
          if ((error as { code?: string }).code === '23505')
            return createCorsResponse({ error: 'This association already exists' }, 409, req);
          return createCorsResponse({ error: error.message }, 500, req);
        }
        return createCorsResponse(data, 201, req);
      }

      if (req.method === 'DELETE' && assocId) {
        const { data, error } = await admin
          .from('crm_associations')
          .delete()
          .eq('id', assocId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Association not found' }, 404, req);
        return createCorsResponse({ success: true }, 200, req);
      }
    }

    return createCorsResponse({ error: 'Route not found' }, 404, req);
  } catch (error) {
    console.error('Error in crm function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
