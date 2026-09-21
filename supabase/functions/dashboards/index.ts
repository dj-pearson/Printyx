// Dashboards Edge Function
// Provides dashboard data and configurations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toNumber } from '../_shared/quote-math.ts';
import {
  conversionRate,
  toActivityView,
  toLeadView,
  toStaleDealView,
  toWonDealView,
  todayWindows,
  type BusinessRecordRow,
} from '../_shared/today-dashboard-view.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { startOfUtcDay, startOfNextUtcDay } from '../_shared/date-months.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';
import {
  meetingsNeedingFollowUp,
  type FollowUpActivityRow,
} from '../../../shared/meetings-followup.ts';

/**
 * Total of a set of deal amounts.
 *
 * deals.amount is numeric(12,2), and PostgREST returns numeric as a STRING —
 * `0 + row.amount` would concatenate rather than add, so every caller has to
 * coerce. Doing it here means no caller can forget.
 */
function sumAmounts(rows: Array<{ amount?: unknown }> | null | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + toNumber(row?.amount), 0);
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'dashboards');
    const dashboardType = parts[0];
    const subEndpoint = parts[1];

    // GET /dashboards/sales - Sales dashboard data
    if (req.method === 'GET' && dashboardType === 'sales') {
      // COP-M01: this selected deal_value and stage. Neither is a column on
      // `deals` (they are amount and stage_id), so PostgREST answered 42703, the
      // destructured data came back undefined, and every figure below fell
      // through `|| 0` — the dashboard showed a pipeline of zeroes rather than an
      // error. `stage` was selected and never read, so it is simply gone.
      const { data: deals, error: dealsError } = await admin
        .from('deals')
        .select('id, amount, status, created_at')
        .eq('tenant_id', tenantId);

      if (dealsError) {
        console.error('Error loading deals for sales dashboard:', dealsError);
        return createCorsResponse(
          { error: 'Failed to load sales dashboard', details: dealsError.message },
          500,
          req,
        );
      }

      const allDeals = deals || [];
      const openDeals = allDeals.filter((d: any) => d.status === 'open');
      const wonDeals = allDeals.filter((d: any) => d.status === 'won');

      return createCorsResponse(
        {
          totalPipeline: sumAmounts(openDeals),
          totalWon: sumAmounts(wonDeals),
          dealCount: allDeals.length,
          openCount: openDeals.length,
          wonCount: wonDeals.length,
          winRate: allDeals.length > 0 ? (wonDeals.length / allDeals.length) * 100 : 0,
        },
        200,
        req,
      );
    }

    // GET /dashboards/service - Service dashboard data
    if (req.method === 'GET' && dashboardType === 'service') {
      const { data: tickets } = await admin
        .from('service_tickets')
        .select('id, status, priority, created_at, resolved_at')
        .eq('tenant_id', tenantId);

      const allTickets = tickets || [];
      const openTickets = allTickets.filter((t: any) =>
        ['new', 'open', 'assigned', 'in_progress'].includes(t.status),
      );
      const resolvedTickets = allTickets.filter((t: any) =>
        ['completed', 'resolved', 'closed'].includes(t.status),
      );

      return createCorsResponse(
        {
          totalTickets: allTickets.length,
          openTickets: openTickets.length,
          resolvedTickets: resolvedTickets.length,
          urgentTickets: allTickets.filter(
            (t: any) => t.priority === 'urgent' || t.priority === 'emergency',
          ).length,
        },
        200,
        req,
      );
    }

    // GET /dashboards/executive - Executive dashboard data
    if (req.method === 'GET' && dashboardType === 'executive') {
      // Fetch multiple metrics in parallel
      const [
        { count: totalCustomers },
        { count: totalDeals },
        { data: revenue },
        { count: activeTickets },
        { count: totalTicketCount },
        { count: resolvedTicketCount },
        { data: satisfactionRows },
      ] = await Promise.all([
        admin
          .from('business_records')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'customer'),
        admin.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        admin.from('deals').select('amount').eq('tenant_id', tenantId).eq('status', 'won'),
        admin
          .from('service_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['new', 'open', 'assigned']),
        admin
          .from('service_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        admin
          .from('service_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['resolved', 'closed', 'completed']),
        admin
          .from('service_calls')
          .select('customer_satisfaction_rating')
          .eq('tenant_id', tenantId)
          .not('customer_satisfaction_rating', 'is', null),
      ]);

      const totalRevenue = sumAmounts(revenue);

      // These three shipped as `revenueGrowth: 12.5`, `customerSatisfaction: 92`
      // and `ticketResolutionRate: 85`, each marked "// Placeholder" in a comment
      // nobody reading the response could see. Next to four counts that ARE real,
      // an invented KPI inherits their credibility, which is what makes this shape
      // worse than a page of obvious mock data.
      //
      // Two of the three are derivable right here, and the resolution rate was
      // derivable from counts this same handler already had two blocks above.
      // CSAT comes off service_calls.customer_satisfaction_rating, the column
      // reports/_queries/executive.ts already averages - and note the UNIT: it is a
      // 1-5 rating, so 92 was not merely invented, it was in the wrong scale and
      // would have read as a percentage.
      //
      // revenueGrowth needs a prior period and nothing here defines one. Null,
      // named in `unbacked`, rather than a number.
      const resolutionDenominator = totalTicketCount ?? 0;
      const ticketResolutionRate =
        resolutionDenominator > 0
          ? Math.round(((resolvedTicketCount ?? 0) / resolutionDenominator) * 1000) / 10
          : null;

      const ratings = ((satisfactionRows ?? []) as Array<{ customer_satisfaction_rating: number }>)
        .map((r) => r.customer_satisfaction_rating)
        .filter((n) => typeof n === 'number');
      const customerSatisfaction =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
          : null;

      return createCorsResponse(
        {
          totalCustomers: totalCustomers || 0,
          totalDeals: totalDeals || 0,
          totalRevenue,
          activeTickets: activeTickets || 0,
          kpis: {
            revenueGrowth: null,
            /** Mean of service_calls.customer_satisfaction_rating, on its native 1-5 scale. */
            customerSatisfaction,
            customerSatisfactionScale: '1-5',
            customerSatisfactionSampleSize: ratings.length,
            /** Percentage of this tenant's service tickets in a resolved state. */
            ticketResolutionRate,
          },
          unbacked: [
            'kpis.revenueGrowth: no prior-period comparison is computed anywhere.',
            ...(customerSatisfaction === null
              ? ['kpis.customerSatisfaction: no service call carries a satisfaction rating yet.']
              : []),
            ...(ticketResolutionRate === null
              ? ['kpis.ticketResolutionRate: this tenant has no service tickets.']
              : []),
          ],
        },
        200,
        req,
      );
    }

    // GET /dashboards/today - the "My Day" page (client/src/pages/TodayDashboard.tsx).
    //
    // PROD-008: this used to return {activitiesCount, newTickets, newDeals,
    // newDealValue}. The page reads {overdue, today, upcoming, hotLeads,
    // pipelineAlerts, recentWins, stats} and destructures with `= []` defaults,
    // so production rendered an empty dashboard with zero stats and no error,
    // while dev ran an entirely different Express handler on an unproxied
    // prefix. Ported to the contract the page actually reads.
    //
    // Every read below is bounded by a limit or answered by a server-side count,
    // so nothing here can be silently truncated by db-max-rows. The two stats
    // that would need a SUM are returned as null - see TodayStats.
    //
    // COP-B01 AC6: EVERY READ IN THIS BRANCH WAS FILTERED ON tenant_id ALONE, on
    // a page headed "Good morning, {firstName}! Here's your day at a glance."
    // So a rep's own day listed every other rep's overdue tasks, today's
    // schedule and upcoming meetings - a real list of the wrong set, which is
    // harder to spot than an invented one because every row on it is true of
    // somebody. The team roll-up cards were built with resolveScope from the
    // start, so the AC read as satisfied from the half that had it.
    //
    // `business_record_activities` has ONE ownership column - `created_by`, NOT
    // NULL - and no assigned_to, so that is what the scope applies to; scoping a
    // table on a column it lacks filters nothing and reads as protected. The
    // deal cards keep the tenant view deliberately: `deals` here is read for
    // stalled and recently-won work that a rep is expected to see across the
    // board, and narrowing it is COP-I06's separate question.
    if (req.method === 'GET' && dashboardType === 'today') {
      const now = new Date();
      const w = todayWindows(now);
      const STALE_AFTER_DAYS = 7;
      const staleCutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();

      const activityCols =
        'id, subject, activity_type, scheduled_date, due_date, completed_date, description, business_record_id';

      // Resolved once and applied to every activity read, so a card cannot be
      // added later on the tenant-wide default by accident.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata ?? null,
        requestedScope: url.searchParams.get('scope'),
      });

      const [
        { data: overdueRows },
        { data: todayRows },
        { data: upcomingRows },
        { data: leadRows },
        { data: staleRows },
        { data: wonRows },
      ] = await Promise.all([
        applyUserScope(
          admin
            .from('business_record_activities')
            .select(activityCols)
            .eq('tenant_id', tenantId)
            .is('completed_date', null)
            .or(
              `due_date.lte.${w.startOfDay.toISOString()},scheduled_date.lte.${w.yesterday.toISOString()}`,
            )
            .order('due_date', { ascending: true })
            .limit(10),
          'created_by',
          scope,
        ),
        applyUserScope(
          admin
            .from('business_record_activities')
            .select(activityCols)
            .eq('tenant_id', tenantId)
            .is('completed_date', null)
            .gte('scheduled_date', w.startOfDay.toISOString())
            .lte('scheduled_date', w.endOfDay.toISOString())
            .order('scheduled_date', { ascending: true })
            .limit(20),
          'created_by',
          scope,
        ),
        applyUserScope(
          admin
            .from('business_record_activities')
            .select(activityCols)
            .eq('tenant_id', tenantId)
            .is('completed_date', null)
            .gte('scheduled_date', w.upcomingFrom.toISOString())
            .lte('scheduled_date', w.upcomingTo.toISOString())
            .order('scheduled_date', { ascending: true })
            .limit(10),
          'created_by',
          scope,
        ),
        admin
          .from('lead_score_calculations')
          .select('id, lead_id, total_score, lead_grade, lead_tier')
          .eq('tenant_id', tenantId)
          .gte('total_score', 70)
          .order('total_score', { ascending: false })
          .limit(10),
        // COALESCE(updated_at, created_at) < cutoff, expressed as PostgREST can:
        // updated_at is nullable, so the null case falls back to created_at.
        admin
          .from('deals')
          .select('id, title, company_name, amount, probability, stage_id, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .or(`updated_at.lt.${staleCutoff},and(updated_at.is.null,created_at.lt.${staleCutoff})`)
          .order('updated_at', { ascending: true, nullsFirst: true })
          .limit(5),
        admin
          .from('deals')
          .select('id, title, company_name, amount, probability, stage_id, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'won')
          .gte('actual_close_date', w.weekStart.toISOString())
          .lte('actual_close_date', w.weekEnd.toISOString())
          .order('actual_close_date', { ascending: false })
          .limit(5),
      ]);

      const activities = [...(overdueRows ?? []), ...(todayRows ?? []), ...(upcomingRows ?? [])];

      // COP-B01 AC1's "Meetings needing follow-up" card. The slot with that id
      // rendered `upcoming` under the heading "Coming Up" - a different and
      // still useful card, which keeps its own catalogue entry - so the one the
      // AC names had never been built.
      //
      // Two reads and a pure derivation, because PostgREST has no anti-join:
      // the past meetings in the window, then every activity on those accounts
      // so shared/meetings-followup.ts can ask which of them had nothing after.
      // Scoped like every other activity read here; failing INDEPENDENTLY of
      // them, because one card that cannot load must not blank the page.
      let meetingsFollowUp: ReturnType<typeof meetingsNeedingFollowUp> | null = null;
      try {
        const { data: metRows, error: metError } = await applyUserScope(
          admin
            .from('business_record_activities')
            .select(activityCols)
            .eq('tenant_id', tenantId)
            .eq('activity_type', 'meeting')
            // DATE-LOCAL-002: both bounds snapped to a day boundary. The upper
            // one is deliberately COARSER than "before now" - the exact "has it
            // happened" cut lives in shared/meetings-followup.ts, which compares
            // the real timestamp, so widening the SQL to the end of today makes
            // the two agree by construction rather than by coincidence. A bound
            // carrying a time of day against a column that may hold midnight is
            // off by a day in whichever direction the operator points.
            .gte('scheduled_date', startOfUtcDay(w.followUpFrom).toISOString())
            .lt('scheduled_date', startOfNextUtcDay(now).toISOString())
            .order('scheduled_date', { ascending: true })
            .limit(25),
          'created_by',
          scope,
        );
        if (metError) throw metError;

        const meetingRows = (metRows ?? []) as FollowUpActivityRow[];
        const meetingRecordIds = [
          ...new Set(
            meetingRows
              .map((m) => m.business_record_id)
              .filter((id): id is string => typeof id === 'string' && id.length > 0),
          ),
        ];

        // A follow-up is anything on the account, whoever logged it - a
        // colleague covering the territory closes the loop just as well - so
        // this read is deliberately NOT user-scoped. PostgREST rejects an
        // .in() with no values, so an empty set short-circuits.
        const sinceRows = meetingRecordIds.length
          ? ((
              await admin
                .from('business_record_activities')
                .select('id, scheduled_date, completed_date, business_record_id')
                .eq('tenant_id', tenantId)
                .in('business_record_id', meetingRecordIds)
                .gte('scheduled_date', startOfUtcDay(w.followUpFrom).toISOString())
                .limit(500)
            ).data ?? [])
          : [];

        meetingsFollowUp = meetingsNeedingFollowUp(
          meetingRows,
          sinceRows as FollowUpActivityRow[],
          now,
        );
      } catch (err) {
        // Null, never []: "no meetings are waiting on you" and "we could not
        // look" must not render the same on a worklist.
        console.error('Error deriving meetings needing follow-up:', err);
      }

      const recordIds = [
        ...new Set(
          [
            ...activities.map((a: Record<string, unknown>) => a.business_record_id),
            ...(leadRows ?? []).map((l: Record<string, unknown>) => l.lead_id),
          ].filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ];
      const stageIds = [
        ...new Set(
          (staleRows ?? [])
            .map((d: Record<string, unknown>) => d.stage_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ];

      const [{ data: recordRows }, { data: stageRows }, leadCount, customerCount, doneToday] =
        await Promise.all([
          recordIds.length
            ? admin
                .from('business_records')
                .select(
                  'id, company_name, primary_contact_name, estimated_deal_value, status, last_contact_date',
                )
                .eq('tenant_id', tenantId)
                .in('id', recordIds)
            : Promise.resolve({ data: [] as BusinessRecordRow[] }),
          stageIds.length
            ? admin
                .from('pipeline_stages')
                .select('id, name, display_name')
                .eq('tenant_id', tenantId)
                .in('id', stageIds)
            : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
          admin
            .from('business_records')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('record_type', 'lead'),
          admin
            .from('business_records')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('record_type', 'customer'),
          // "Tasks completed" sits on a personal stat card, so it is the
          // caller's count, not the tenant's - the sixth activity read in this
          // branch and the one a scan for the list queries misses.
          applyUserScope(
            admin
              .from('business_record_activities')
              .select('id', { count: 'exact', head: true })
              .eq('tenant_id', tenantId)
              .not('completed_date', 'is', null)
              .gte('completed_date', w.startOfDay.toISOString()),
            'created_by',
            scope,
          ),
        ]);

      const companyNames = new Map<string, string | null>(
        ((recordRows ?? []) as BusinessRecordRow[]).map((r) => [
          String(r.id),
          (r.company_name as string | null) ?? null,
        ]),
      );
      const recordsById = new Map<string, BusinessRecordRow>(
        ((recordRows ?? []) as BusinessRecordRow[]).map((r) => [String(r.id), r]),
      );
      const stageNames = new Map<string, string>(
        ((stageRows ?? []) as Array<Record<string, unknown>>).map((st) => [
          String(st.id),
          String(st.display_name || st.name || ''),
        ]),
      );

      // COP-B01: quotes awaiting signature. A quote sent and not answered is
      // the card a rep acts on first, and it could not be built until COP-B02
      // gave a quote a deal to belong to - before that an account's proposals
      // could not be attributed to one of its deals.
      //
      // Best-effort and tolerant of the unapplied migration: 0088 adds
      // proposals.deal_id and has not run everywhere, so a database without it
      // shows an empty card rather than failing the whole dashboard.
      let awaitingSignature: Array<Record<string, unknown>> = [];
      try {
        const { data: sentQuotes, error: quoteError } = await admin
          .from('proposals')
          .select(
            'id, proposal_number, title, total_amount, valid_until, deal_id, business_record_id, updated_at',
          )
          .eq('tenant_id', tenantId)
          .in('status', ['sent', 'pending', 'under_review'])
          .order('updated_at', { ascending: true })
          .limit(10);
        if (quoteError) throw new Error(quoteError.message);
        awaitingSignature = (sentQuotes ?? []).map((q: Record<string, any>) => {
          const validUntil = q.valid_until ? new Date(q.valid_until) : null;
          return {
            id: q.id,
            proposalNumber: q.proposal_number ?? null,
            title: q.title ?? null,
            totalAmount: q.total_amount ?? null,
            dealId: q.deal_id ?? null,
            companyName: q.business_record_id
              ? (companyNames.get(String(q.business_record_id)) ?? null)
              : null,
            validUntil: q.valid_until ?? null,
            // Null rather than a guess when the quote carries no expiry: a
            // quote with no stated validity has not "expired in 0 days".
            daysUntilExpiry:
              validUntil && !Number.isNaN(validUntil.getTime())
                ? Math.round((validUntil.getTime() - now.getTime()) / 86400000)
                : null,
            sentAt: q.updated_at ?? null,
          };
        });
      } catch (err) {
        console.error('Error loading quotes awaiting signature:', err);
      }

      return createCorsResponse(
        {
          overdue: (overdueRows ?? []).map((a) => toActivityView(a, companyNames)),
          today: (todayRows ?? []).map((a) => toActivityView(a, companyNames)),
          upcoming: (upcomingRows ?? []).map((a) => toActivityView(a, companyNames)),
          hotLeads: (leadRows ?? []).map((l) => toLeadView(l, recordsById)),
          pipelineAlerts: (staleRows ?? []).map((d) => toStaleDealView(d, stageNames, now)),
          recentWins: (wonRows ?? []).map(toWonDealView),
          awaitingSignature,
          // Null when the derivation failed; the card renders nothing rather
          // than an empty list that reads as "nobody is waiting on you".
          meetingsNeedingFollowUp: meetingsFollowUp?.meetings ?? null,
          // Meetings with no account to check. Named rather than folded into
          // either answer (shared/meetings-followup.ts explains why).
          unlinkedMeetings: meetingsFollowUp?.unlinkedMeetings ?? null,
          // COP-I06: a narrowed list that does not say it was narrowed is a
          // wrong answer, not a safe one. The page prints this when a manager
          // is seeing their own rows because the org structure could not
          // resolve a team.
          scopeTier: scope.tier,
          scopeDegradedFrom: scope.degradedFrom,
          stats: {
            pipelineValue: null,
            quotaAttainment: null,
            conversionRate: conversionRate(leadCount.count ?? 0, customerCount.count ?? 0),
            tasksCompleted: doneToday.count ?? 0,
          },
        },
        200,
        req,
      );
    }

    // GET /dashboards/config - Get user's dashboard configuration
    if (req.method === 'GET' && dashboardType === 'config') {
      const { data: config } = await admin
        .from('dashboard_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return createCorsResponse(
        config || {
          layout: 'default',
          widgets: ['sales-summary', 'service-status', 'recent-activities'],
          theme: 'light',
        },
        200,
        req,
      );
    }

    // PUT /dashboards/config - Update dashboard configuration
    if (req.method === 'PUT' && dashboardType === 'config') {
      const body = await req.json();

      const { data: config, error } = await admin
        .from('dashboard_configs')
        .upsert({
          user_id: user.id,
          tenant_id: tenantId,
          ...body,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating dashboard config:', error);
        return createCorsResponse({ error: 'Failed to update config' }, 500, req);
      }

      return createCorsResponse(config, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in dashboards function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
