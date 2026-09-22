// Team Reports Edge Function
// Handles team performance reporting and analytics
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toNumber } from '../_shared/quote-math.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import { resolveScope } from '../_shared/scope.ts';
import {
  findNoTouchAlerts,
  memberName,
  rankTeamLeaderboard,
  rollUpActivity,
  summariseTeamPipeline,
  teamActivityByRep,
  type DealSummaryRow,
  type TeamMember,
} from '../../../shared/team-rollup.ts';

// PROD-008: the ONLY caller of /api/team-reports is the iOS manager reports
// screen - nothing in client/src requests this prefix - and all four of its
// cards were blank, in two different ways. `activities` and `no-touch` 404'd
// (the branch below is spelled `activity`, singular, and no-touch was never
// written), while `pipeline` and `leaderboard` answered 200 under key names
// ManagerReportsModels.swift does not read, so every field decoded to nil. The
// second half is the harder one to notice: the request succeeds and nothing
// logs. Those four branches now read `deals` and `business_record_activities`
// and answer the shapes the app decodes.
//
// STILL ON THE PHANTOM TABLES, and left that way deliberately: `summary`,
// `performance` and `comparison` read `activities` and `team_members`, neither
// of which exists in any schema, and NO client of any kind calls them. Fixing a
// report nobody requests is a different story from serving the one somebody
// does; both tables are already in docs/phantom-tables-baseline.json against
// this file.
//
// COP-M01: this file addressed business_records as deal_value / assigned_to /
// pipeline_stage. The columns are estimated_deal_value, assigned_sales_rep and
// sales_stage, so every query here answered 42703, `deals` came back undefined,
// and each report returned zeroes through `|| 0` rather than an error. Note
// estimated_deal_value is numeric, which PostgREST returns as a STRING — the
// sums coerce through toNumber, or they would concatenate.

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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // SEC-EDGE-001. Reports about OTHER people's work - team performance and per-rep analytics. Row scoping cannot substitute for a role check when the whole point of the endpoint is to see across a team. MANAGER is the level the team surfaces use elsewhere.
    try {
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        ROLE_LEVEL.MANAGER,
      );
    } catch (err) {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Requires role level 4 or higher',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /team-reports, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'team-reports');
    const reportType = parts[0];
    const teamId = url.searchParams.get('teamId');

    // Helper to get date range
    const period = url.searchParams.get('period') || 'month';
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    /**
     * Whose rows this manager may see.
     *
     * The ROLE gate above is the access decision - level 4 or higher, because
     * every report here is about other people's work. resolveScope is the
     * narrowing on top of it, so a manager whose org structure records no
     * reports sees themselves rather than a 403: the crm/team-rollup handler
     * answers 403 for scope 'own' because there the scope IS the check, and
     * here it is not.
     */
    const scope = await resolveScope(admin, {
      userId: user.id,
      tenantId,
      appMetadata: user.app_metadata,
      requestedScope: url.searchParams.get('scope'),
    });
    // A manager is part of their own team's numbers.
    const memberIds =
      scope.userIds === null ? null : Array.from(new Set([...scope.userIds, user.id]));

    const loadMembers = async (): Promise<TeamMember[]> => {
      let q = admin
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenantId);
      if (memberIds) q = q.in('id', memberIds);
      const { data, error } = await q;
      if (error) throw error;
      // deno-lint-ignore no-explicit-any
      return (data ?? []).map((u: any) => ({ userId: String(u.id), name: memberName(u) }));
    };

    /** Deal rows in the shape shared/team-rollup reads. */
    // deno-lint-ignore no-explicit-any
    const toDealRow = (d: any): DealSummaryRow => ({
      id: d.id,
      title: d.title,
      ownerId: d.owner_id,
      amount: d.amount,
      probability: d.probability,
      status: d.status,
      actualCloseDate: d.actual_close_date,
      companyName: d.company_name,
      createdAt: d.created_at,
    });

    // GET /team-reports/summary - Team summary report
    if (req.method === 'GET' && reportType === 'summary') {
      // Get team members
      const { data: members } = await admin
        .from('team_members')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .eq('team_id', teamId || '');

      const memberIds = (members || []).map((m: any) => m.user_id);

      // Get activities by team members
      const { count: totalActivities } = await admin
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('user_id', memberIds)
        .gte('created_at', startDate.toISOString());

      // Get deals by team
      const deals = await fetchAllRows<any>(() =>
        admin
          .from('business_records')
          .select('estimated_deal_value, status')
          .eq('tenant_id', tenantId)
          .in('assigned_sales_rep', memberIds)
          .gte('created_at', startDate.toISOString()),
      );

      const totalDealValue = (deals || []).reduce(
        (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
        0,
      );
      const wonDeals = (deals || []).filter((d: any) => d.status === 'won');
      const wonValue = wonDeals.reduce(
        (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
        0,
      );

      return createCorsResponse(
        {
          period,
          teamMembers: members?.length || 0,
          totalActivities: totalActivities || 0,
          totalDeals: deals?.length || 0,
          totalDealValue,
          wonDeals: wonDeals.length,
          wonValue,
          winRate: deals?.length ? Math.round((wonDeals.length / deals.length) * 100) : 0,
        },
        200,
        req,
      );
    }

    // GET /team-reports/leaderboard - Team leaderboard
    // GET /team-reports/leaderboard - closed-won by rep, ranked
    //
    // Was `business_records` filtered on `status = 'won'` and returned
    // {userId, name, count, value}; the app reads closedWonAmount,
    // closedWonCount and rank, so two of its five fields decoded and the
    // numbers it exists to show did not. `deals.status` is the discriminator
    // because the canonical stage-move path (pipeline-config) writes status,
    // probability and actual_close_date together when a card enters a
    // closed-won stage.
    if (req.method === 'GET' && reportType === 'leaderboard') {
      const members = await loadMembers();
      const wonDeals = await fetchAllRows<any>(() => {
        let q = admin
          .from('deals')
          .select('id, owner_id, amount, status, actual_close_date')
          .eq('tenant_id', tenantId)
          .eq('status', 'won')
          .gte('actual_close_date', startDate.toISOString());
        if (memberIds) q = q.in('owner_id', memberIds);
        return q;
      });

      return createCorsResponse(rankTeamLeaderboard(wonDeals.map(toDealRow), members), 200, req);
    }

    // GET /team-reports/activities (and /activity) - per-rep interaction counts
    //
    // TWO DEFECTS IN ONE BRANCH. It read `.from('activities')`, a table in no
    // schema and no migration, and DISCARDED the error - so the report always
    // said the team had logged nothing, which is indistinguishable from a quiet
    // week. And it answered only the SINGULAR spelling while the app asks for
    // `activities`, so the app never reached even that. The real table is
    // `business_record_activities`, which is what both the web record timeline
    // and the iOS quick-log write to.
    if (req.method === 'GET' && (reportType === 'activities' || reportType === 'activity')) {
      const members = await loadMembers();
      // `days` is what the app sends; `period` is what the older web-facing
      // branches take. Either narrows the same window.
      const daysParam = Number(url.searchParams.get('days'));
      const since =
        Number.isFinite(daysParam) && daysParam > 0
          ? new Date(Date.now() - Math.min(daysParam, 365) * 86_400_000)
          : startDate;

      const activities = await fetchAllRows<any>(() => {
        let q = admin
          .from('business_record_activities')
          .select('created_by, activity_type, created_at')
          .eq('tenant_id', tenantId)
          // `created_at` is an INSTANT, so it is compared to one - no day
          // snapping (DATE-LOCAL-002 draws that line).
          .gte('created_at', since.toISOString());
        if (memberIds) q = q.in('created_by', memberIds);
        return q;
      });

      const rollup = rollUpActivity(
        activities.map((a: any) => ({ createdBy: a.created_by, activityType: a.activity_type })),
        members,
      );

      return createCorsResponse(teamActivityByRep(rollup), 200, req);
    }

    // GET /team-reports/pipeline - the manager pipeline card
    //
    // Was `business_records` filtered on `record_type = 'opportunity'` and
    // answered {totalDeals, totalValue, byStage}; the app reads pipelineValue,
    // weightedValue, openOpportunityCount, closedWonThisMonth and
    // closedWonCount, so every field decoded to nil and the card was blank on a
    // 200. The canonical pipeline table is `deals` (docs/crm-canonical-model.md).
    if (req.method === 'GET' && reportType === 'pipeline') {
      const deals = await fetchAllRows<any>(() => {
        let q = admin
          .from('deals')
          .select('id, owner_id, amount, probability, status, actual_close_date')
          .eq('tenant_id', tenantId);
        if (memberIds) q = q.in('owner_id', memberIds);
        return q;
      });

      return createCorsResponse(summariseTeamPipeline(deals.map(toDealRow), new Date()), 200, req);
    }

    // GET /team-reports/no-touch - open opportunities nobody has worked
    //
    // New. `deals.last_activity_date` looks like the column for this and is
    // written by NOTHING - read in four places, set in none - so an alert built
    // on it would flag every open deal in the tenant forever. The touch date
    // comes from the activity rows: `deal_activities` for the card itself, and
    // `business_record_activities` for the ACCOUNT behind it, because a rep who
    // logs a call against the customer has touched the opportunity whether or
    // not they logged it twice. The later of the two wins; a deal with neither
    // is measured from the day it was raised, and the row says which.
    if (req.method === 'GET' && reportType === 'no-touch') {
      const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 3, 1), 365);
      const members = await loadMembers();

      const openDeals = await fetchAllRows<any>(() => {
        let q = admin
          .from('deals')
          .select(
            'id, title, owner_id, amount, status, company_name, created_at, source_business_record_id',
          )
          .eq('tenant_id', tenantId)
          .eq('status', 'open');
        if (memberIds) q = q.in('owner_id', memberIds);
        return q;
      });

      const lastTouch = new Map<string, string>();
      const record = (dealId: string, at: string | null | undefined) => {
        if (!at) return;
        const seen = lastTouch.get(dealId);
        if (!seen || at > seen) lastTouch.set(dealId, at);
      };

      const dealIds = openDeals.map((d: any) => d.id).filter(Boolean);
      // PostgREST rejects an .in() with no values, so an empty pipeline
      // short-circuits rather than issuing a query that answers 400.
      if (dealIds.length > 0) {
        const dealActivity = await fetchAllRows<any>(() =>
          admin
            .from('deal_activities')
            .select('deal_id, created_at')
            .eq('tenant_id', tenantId)
            .in('deal_id', dealIds),
        );
        for (const a of dealActivity) record(a.deal_id, a.created_at);
      }

      const recordIds = [
        ...new Set(openDeals.map((d: any) => d.source_business_record_id).filter(Boolean)),
      ] as string[];
      if (recordIds.length > 0) {
        const accountActivity = await fetchAllRows<any>(() =>
          admin
            .from('business_record_activities')
            .select('business_record_id, created_at')
            .eq('tenant_id', tenantId)
            .in('business_record_id', recordIds),
        );
        const byRecord = new Map<string, string>();
        for (const a of accountActivity) {
          const seen = byRecord.get(a.business_record_id);
          if (!seen || a.created_at > seen) byRecord.set(a.business_record_id, a.created_at);
        }
        for (const d of openDeals) {
          if (d.source_business_record_id) {
            record(d.id, byRecord.get(d.source_business_record_id));
          }
        }
      }

      return createCorsResponse(
        findNoTouchAlerts(openDeals.map(toDealRow), lastTouch, members, days, new Date()),
        200,
        req,
      );
    }

    // GET /team-reports/performance - Individual performance metrics
    if (req.method === 'GET' && reportType === 'performance') {
      const userId = url.searchParams.get('userId');

      if (!userId) {
        return createCorsResponse({ error: 'userId required' }, 400, req);
      }

      // Get user's activities
      const { count: activityCount } = await admin
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      // Get user's deals
      const deals = await fetchAllRows<any>(() =>
        admin
          .from('business_records')
          .select('estimated_deal_value, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('assigned_sales_rep', userId)
          .gte('created_at', startDate.toISOString()),
      );

      const wonDeals = (deals || []).filter((d: any) => d.status === 'won');
      const lostDeals = (deals || []).filter((d: any) => d.status === 'lost');

      return createCorsResponse(
        {
          userId,
          period,
          activities: activityCount || 0,
          totalDeals: deals?.length || 0,
          wonDeals: wonDeals.length,
          lostDeals: lostDeals.length,
          pendingDeals: (deals?.length || 0) - wonDeals.length - lostDeals.length,
          totalValue: (deals || []).reduce(
            (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
            0,
          ),
          wonValue: wonDeals.reduce(
            (sum: number, d: any) => sum + toNumber(d.estimated_deal_value),
            0,
          ),
          winRate: deals?.length ? Math.round((wonDeals.length / deals.length) * 100) : 0,
        },
        200,
        req,
      );
    }

    // GET /team-reports/comparison - Team comparison
    if (req.method === 'GET' && reportType === 'comparison') {
      const { data: teams } = await admin
        .from('teams')
        .select('id, name')
        .eq('tenant_id', tenantId);

      const teamStats = await Promise.all(
        (teams || []).map(async (team: any) => {
          const { data: members } = await admin
            .from('team_members')
            .select('user_id')
            .eq('team_id', team.id);

          const memberIds = (members || []).map((m: any) => m.user_id);

          const deals = await fetchAllRows<any>(() =>
            admin
              .from('business_records')
              .select('estimated_deal_value, status')
              .eq('tenant_id', tenantId)
              .in('assigned_sales_rep', memberIds)
              .gte('created_at', startDate.toISOString()),
          );

          const wonValue = (deals || [])
            .filter((d: any) => d.status === 'won')
            .reduce((sum: number, d: any) => sum + toNumber(d.estimated_deal_value), 0);

          return {
            teamId: team.id,
            teamName: team.name,
            memberCount: members?.length || 0,
            totalDeals: deals?.length || 0,
            wonValue,
          };
        }),
      );

      return createCorsResponse(teamStats, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in team-reports function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
