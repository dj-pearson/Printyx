// Platform Analytics Edge Function
// Advanced analytics for platform admins: revenue (LTV/CAC/NRR/ARR), conversion
// funnel, pipeline, performance, growth trends, cohorts, churn, health. Root-admin
// only (role level >= 7 OR can_access_all_tenants).
//
// Ported from server/routes-platform-analytics.ts (EDGE-004). The Express router
// 404s in production where the frontend hits functions.printyx.net/platform-analytics
// directly. All aggregations run in JS over PostgREST row reads against the
// canonical platform_* tables (shared/platform-crm-schema.ts).
//
// SCHEMA NOTES (audited against shared/platform-crm-schema.ts):
//  - platform_business_records has NO `last_mrr_change` column, so expansion MRR
//    is always 0 here (matches the legacy Express runtime, which read undefined).
//  - The legacy `sales-performance` and `cohort-analysis` handlers referenced
//    columns that do not exist (report_date/rep_id/customers_at_start/...) and
//    would 500 at runtime; here they are adapted to the REAL columns.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { cachedRoleLookup } from '../_shared/auth-cache.ts';

function num(v: unknown): number {
  const n = parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function getDateRangeFromTimeframe(timeframe: string): {
  startDate: Date | null;
  endDate: Date | null;
} {
  const now = new Date();
  let startDate: Date | null = null;
  switch (timeframe) {
    case '7d':
    case 'week':
      startDate = new Date(now.getTime() - 7 * 86400000);
      break;
    case '30d':
    case 'month':
      startDate = new Date(now.getTime() - 30 * 86400000);
      break;
    case '90d':
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 86400000);
      break;
    case '12m':
    case 'year':
      startDate = new Date(now.getTime() - 365 * 86400000);
      break;
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      return { startDate: null, endDate: null };
  }
  return { startDate, endDate: now };
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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    // AUDIT-005: this users->roles gate ran on EVERY request to this fn, a second
    // serialized hop after auth.getUser. Cached by user id for ROLE_CACHE_TTL_MS
    // (default 30s) — a role change takes effect within that window.
    const { data: userWithRole } = await cachedRoleLookup(user.id, () =>
      admin
        .from('users')
        .select('role_id, roles!inner(level, can_access_all_tenants)')
        .eq('id', user.id)
        .single(),
    );
    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;
    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'platform-analytics');
    const endpoint = parts[0];
    const sub = parts[1];
    const sp = url.searchParams;

    // AUDIT-006: helpers below replace `select('*')` + JS reduce/filter.
    //
    // Two distinct problems were being solved:
    //   1. COUNTS pulled every row just to read `.length`. They now use
    //      { count: 'exact', head: true } — the DB counts, no rows cross the wire.
    //   2. SUMS still need the values, but PostgREST silently caps a response at
    //      db-max-rows (1000) WITHOUT erroring, so a plain select simply produced a
    //      wrong total once a tenant passed that line. fetchAllRows pages explicitly
    //      so the sum is correct at any size, and the select is narrowed to the one
    //      column being summed.

    /** Count matching rows in the DB — no row data transferred. */
    async function countRecords(
      start: Date | null,
      end: Date | null,
      filters: Record<string, string> = {},
      table = 'platform_business_records',
    ): Promise<number> {
      let q = admin.from(table).select('*', { count: 'exact', head: true });
      if (start) q = q.gte('created_at', start.toISOString());
      if (end) q = q.lte('created_at', end.toISOString());
      for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
      const { count } = await q;
      return count ?? 0;
    }

    /** Page through every matching row (defeats the silent db-max-rows truncation). */
    async function fetchAllRows(
      table: string,
      columns: string,
      build: (q: any) => any,
      pageSize = 1000,
    ): Promise<any[]> {
      const out: any[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await build(admin.from(table).select(columns)).range(
          offset,
          offset + pageSize - 1,
        );
        if (error || !data || data.length === 0) break;
        out.push(...data);
        if (data.length < pageSize) break;
      }
      return out;
    }

    // Helper: fetch business records with optional created_at range + extra eq filters.
    async function fetchRecords(
      start: Date | null,
      end: Date | null,
      filters: Record<string, string> = {},
      columns = '*',
    ): Promise<any[]> {
      return await fetchAllRows('platform_business_records', columns, (q: any) => {
        if (start) q = q.gte('created_at', start.toISOString());
        if (end) q = q.lte('created_at', end.toISOString());
        for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
        return q;
      });
    }

    async function fetchDeals(start: Date | null, end: Date | null): Promise<any[]> {
      let q = admin.from('platform_deals').select('*');
      if (start) q = q.gte('created_at', start.toISOString());
      if (end) q = q.lte('created_at', end.toISOString());
      const { data } = await q;
      return data || [];
    }

    // ----------------------------------------------------------------- revenue
    if (req.method === 'GET' && endpoint === 'revenue-metrics') {
      const startDate = sp.get('startDate') ? new Date(sp.get('startDate')!) : null;
      const endDate = sp.get('endDate') ? new Date(sp.get('endDate')!) : null;

      // AUDIT-006: these three were serialized and each pulled full rows. Only the
      // active tenants' current_mrr is actually needed as data; the other two were
      // fetched purely to read `.length`, so they are now DB counts. Run in parallel.
      const [activeTenants, churnedTenantCount, newCustomerCount] = await Promise.all([
        fetchRecords(
          startDate,
          endDate,
          { record_type: 'tenant', status: 'active_customer' },
          'current_mrr',
        ),
        countRecords(startDate, endDate, { record_type: 'tenant', status: 'churned' }),
        countRecords(startDate, endDate, { record_type: 'tenant' }),
      ]);

      const totalMRR = activeTenants.reduce((s, t) => s + num(t.current_mrr), 0);
      const totalARR = totalMRR * 12;
      const arpa = activeTenants.length > 0 ? totalMRR / activeTenants.length : 0;
      const churnRate =
        activeTenants.length + churnedTenantCount > 0
          ? (churnedTenantCount / (activeTenants.length + churnedTenantCount)) * 100
          : 0;
      const grr = 100 - churnRate;
      // No last_mrr_change column → expansion always 0 (parity with Express runtime).
      const expansionMRR = 0;
      const expansionRate = 0;
      const nrr = grr + expansionRate;
      const avgLifetimeMonths = churnRate > 0 ? 1 / (churnRate / 100) : 24;
      const ltv = arpa * avgLifetimeMonths;
      const estimatedCAC = ltv / 3;
      const ltvCacRatio = estimatedCAC > 0 ? ltv / estimatedCAC : 0;
      const paybackPeriod = arpa > 0 ? estimatedCAC / arpa : 0;

      return createCorsResponse(
        {
          metrics: {
            mrr: totalMRR.toFixed(2),
            arr: totalARR.toFixed(2),
            arpa: arpa.toFixed(2),
            ltv: ltv.toFixed(2),
            cac: estimatedCAC.toFixed(2),
            ltvCacRatio: ltvCacRatio.toFixed(2),
            grr: grr.toFixed(2),
            nrr: nrr.toFixed(2),
            churnRate: churnRate.toFixed(2),
            expansionRate: expansionRate.toFixed(2),
            paybackPeriod: paybackPeriod.toFixed(1),
          },
          counts: {
            activeTenants: activeTenants.length,
            churnedTenants: churnedTenantCount,
            newCustomers: newCustomerCount,
            expandedTenants: 0,
          },
          dateRange: { start: sp.get('startDate') || 'all', end: sp.get('endDate') || 'all' },
        },
        200,
        req,
      );
    }

    // ----------------------------------------------------------- conversion-funnel
    if (req.method === 'GET' && endpoint === 'conversion-funnel') {
      const startDate = sp.get('startDate') ? new Date(sp.get('startDate')!) : null;
      const endDate = sp.get('endDate') ? new Date(sp.get('endDate')!) : null;
      const all = await fetchRecords(startDate, endDate);

      const statusCounts: Record<string, number> = {
        new: 0,
        contacted: 0,
        qualified: 0,
        trial_active: 0,
        trial_converted: 0,
        active_customer: 0,
        churned: 0,
        lost: 0,
      };
      for (const r of all) if (r.status in statusCounts) statusCounts[r.status]++;

      const totalProspects = all.filter((r) => r.record_type === 'prospect').length;
      const totalTenants = all.filter((r) => r.record_type === 'tenant').length;
      const contactedRate =
        totalProspects > 0 ? (statusCounts.contacted / totalProspects) * 100 : 0;
      const qualifiedRate =
        totalProspects > 0 ? (statusCounts.qualified / totalProspects) * 100 : 0;
      const trialRate = totalProspects > 0 ? (statusCounts.trial_active / totalProspects) * 100 : 0;
      const conversionRate = totalProspects > 0 ? (totalTenants / totalProspects) * 100 : 0;

      const deals = await fetchDeals(startDate, endDate);
      const dealsByStage = deals.reduce((acc: Record<string, number>, d) => {
        const stage = d.stage || 'prospecting';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {});
      const closedWon = deals.filter((d) => d.stage === 'closed_won').length;
      const closedLost = deals.filter((d) => d.stage === 'closed_lost').length;
      const totalClosed = closedWon + closedLost;
      const winRate = totalClosed > 0 ? (closedWon / totalClosed) * 100 : 0;

      return createCorsResponse(
        {
          funnel: [
            {
              stage: 'New Prospects',
              count: statusCounts.new,
              percentage: 100,
              conversionToNext: contactedRate.toFixed(2),
            },
            {
              stage: 'Contacted',
              count: statusCounts.contacted,
              percentage: contactedRate.toFixed(2),
              conversionToNext: qualifiedRate.toFixed(2),
            },
            {
              stage: 'Qualified',
              count: statusCounts.qualified,
              percentage: qualifiedRate.toFixed(2),
              conversionToNext: trialRate.toFixed(2),
            },
            {
              stage: 'Trial Active',
              count: statusCounts.trial_active,
              percentage: trialRate.toFixed(2),
              conversionToNext: conversionRate.toFixed(2),
            },
            {
              stage: 'Active Customer',
              count: statusCounts.active_customer,
              percentage: conversionRate.toFixed(2),
              conversionToNext: null,
            },
          ],
          summary: {
            totalProspects,
            totalTenants,
            overallConversionRate: conversionRate.toFixed(2),
            contactedRate: contactedRate.toFixed(2),
            qualifiedRate: qualifiedRate.toFixed(2),
            trialRate: trialRate.toFixed(2),
          },
          dealPipeline: {
            dealsByStage,
            totalDeals: deals.length,
            closedWon,
            closedLost,
            winRate: winRate.toFixed(2),
          },
          dateRange: { start: sp.get('startDate') || 'all', end: sp.get('endDate') || 'all' },
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------- conversion-metrics
    if (req.method === 'GET' && endpoint === 'conversion-metrics') {
      const timeframe = sp.get('timeframe') || '30d';
      const { startDate, endDate } = getDateRangeFromTimeframe(timeframe);
      const all = await fetchRecords(startDate, endDate);

      const sc: Record<string, number> = {
        new: 0,
        contacted: 0,
        qualified: 0,
        proposal_sent: 0,
        negotiation: 0,
        trial_active: 0,
        trial_converted: 0,
        active_customer: 0,
        churned: 0,
        lost: 0,
      };
      for (const r of all) if (r.status in sc) sc[r.status]++;

      const totalProspects = all.filter((r) => r.record_type === 'prospect').length;
      const totalTenants = all.filter((r) => r.record_type === 'tenant').length;
      const totalConverted = sc.active_customer + sc.trial_converted;
      const totalStart = Math.max(
        sc.new + sc.contacted + sc.qualified + sc.proposal_sent + sc.negotiation + totalConverted,
        1,
      );
      const funnelStages = [
        { stage: 'Prospects', count: totalStart },
        {
          stage: 'Contacted',
          count: sc.contacted + sc.qualified + sc.proposal_sent + sc.negotiation + totalConverted,
        },
        {
          stage: 'Qualified',
          count: sc.qualified + sc.proposal_sent + sc.negotiation + totalConverted,
        },
        { stage: 'Proposal Sent', count: sc.proposal_sent + sc.negotiation + totalConverted },
        { stage: 'Negotiation', count: sc.negotiation + totalConverted },
        { stage: 'Won', count: totalConverted },
      ];
      const funnelData = funnelStages.map((s) => ({
        stage: s.stage,
        count: s.count,
        percentage: totalStart > 0 ? parseFloat(((s.count / totalStart) * 100).toFixed(1)) : 0,
      }));
      const leadConversionRate =
        totalProspects > 0 ? parseFloat(((totalConverted / totalProspects) * 100).toFixed(2)) : 0;

      const deals = await fetchDeals(startDate, endDate);
      const closedWon = deals.filter((d) => d.stage === 'closed_won').length;
      const closedLost = deals.filter((d) => d.stage === 'closed_lost').length;
      const totalClosed = closedWon + closedLost;
      const winRate =
        totalClosed > 0 ? parseFloat(((closedWon / totalClosed) * 100).toFixed(2)) : 0;

      const stageConversions = [];
      for (let i = 1; i < funnelData.length; i++) {
        const prev = funnelData[i - 1];
        const curr = funnelData[i];
        stageConversions.push({
          from: prev.stage,
          to: curr.stage,
          rate: prev.count > 0 ? parseFloat(((curr.count / prev.count) * 100).toFixed(1)) : 0,
        });
      }

      return createCorsResponse(
        {
          leadConversionRate,
          funnelData,
          stageConversions,
          winRate,
          summary: {
            totalProspects,
            totalTenants,
            totalConverted,
            closedWon,
            closedLost,
            totalDeals: deals.length,
          },
          timeframe,
        },
        200,
        req,
      );
    }

    // ------------------------------------------------------------- pipeline-metrics
    if (req.method === 'GET' && endpoint === 'pipeline-metrics') {
      const timeframe = sp.get('timeframe') || '30d';
      const { startDate, endDate } = getDateRangeFromTimeframe(timeframe);
      const allDeals = await fetchDeals(startDate, endDate);

      const openStages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closing'];
      const openDeals = allDeals.filter((d) => openStages.includes(d.stage || ''));
      const totalValue = openDeals.reduce((s, d) => s + num(d.deal_value), 0);
      const weightedValue = openDeals.reduce(
        (s, d) => s + (num(d.deal_value) * (d.probability || 0)) / 100,
        0,
      );
      const closedWon = allDeals.filter((d) => d.stage === 'closed_won');
      const closedLost = allDeals.filter((d) => d.stage === 'closed_lost');
      const totalClosed = closedWon.length + closedLost.length;
      const winRate =
        totalClosed > 0 ? parseFloat(((closedWon.length / totalClosed) * 100).toFixed(1)) : 0;

      let avgSalesCycle = 0;
      if (closedWon.length > 0) {
        const totalDays = closedWon.reduce((s, d) => {
          const created = new Date(d.created_at).getTime();
          const closed = d.closed_at ? new Date(d.closed_at).getTime() : Date.now();
          return s + Math.max((closed - created) / 86400000, 1);
        }, 0);
        avgSalesCycle = Math.round(totalDays / closedWon.length);
      }
      const wonRevenue = closedWon.reduce((s, d) => s + num(d.deal_value), 0);
      const coverage = wonRevenue > 0 ? parseFloat((totalValue / wonRevenue).toFixed(1)) : 0;

      const stageColors: Record<string, string> = {
        prospecting: '#3b82f6',
        qualification: '#8b5cf6',
        proposal: '#ec4899',
        negotiation: '#f59e0b',
        closing: '#10b981',
      };
      const stageLabels: Record<string, string> = {
        prospecting: 'Prospecting',
        qualification: 'Qualification',
        proposal: 'Proposal',
        negotiation: 'Negotiation',
        closing: 'Closing',
      };
      const distributionData = openStages
        .map((stage) => {
          const sd = openDeals.filter((d) => d.stage === stage);
          return {
            name: stageLabels[stage] || stage,
            value: sd.length,
            color: stageColors[stage] || '#6b7280',
            totalValue: sd.reduce((s, d) => s + num(d.deal_value), 0),
          };
        })
        .filter((s) => s.value > 0);

      return createCorsResponse(
        {
          totalValue: parseFloat(totalValue.toFixed(2)),
          weightedValue: parseFloat(weightedValue.toFixed(2)),
          coverage,
          winRate,
          avgSalesCycle,
          distributionData,
          summary: {
            totalDeals: allDeals.length,
            openDeals: openDeals.length,
            closedWon: closedWon.length,
            closedLost: closedLost.length,
          },
          timeframe,
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------- performance-metrics
    if (req.method === 'GET' && endpoint === 'performance-metrics') {
      const timeframe = sp.get('timeframe') || '30d';
      const { startDate, endDate } = getDateRangeFromTimeframe(timeframe);
      const all = await fetchRecords(startDate, endDate);

      const sourceMap: Record<string, { leads: number; conversions: number }> = {};
      for (const r of all) {
        const source = r.lead_source || 'Other';
        if (!sourceMap[source]) sourceMap[source] = { leads: 0, conversions: 0 };
        sourceMap[source].leads += 1;
        if (r.status === 'active_customer' || r.status === 'trial_converted')
          sourceMap[source].conversions += 1;
      }
      const sourceData = Object.entries(sourceMap)
        .map(([source, d]) => ({
          source,
          leads: d.leads,
          conversions: d.conversions,
          rate: d.leads > 0 ? parseFloat(((d.conversions / d.leads) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.leads - a.leads);

      let rq = admin
        .from('platform_activity_reports')
        .select('*')
        .order('period_start', { ascending: false });
      if (startDate) rq = rq.gte('period_start', startDate.toISOString());
      if (endDate) rq = rq.lte('period_start', endDate.toISOString());
      const { data: reports = [] } = await rq;

      const repMap: Record<string, any> = {};
      for (const report of reports || []) {
        const rep = report.user_id || 'unassigned';
        if (!repMap[rep]) {
          repMap[rep] = {
            repId: rep,
            repName: rep,
            totalCalls: 0,
            totalEmails: 0,
            totalMeetings: 0,
            totalDemos: 0,
            totalProposals: 0,
            dealsWon: 0,
            revenueGenerated: 0,
          };
        }
        repMap[rep].totalCalls += report.total_calls || 0;
        repMap[rep].totalEmails += report.total_emails || 0;
        repMap[rep].totalMeetings += report.meetings_held || 0;
        repMap[rep].totalDemos += report.demos_completed || 0;
        repMap[rep].dealsWon += report.deals_won || 0;
        repMap[rep].revenueGenerated += num(report.total_arr_booked);
      }
      const topPerformers = Object.values(repMap)
        .sort((a: any, b: any) => b.revenueGenerated - a.revenueGenerated)
        .slice(0, 10);

      const rs = reports || [];
      const activityTotals = {
        calls: rs.reduce((s, r) => s + (r.total_calls || 0), 0),
        emails: rs.reduce((s, r) => s + (r.total_emails || 0), 0),
        meetings: rs.reduce((s, r) => s + (r.meetings_held || 0), 0),
        demos: rs.reduce((s, r) => s + (r.demos_completed || 0), 0),
        proposals: rs.reduce((s, r) => s + (r.new_deals || 0), 0),
      };
      const daysDiff =
        startDate && endDate
          ? Math.max(Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000), 1)
          : 30;
      const activityAvgPerDay = {
        calls: Math.round(activityTotals.calls / daysDiff),
        emails: Math.round(activityTotals.emails / daysDiff),
        meetings: Math.round(activityTotals.meetings / daysDiff),
        demos: Math.round(activityTotals.demos / daysDiff),
        proposals: Math.round(activityTotals.proposals / daysDiff),
      };

      return createCorsResponse(
        {
          sourceData,
          topPerformers,
          activityTotals,
          activityAvgPerDay,
          summary: {
            totalRecords: all.length,
            totalReports: rs.length,
            uniqueReps: Object.keys(repMap).length,
          },
          timeframe,
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------- growth-trends
    if (req.method === 'GET' && endpoint === 'growth-trends') {
      const timeframe = sp.get('timeframe') || '30d';
      const { startDate } = getDateRangeFromTimeframe(timeframe);
      let q = admin
        .from('platform_business_records')
        .select('*')
        .eq('record_type', 'tenant')
        .order('created_at', { ascending: true });
      if (startDate) q = q.gte('created_at', startDate.toISOString());
      const { data: allTenants = [] } = await q;

      const monthMap: Record<
        string,
        { newMRR: number; expansionMRR: number; churnMRR: number; activeTenants: number }
      > = {};
      for (const t of allTenants || []) {
        const created = new Date(t.created_at);
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key])
          monthMap[key] = { newMRR: 0, expansionMRR: 0, churnMRR: 0, activeTenants: 0 };
        const mrr = num(t.current_mrr);
        if (t.status === 'active_customer' || t.status === 'trial_active') {
          monthMap[key].activeTenants += 1;
          monthMap[key].newMRR += mrr; // no last_mrr_change column → all counted as new
        } else if (t.status === 'churned' || t.status === 'trial_churned') {
          monthMap[key].churnMRR += mrr;
        }
      }

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const sortedMonths = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b));
      let runningMRR = 0;
      const revenueData = sortedMonths.map(([key, data]) => {
        const monthIndex = parseInt(key.split('-')[1]) - 1;
        const year = key.split('-')[0];
        runningMRR = Math.max(runningMRR + data.newMRR + data.expansionMRR - data.churnMRR, 0);
        return {
          month: `${monthNames[monthIndex]} ${year.slice(2)}`,
          monthKey: key,
          mrr: parseFloat(runningMRR.toFixed(2)),
          arr: parseFloat((runningMRR * 12).toFixed(2)),
          new: parseFloat(data.newMRR.toFixed(2)),
          expansion: parseFloat(data.expansionMRR.toFixed(2)),
          churn: parseFloat(data.churnMRR.toFixed(2)),
          activeTenants: data.activeTenants,
        };
      });

      let mrrGrowth = 0;
      let arrGrowth = 0;
      if (revenueData.length >= 2) {
        const cur = revenueData[revenueData.length - 1];
        const prev = revenueData[revenueData.length - 2];
        if (prev.mrr > 0) {
          mrrGrowth = parseFloat((((cur.mrr - prev.mrr) / prev.mrr) * 100).toFixed(1));
          arrGrowth = parseFloat((((cur.arr - prev.arr) / prev.arr) * 100).toFixed(1));
        }
      }

      return createCorsResponse(
        {
          revenueData,
          summary: {
            latestMRR: revenueData.length > 0 ? revenueData[revenueData.length - 1].mrr : 0,
            latestARR: revenueData.length > 0 ? revenueData[revenueData.length - 1].arr : 0,
            mrrGrowth,
            arrGrowth,
            totalMonths: revenueData.length,
          },
          timeframe,
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------- health-trends
    if (req.method === 'GET' && endpoint === 'health-trends') {
      const startDate = sp.get('startDate');
      const endDate = sp.get('endDate');
      let q = admin
        .from('platform_health_scores')
        .select('*')
        .order('calculated_at', { ascending: false });
      if (startDate) q = q.gte('calculated_at', startDate);
      if (endDate) q = q.lte('calculated_at', endDate);
      const { data: healthScores = [] } = await q;
      const hs = healthScores || [];

      const byStatus: Record<string, any> = {};
      for (const s of hs) {
        const status = s.health_status || 'unknown';
        if (!byStatus[status]) byStatus[status] = { count: 0, totalScore: 0, totalRevenue: 0 };
        byStatus[status].count += 1;
        byStatus[status].totalScore += s.overall_score || 0;
      }
      for (const lvl of Object.values(byStatus) as any[])
        lvl.avgScore = lvl.count > 0 ? lvl.totalScore / lvl.count : 0;

      const midpoint = Math.floor(hs.length / 2);
      const firstHalf = hs.slice(midpoint);
      const secondHalf = hs.slice(0, midpoint);
      const avgFirst =
        firstHalf.length > 0
          ? firstHalf.reduce((s, x) => s + (x.overall_score || 0), 0) / firstHalf.length
          : 0;
      const avgSecond =
        secondHalf.length > 0
          ? secondHalf.reduce((s, x) => s + (x.overall_score || 0), 0) / secondHalf.length
          : 0;
      const trend = avgSecond - avgFirst;
      const trendDirection = trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable';

      return createCorsResponse(
        {
          byStatus,
          trend: {
            direction: trendDirection,
            change: trend.toFixed(2),
            avgFirst: avgFirst.toFixed(2),
            avgSecond: avgSecond.toFixed(2),
          },
          summary: {
            total: hs.length,
            healthy: byStatus.healthy?.count || 0,
            at_risk: byStatus.at_risk?.count || 0,
            critical: byStatus.critical?.count || 0,
          },
          dateRange: { start: startDate || 'all', end: endDate || 'all' },
        },
        200,
        req,
      );
    }

    // -------------------------------------------------------------- pipeline-forecast
    if (req.method === 'GET' && endpoint === 'pipeline-forecast') {
      const months = parseInt(sp.get('months') || '3');
      const { data: openDeals = [] } = await admin
        .from('platform_deals')
        .select('*')
        .in('stage', ['prospecting', 'qualification', 'proposal', 'negotiation']);
      const forecastByMonth: Record<string, any> = {};
      for (const deal of openDeals || []) {
        const closeDate = deal.expected_close_date
          ? new Date(deal.expected_close_date)
          : new Date(Date.now() + 30 * 86400000);
        const key = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`;
        if (!forecastByMonth[key])
          forecastByMonth[key] = {
            month: key,
            totalPipeline: 0,
            weightedPipeline: 0,
            dealCount: 0,
            deals: [],
          };
        const dealValue = num(deal.deal_value);
        const probability = deal.probability || 0;
        const weightedValue = (dealValue * probability) / 100;
        forecastByMonth[key].totalPipeline += dealValue;
        forecastByMonth[key].weightedPipeline += weightedValue;
        forecastByMonth[key].dealCount += 1;
        forecastByMonth[key].deals.push({
          id: deal.id,
          dealName: deal.deal_name,
          dealValue,
          probability,
          weightedValue,
          stage: deal.stage,
        });
      }
      const sorted = Object.values(forecastByMonth).sort((a: any, b: any) =>
        a.month.localeCompare(b.month),
      );
      const totals = {
        totalPipeline: sorted.reduce((s: number, f: any) => s + f.totalPipeline, 0),
        weightedPipeline: sorted.reduce((s: number, f: any) => s + f.weightedPipeline, 0),
        totalDeals: sorted.reduce((s: number, f: any) => s + f.dealCount, 0),
      };
      return createCorsResponse(
        { forecast: sorted.slice(0, months), totals, forecastPeriod: `${months} months` },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------- churn-analysis
    if (req.method === 'GET' && endpoint === 'churn-analysis') {
      const startDate = sp.get('startDate');
      const endDate = sp.get('endDate');
      let q = admin
        .from('platform_churn_predictions')
        .select('*')
        .order('predicted_at', { ascending: false })
        .limit(1000);
      if (startDate) q = q.gte('predicted_at', startDate);
      if (endDate) q = q.lte('predicted_at', endDate);
      const { data: predictions = [] } = await q;

      // Real column is churn_risk (no churn_risk_level / estimated_revenue_impact).
      const byRiskLevel: Record<string, any> = {};
      for (const p of predictions || []) {
        const risk = p.churn_risk || 'unknown';
        if (!byRiskLevel[risk])
          byRiskLevel[risk] = { count: 0, totalProbability: 0, totalRevenue: 0 };
        byRiskLevel[risk].count += 1;
        byRiskLevel[risk].totalProbability += num(p.churn_probability);
        byRiskLevel[risk].totalRevenue += num(p.estimated_arr);
      }
      for (const lvl of Object.values(byRiskLevel) as any[]) {
        lvl.avgProbability = lvl.count > 0 ? lvl.totalProbability / lvl.count : 0;
        lvl.avgRevenueImpact = lvl.count > 0 ? lvl.totalRevenue / lvl.count : 0;
      }

      let cq = admin.from('platform_business_records').select('*').eq('status', 'churned');
      if (startDate) cq = cq.gte('churned_at', startDate);
      const { data: churnedTenants = [] } = await cq;
      const churnedRevenue =
        (churnedTenants || []).reduce((s, t) => s + num(t.current_mrr), 0) * 12;

      return createCorsResponse(
        {
          predictions: {
            total: (predictions || []).length,
            byRiskLevel,
            highRiskCount: byRiskLevel.high?.count || 0,
            mediumRiskCount: byRiskLevel.medium?.count || 0,
            lowRiskCount: byRiskLevel.low?.count || 0,
          },
          actual: {
            churnedCount: (churnedTenants || []).length,
            churnedRevenue: churnedRevenue.toFixed(2),
          },
          dateRange: { start: startDate || 'all', end: endDate || 'all' },
        },
        200,
        req,
      );
    }

    // --------------------------------------------------------------- activity-trends
    if (req.method === 'GET' && endpoint === 'activity-trends') {
      const startDate = sp.get('startDate');
      const endDate = sp.get('endDate');
      const groupBy = sp.get('groupBy') || 'day';
      let q = admin
        .from('platform_activities')
        .select('*')
        .order('activity_date', { ascending: false });
      if (startDate) q = q.gte('activity_date', startDate);
      if (endDate) q = q.lte('activity_date', endDate);
      const { data: activities = [] } = await q;

      const trends: Record<string, any> = {};
      for (const a of activities || []) {
        const date = new Date(a.activity_date);
        let dateKey: string;
        if (groupBy === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
        } else if (groupBy === 'month') {
          dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          dateKey = date.toISOString().split('T')[0];
        }
        if (!trends[dateKey])
          trends[dateKey] = {
            date: dateKey,
            call: 0,
            email: 0,
            meeting: 0,
            demo: 0,
            proposal: 0,
            task: 0,
            note: 0,
            total: 0,
          };
        const t = a.activity_type || 'note';
        trends[dateKey][t] = (trends[dateKey][t] || 0) + 1;
        trends[dateKey].total += 1;
      }
      const sortedTrends = Object.values(trends).sort((a: any, b: any) =>
        a.date.localeCompare(b.date),
      );
      const acts = activities || [];
      const totals = {
        call: acts.filter((a) => a.activity_type === 'call').length,
        email: acts.filter((a) => a.activity_type === 'email').length,
        meeting: acts.filter((a) => a.activity_type === 'meeting').length,
        demo: acts.filter((a) => a.activity_type === 'demo').length,
        proposal: acts.filter((a) => a.activity_type === 'proposal').length,
        task: acts.filter((a) => a.activity_type === 'task').length,
        note: acts.filter((a) => a.activity_type === 'note').length,
        total: acts.length,
      };
      return createCorsResponse(
        {
          trends: sortedTrends,
          totals,
          groupBy,
          dateRange: { start: startDate || 'all', end: endDate || 'all' },
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------- goals-tracking
    if (req.method === 'GET' && endpoint === 'goals-tracking') {
      const repId = sp.get('repId');
      const startDate = sp.get('startDate');
      const endDate = sp.get('endDate');
      let q = admin
        .from('platform_sales_goals')
        .select('*')
        .order('start_date', { ascending: false });
      if (repId) q = q.eq('assigned_to_user_id', repId);
      if (startDate) q = q.gte('start_date', startDate);
      if (endDate) q = q.lte('end_date', endDate);
      const { data: goals = [] } = await q;

      const goalsWithAttainment = (goals || []).map((g: any) => {
        const revenueAttainment =
          num(g.target_value) > 0 ? (num(g.current_value) / num(g.target_value)) * 100 : 0;
        return {
          ...g,
          attainment: {
            revenue: revenueAttainment.toFixed(2),
            deals: '0.00',
            activities: '0.00',
            overall: revenueAttainment.toFixed(2),
          },
          gaps: {
            revenue: (num(g.target_value) - num(g.current_value)).toFixed(2),
            deals: 0,
            activities: 0,
          },
        };
      });
      const teamSummary = {
        totalRevenueTarget: (goals || []).reduce((s, g) => s + num(g.target_value), 0),
        totalRevenueActual: (goals || []).reduce((s, g) => s + num(g.current_value), 0),
        totalDealsTarget: 0,
        totalDealsActual: 0,
        goalsOnTrack: goalsWithAttainment.filter((g: any) => parseFloat(g.attainment.overall) >= 90)
          .length,
        goalsAtRisk: goalsWithAttainment.filter((g: any) => parseFloat(g.attainment.overall) < 70)
          .length,
      };
      return createCorsResponse(
        {
          goals: goalsWithAttainment,
          teamSummary,
          dateRange: { start: startDate || 'all', end: endDate || 'all' },
        },
        200,
        req,
      );
    }

    // -------------------------------------------------------------- sales-performance
    // Adapted to real platform_activity_reports columns (the legacy Express handler
    // referenced report_date/rep_id/calls_logged/... which do not exist).
    if (req.method === 'GET' && endpoint === 'sales-performance') {
      const startDate = sp.get('startDate');
      const endDate = sp.get('endDate');
      const repId = sp.get('repId');
      let q = admin
        .from('platform_activity_reports')
        .select('*')
        .order('period_start', { ascending: false });
      if (startDate) q = q.gte('period_start', startDate);
      if (endDate) q = q.lte('period_start', endDate);
      if (repId) q = q.eq('user_id', repId);
      const { data: reports = [] } = await q;

      const repMetrics: Record<string, any> = {};
      for (const r of reports || []) {
        const rep = r.user_id || 'unassigned';
        if (!repMetrics[rep]) {
          repMetrics[rep] = {
            repId: rep,
            repName: rep,
            totalCalls: 0,
            totalEmails: 0,
            totalMeetings: 0,
            totalDemos: 0,
            totalActivities: 0,
            leadsGenerated: 0,
            opportunitiesCreated: 0,
            dealsWon: 0,
            revenueGenerated: 0,
            avgDealSize: 0,
            conversionRate: 0,
          };
        }
        repMetrics[rep].totalCalls += r.total_calls || 0;
        repMetrics[rep].totalEmails += r.total_emails || 0;
        repMetrics[rep].totalMeetings += r.meetings_held || 0;
        repMetrics[rep].totalDemos += r.demos_completed || 0;
        repMetrics[rep].leadsGenerated += r.new_prospects || 0;
        repMetrics[rep].opportunitiesCreated += r.new_deals || 0;
        repMetrics[rep].dealsWon += r.deals_won || 0;
        repMetrics[rep].revenueGenerated += num(r.total_arr_booked);
      }
      for (const m of Object.values(repMetrics) as any[]) {
        m.totalActivities = m.totalCalls + m.totalEmails + m.totalMeetings + m.totalDemos;
        m.avgDealSize = m.dealsWon > 0 ? m.revenueGenerated / m.dealsWon : 0;
        m.conversionRate = m.leadsGenerated > 0 ? (m.dealsWon / m.leadsGenerated) * 100 : 0;
      }
      const sortedReps = Object.values(repMetrics).sort(
        (a: any, b: any) => b.revenueGenerated - a.revenueGenerated,
      );
      const teamTotals = {
        totalCalls: sortedReps.reduce((s: number, r: any) => s + r.totalCalls, 0),
        totalEmails: sortedReps.reduce((s: number, r: any) => s + r.totalEmails, 0),
        totalMeetings: sortedReps.reduce((s: number, r: any) => s + r.totalMeetings, 0),
        totalDemos: sortedReps.reduce((s: number, r: any) => s + r.totalDemos, 0),
        totalActivities: sortedReps.reduce((s: number, r: any) => s + r.totalActivities, 0),
        leadsGenerated: sortedReps.reduce((s: number, r: any) => s + r.leadsGenerated, 0),
        opportunitiesCreated: sortedReps.reduce(
          (s: number, r: any) => s + r.opportunitiesCreated,
          0,
        ),
        dealsWon: sortedReps.reduce((s: number, r: any) => s + r.dealsWon, 0),
        revenueGenerated: sortedReps.reduce((s: number, r: any) => s + r.revenueGenerated, 0),
      };
      return createCorsResponse(
        {
          repPerformance: sortedReps,
          teamTotals,
          dateRange: { start: startDate || 'all', end: endDate || 'all' },
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------- cohort-analysis
    // Adapted to the real platform_cohort_analysis columns.
    if (req.method === 'GET' && endpoint === 'cohort-analysis') {
      const startDate = sp.get('startDate');
      const endDate = sp.get('endDate');
      let q = admin
        .from('platform_cohort_analysis')
        .select('*')
        .order('cohort_date', { ascending: false });
      if (startDate) q = q.gte('cohort_date', startDate);
      if (endDate) q = q.lte('cohort_date', endDate);
      const { data: cohorts = [] } = await q;
      const list = cohorts || [];

      const totalCustomers = list.reduce((s, c) => s + (c.initial_size || 0), 0);
      const totalRevenue = list.reduce((s, c) => s + num(c.initial_mrr), 0);
      const avgRetention =
        list.length > 0 ? list.reduce((s, c) => s + num(c.retention_rate), 0) / list.length : 0;

      return createCorsResponse(
        {
          cohorts: list,
          summary: {
            totalCohorts: list.length,
            totalCustomers,
            totalRevenue,
            averageRetentionRate: avgRetention.toFixed(2),
            dateRange: { start: startDate || 'all', end: endDate || 'all' },
          },
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in platform-analytics function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
