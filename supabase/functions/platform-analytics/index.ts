// Platform Analytics Edge Function
// Advanced analytics and reporting for platform administrators (Root Admin only).
// Ported from server/routes-platform-analytics.ts.
//
// IMPORTANT — column drift: the Express source references several Drizzle fields
// that do NOT exist on the authoritative platform-crm-schema.ts. Those reads are
// mapped to the closest real snake_case column or defaulted to 0/empty so the
// frontend response shape is preserved. See the per-handler notes below.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

/**
 * Convert a timeframe string ('7d', '30d', '90d', '12m', 'ytd', 'all')
 * into a { startDate, endDate } pair of Date objects.
 */
function getDateRangeFromTimeframe(timeframe: string): {
  startDate: Date | null;
  endDate: Date | null;
} {
  const now = new Date();
  let startDate: Date | null = null;
  const endDate: Date | null = now;

  switch (timeframe) {
    case '7d':
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '12m':
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
      break;
    case 'all':
    default:
      return { startDate: null, endDate: null };
  }

  return { startDate, endDate };
}

const num = (x: unknown): number => Number(x) || 0;

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    // Check for root admin access (role level 7+)
    const { data: userWithRole } = await admin
      .from('users')
      .select('role_id, roles!inner(level, can_access_all_tenants)')
      .eq('id', user.id)
      .single();

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'platform-analytics');
    const endpoint = parts[0];
    const subResource = parts[1];

    // ========================================================================
    // GET /cohort-analysis
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'cohort-analysis' && !subResource) {
      try {
        const periodType = url.searchParams.get('periodType') || 'monthly';
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        // Drift: route filters platformCohortAnalysis.periodType -> real column is cohort_period.
        let query = admin
          .from('platform_cohort_analysis')
          .select('*')
          .eq('cohort_period', periodType)
          .order('cohort_date', { ascending: false }) as any;
        if (startDate) query = query.gte('cohort_date', new Date(startDate).toISOString());
        if (endDate) query = query.lte('cohort_date', new Date(endDate).toISOString());

        const { data, error } = await query;
        if (error) throw error;
        const cohorts = (data || []) as any[];

        // Drift: route reads customersAtStart/revenueAtStart -> real columns are
        // initial_size / initial_mrr.
        const totalCustomers = cohorts.reduce((sum, c) => sum + num(c.initial_size), 0);
        const totalRevenue = cohorts.reduce((sum, c) => sum + num(c.initial_mrr), 0);
        const avgRetention =
          cohorts.length > 0
            ? cohorts.reduce((sum, c) => sum + num(c.retention_rate), 0) / cohorts.length
            : 0;

        return createCorsResponse(
          {
            cohorts,
            summary: {
              totalCohorts: cohorts.length,
              totalCustomers,
              totalRevenue,
              averageRetentionRate: avgRetention.toFixed(2),
              periodType,
              dateRange: {
                start: startDate || 'all',
                end: endDate || 'all',
              },
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error fetching cohort analysis:', error);
        return createCorsResponse({ error: 'Failed to fetch cohort analysis' }, 500, req);
      }
    }

    // ========================================================================
    // POST /cohort-analysis/generate
    // ========================================================================
    if (req.method === 'POST' && endpoint === 'cohort-analysis' && subResource === 'generate') {
      try {
        const body = await req.json();
        const { cohortStartDate, periodType = 'monthly', cohortDefinition = 'signup' } = body;

        if (!cohortStartDate) {
          return createCorsResponse({ error: 'cohortStartDate is required' }, 400, req);
        }

        const startDate = new Date(cohortStartDate);
        const endDate = new Date(startDate);
        if (periodType === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (periodType === 'quarterly') {
          endDate.setMonth(endDate.getMonth() + 3);
        } else if (periodType === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        // Get customers who joined in this cohort period (tenant records).
        const { data: cohortData, error: cohortErr } = await (admin
          .from('platform_business_records')
          .select('*')
          .eq('record_type', 'tenant')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()) as any);
        if (cohortErr) throw cohortErr;
        const cohortCustomers = (cohortData || []) as any[];

        const customersAtStart = cohortCustomers.length;
        const revenueAtStart = cohortCustomers.reduce((sum, c) => sum + num(c.current_mrr), 0);

        const activeCustomers = cohortCustomers.filter(
          (c) => c.status === 'active_customer' || c.status === 'trial_active',
        );
        const customersNow = activeCustomers.length;
        const revenueNow = activeCustomers.reduce((sum, c) => sum + num(c.current_mrr), 0);

        const retentionRate =
          customersAtStart > 0 ? ((customersNow / customersAtStart) * 100).toFixed(2) : '0';
        const revenueRetentionRate =
          revenueAtStart > 0 ? ((revenueNow / revenueAtStart) * 100).toFixed(2) : '0';

        const churnedCustomers = cohortCustomers.filter(
          (c) => c.status === 'churned' || c.status === 'trial_churned',
        );
        const churnRate =
          customersAtStart > 0
            ? ((churnedCustomers.length / customersAtStart) * 100).toFixed(2)
            : '0';

        const averageMRR = customersAtStart > 0 ? revenueAtStart / customersAtStart : 0;
        const avgLifetimeMonths = 24; // Placeholder
        const ltv = averageMRR * avgLifetimeMonths;

        // Drift: route inserts customersAtStart/revenueAtStart/customersNow/revenueNow/
        // revenueRetentionRate/ltv/cohortStartDate/cohortEndDate/periodType/cohortDefinition/
        // calculatedBy — none of those columns exist. Map onto the real schema:
        // cohort_name, cohort_period, cohort_date, initial_size, current_size,
        // retention_rate, initial_mrr, current_mrr, average_ltv, churn_rate,
        // net_revenue_retention.
        const insertRow = {
          cohort_name: `${cohortDefinition} ${startDate.toISOString().split('T')[0]}`,
          cohort_period: periodType,
          cohort_date: startDate.toISOString(),
          initial_size: customersAtStart,
          current_size: customersNow,
          retention_rate: retentionRate,
          initial_mrr: revenueAtStart.toFixed(2),
          current_mrr: revenueNow.toFixed(2),
          average_ltv: ltv.toFixed(2),
          churn_rate: churnRate,
          churned_count: churnedCustomers.length,
          net_revenue_retention: revenueRetentionRate,
          calculated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: cohort, error: insErr } = await (admin
          .from('platform_cohort_analysis')
          .insert(insertRow)
          .select()
          .single() as any);
        if (insErr) throw insErr;

        return createCorsResponse(
          {
            message: 'Cohort analysis generated successfully',
            cohort,
          },
          201,
          req,
        );
      } catch (error) {
        console.error('Error generating cohort analysis:', error);
        return createCorsResponse({ error: 'Failed to generate cohort analysis' }, 500, req);
      }
    }

    // ========================================================================
    // GET /revenue-metrics
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'revenue-metrics') {
      try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        const applyDates = (q: any) => {
          let query = q;
          if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
          if (endDate) query = query.lte('created_at', new Date(endDate).toISOString());
          return query;
        };

        // Active tenants
        const { data: activeData, error: activeErr } = await applyDates(
          admin
            .from('platform_business_records')
            .select('*')
            .eq('record_type', 'tenant')
            .eq('status', 'active_customer'),
        );
        if (activeErr) throw activeErr;
        const activeTenants = (activeData || []) as any[];

        const totalMRR = activeTenants.reduce((sum, t) => sum + num(t.current_mrr), 0);
        const totalARR = totalMRR * 12;
        const arpa = activeTenants.length > 0 ? totalMRR / activeTenants.length : 0;

        // Churned tenants
        const { data: churnedData, error: churnedErr } = await applyDates(
          admin
            .from('platform_business_records')
            .select('*')
            .eq('record_type', 'tenant')
            .eq('status', 'churned'),
        );
        if (churnedErr) throw churnedErr;
        const churnedTenants = (churnedData || []) as any[];

        const churnRate =
          activeTenants.length + churnedTenants.length > 0
            ? (churnedTenants.length / (activeTenants.length + churnedTenants.length)) * 100
            : 0;
        const grr = 100 - churnRate;

        // Drift: route reads platformBusinessRecords.lastMRRChange — no such column
        // exists (no last_mrr_change). Expansion can't be derived; default to 0.
        const expandedTenants = activeTenants.filter((t) => num(t.last_mrr_change) > 0);
        const expansionMRR = expandedTenants.reduce((sum, t) => sum + num(t.last_mrr_change), 0);
        const expansionRate = totalMRR > 0 ? (expansionMRR / totalMRR) * 100 : 0;

        const nrr = grr + expansionRate;

        const avgLifetimeMonths = churnRate > 0 ? 1 / (churnRate / 100) : 24;
        const ltv = arpa * avgLifetimeMonths;
        const estimatedCAC = ltv / 3;
        const ltvCacRatio = estimatedCAC > 0 ? ltv / estimatedCAC : 0;

        // New customers (all tenant records in range)
        const { data: newData, error: newErr } = await applyDates(
          admin.from('platform_business_records').select('*').eq('record_type', 'tenant'),
        );
        if (newErr) throw newErr;
        const newCustomers = (newData || []) as any[];

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
              churnedTenants: churnedTenants.length,
              newCustomers: newCustomers.length,
              expandedTenants: expandedTenants.length,
            },
            dateRange: {
              start: startDate || 'all',
              end: endDate || 'all',
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error calculating revenue metrics:', error);
        return createCorsResponse({ error: 'Failed to calculate revenue metrics' }, 500, req);
      }
    }

    // ========================================================================
    // GET /conversion-funnel
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'conversion-funnel') {
      try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        let recordsQuery = admin.from('platform_business_records').select('*') as any;
        if (startDate)
          recordsQuery = recordsQuery.gte('created_at', new Date(startDate).toISOString());
        if (endDate) recordsQuery = recordsQuery.lte('created_at', new Date(endDate).toISOString());

        const { data: recordsData, error: recErr } = await recordsQuery;
        if (recErr) throw recErr;
        const allRecords = (recordsData || []) as any[];

        const statusCounts = {
          new: 0,
          contacted: 0,
          qualified: 0,
          trial_active: 0,
          trial_converted: 0,
          active_customer: 0,
          churned: 0,
          lost: 0,
        };

        allRecords.forEach((record) => {
          const status = record.status;
          if (status && status in statusCounts) {
            statusCounts[status as keyof typeof statusCounts]++;
          }
        });

        const totalProspects = allRecords.filter((r) => r.record_type === 'prospect').length;
        const totalTenants = allRecords.filter((r) => r.record_type === 'tenant').length;

        const contactedRate =
          totalProspects > 0 ? (statusCounts.contacted / totalProspects) * 100 : 0;
        const qualifiedRate =
          totalProspects > 0 ? (statusCounts.qualified / totalProspects) * 100 : 0;
        const trialRate =
          totalProspects > 0 ? (statusCounts.trial_active / totalProspects) * 100 : 0;
        const conversionRate = totalProspects > 0 ? (totalTenants / totalProspects) * 100 : 0;

        // Deals over the same date range
        let dealsQuery = admin.from('platform_deals').select('*') as any;
        if (startDate) dealsQuery = dealsQuery.gte('created_at', new Date(startDate).toISOString());
        if (endDate) dealsQuery = dealsQuery.lte('created_at', new Date(endDate).toISOString());

        const { data: dealsData, error: dealsErr } = await dealsQuery;
        if (dealsErr) throw dealsErr;
        const deals = (dealsData || []) as any[];

        const dealsByStage = deals.reduce(
          (acc, deal) => {
            const stage = deal.stage || 'prospecting';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

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
            dateRange: {
              start: startDate || 'all',
              end: endDate || 'all',
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error calculating conversion funnel:', error);
        return createCorsResponse({ error: 'Failed to calculate conversion funnel' }, 500, req);
      }
    }

    // ========================================================================
    // GET /sales-performance
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'sales-performance') {
      try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const repId = url.searchParams.get('repId');

        // Drift: route filters/reads reportDate, repId, repName, callsLogged, emailsSent,
        // totalActivities, leadsGenerated, opportunitiesCreated, revenueGenerated — none
        // exist. Real columns: period_start (date), user_id (rep), total_calls,
        // total_emails, meetings_held, demos_completed, deals_won, total_arr_booked.
        // leads_generated / opportunities_created / total_activities have no source -> 0.
        let query = admin
          .from('platform_activity_reports')
          .select('*')
          .order('period_start', { ascending: false }) as any;
        if (startDate) query = query.gte('period_start', new Date(startDate).toISOString());
        if (endDate) query = query.lte('period_start', new Date(endDate).toISOString());
        if (repId) query = query.eq('user_id', repId);

        const { data: reportsData, error: repErr } = await query;
        if (repErr) throw repErr;
        const reports = (reportsData || []) as any[];

        const repMetrics = reports.reduce(
          (acc, report) => {
            const rep = report.user_id || 'unassigned';
            if (!acc[rep]) {
              acc[rep] = {
                repId: rep,
                repName: report.user_id || 'Unassigned',
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

            acc[rep].totalCalls += num(report.total_calls);
            acc[rep].totalEmails += num(report.total_emails);
            acc[rep].totalMeetings += num(report.meetings_held);
            acc[rep].totalDemos += num(report.demos_completed);
            acc[rep].totalActivities += num(report.total_calls) + num(report.total_emails);
            acc[rep].leadsGenerated += num(report.new_prospects);
            acc[rep].opportunitiesCreated += num(report.new_deals);
            acc[rep].dealsWon += num(report.deals_won);
            acc[rep].revenueGenerated += num(report.total_arr_booked);

            return acc;
          },
          {} as Record<string, any>,
        );

        Object.values(repMetrics).forEach((metrics: any) => {
          metrics.avgDealSize =
            metrics.dealsWon > 0 ? metrics.revenueGenerated / metrics.dealsWon : 0;
          metrics.conversionRate =
            metrics.leadsGenerated > 0 ? (metrics.dealsWon / metrics.leadsGenerated) * 100 : 0;
        });

        const sortedReps = Object.values(repMetrics).sort(
          (a: any, b: any) => b.revenueGenerated - a.revenueGenerated,
        );

        const teamTotals = {
          totalCalls: sortedReps.reduce((sum: number, r: any) => sum + r.totalCalls, 0),
          totalEmails: sortedReps.reduce((sum: number, r: any) => sum + r.totalEmails, 0),
          totalMeetings: sortedReps.reduce((sum: number, r: any) => sum + r.totalMeetings, 0),
          totalDemos: sortedReps.reduce((sum: number, r: any) => sum + r.totalDemos, 0),
          totalActivities: sortedReps.reduce((sum: number, r: any) => sum + r.totalActivities, 0),
          leadsGenerated: sortedReps.reduce((sum: number, r: any) => sum + r.leadsGenerated, 0),
          opportunitiesCreated: sortedReps.reduce(
            (sum: number, r: any) => sum + r.opportunitiesCreated,
            0,
          ),
          dealsWon: sortedReps.reduce((sum: number, r: any) => sum + r.dealsWon, 0),
          revenueGenerated: sortedReps.reduce((sum: number, r: any) => sum + r.revenueGenerated, 0),
        };

        return createCorsResponse(
          {
            repPerformance: sortedReps,
            teamTotals,
            dateRange: {
              start: startDate || 'all',
              end: endDate || 'all',
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error calculating sales performance:', error);
        return createCorsResponse({ error: 'Failed to calculate sales performance' }, 500, req);
      }
    }

    // ========================================================================
    // GET /pipeline-forecast
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'pipeline-forecast') {
      try {
        const months = url.searchParams.get('months') || '3';

        const { data: dealsData, error: dealsErr } = await (admin
          .from('platform_deals')
          .select('*')
          .in('stage', ['prospecting', 'qualification', 'proposal', 'negotiation']) as any);
        if (dealsErr) throw dealsErr;
        const openDeals = (dealsData || []) as any[];

        const forecastByMonth: Record<string, any> = {};

        openDeals.forEach((deal) => {
          const closeDate = deal.expected_close_date
            ? new Date(deal.expected_close_date)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(
            2,
            '0',
          )}`;

          if (!forecastByMonth[monthKey]) {
            forecastByMonth[monthKey] = {
              month: monthKey,
              totalPipeline: 0,
              weightedPipeline: 0,
              dealCount: 0,
              deals: [],
            };
          }

          const dealValue = num(deal.deal_value);
          const probability = num(deal.probability);
          const weightedValue = (dealValue * probability) / 100;

          forecastByMonth[monthKey].totalPipeline += dealValue;
          forecastByMonth[monthKey].weightedPipeline += weightedValue;
          forecastByMonth[monthKey].dealCount += 1;
          forecastByMonth[monthKey].deals.push({
            id: deal.id,
            dealName: deal.deal_name,
            dealValue,
            probability,
            weightedValue,
            stage: deal.stage,
          });
        });

        const sortedForecast = Object.values(forecastByMonth).sort((a: any, b: any) =>
          a.month.localeCompare(b.month),
        );

        const totals = {
          totalPipeline: sortedForecast.reduce((sum: number, f: any) => sum + f.totalPipeline, 0),
          weightedPipeline: sortedForecast.reduce(
            (sum: number, f: any) => sum + f.weightedPipeline,
            0,
          ),
          totalDeals: sortedForecast.reduce((sum: number, f: any) => sum + f.dealCount, 0),
        };

        return createCorsResponse(
          {
            forecast: sortedForecast.slice(0, parseInt(months)),
            totals,
            forecastPeriod: `${months} months`,
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error calculating pipeline forecast:', error);
        return createCorsResponse({ error: 'Failed to calculate pipeline forecast' }, 500, req);
      }
    }

    // ========================================================================
    // GET /churn-analysis
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'churn-analysis') {
      try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        let query = admin
          .from('platform_churn_predictions')
          .select('*')
          .order('predicted_at', { ascending: false })
          .limit(1000) as any;
        if (startDate) query = query.gte('predicted_at', new Date(startDate).toISOString());
        if (endDate) query = query.lte('predicted_at', new Date(endDate).toISOString());

        const { data: predData, error: predErr } = await query;
        if (predErr) throw predErr;
        const predictions = (predData || []) as any[];

        // Drift: route groups by churnRiskLevel and reads estimatedRevenueImpact — real
        // columns are churn_risk and estimated_arr.
        const byRiskLevel = predictions.reduce(
          (acc, pred) => {
            const risk = pred.churn_risk || 'unknown';
            if (!acc[risk]) {
              acc[risk] = { count: 0, totalProbability: 0, totalRevenue: 0 };
            }
            acc[risk].count += 1;
            acc[risk].totalProbability += num(pred.churn_probability);
            acc[risk].totalRevenue += num(pred.estimated_arr);
            return acc;
          },
          {} as Record<string, any>,
        );

        Object.values(byRiskLevel).forEach((level: any) => {
          level.avgProbability = level.count > 0 ? level.totalProbability / level.count : 0;
          level.avgRevenueImpact = level.count > 0 ? level.totalRevenue / level.count : 0;
        });

        // Actual churned tenants in range (by churned_at).
        let churnQuery = admin
          .from('platform_business_records')
          .select('*')
          .eq('status', 'churned') as any;
        if (startDate) churnQuery = churnQuery.gte('churned_at', new Date(startDate).toISOString());
        if (endDate) churnQuery = churnQuery.lte('churned_at', new Date(endDate).toISOString());

        const { data: churnedData, error: churnedErr } = await churnQuery;
        if (churnedErr) throw churnedErr;
        const churnedTenants = (churnedData || []) as any[];

        const churnedRevenue = churnedTenants.reduce((sum, t) => sum + num(t.current_mrr), 0) * 12;

        return createCorsResponse(
          {
            predictions: {
              total: predictions.length,
              byRiskLevel,
              highRiskCount: byRiskLevel.high?.count || 0,
              mediumRiskCount: byRiskLevel.medium?.count || 0,
              lowRiskCount: byRiskLevel.low?.count || 0,
            },
            actual: {
              churnedCount: churnedTenants.length,
              churnedRevenue: churnedRevenue.toFixed(2),
            },
            dateRange: {
              start: startDate || 'all',
              end: endDate || 'all',
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error analyzing churn:', error);
        return createCorsResponse({ error: 'Failed to analyze churn' }, 500, req);
      }
    }

    // ========================================================================
    // GET /activity-trends
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'activity-trends') {
      try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const groupBy = url.searchParams.get('groupBy') || 'day';

        let query = admin
          .from('platform_activities')
          .select('*')
          .order('activity_date', { ascending: false }) as any;
        if (startDate) query = query.gte('activity_date', new Date(startDate).toISOString());
        if (endDate) query = query.lte('activity_date', new Date(endDate).toISOString());

        const { data: actData, error: actErr } = await query;
        if (actErr) throw actErr;
        const activities = (actData || []) as any[];

        const trends: Record<string, any> = {};

        activities.forEach((activity) => {
          const date = new Date(activity.activity_date);
          let dateKey: string;

          if (groupBy === 'day') {
            dateKey = date.toISOString().split('T')[0];
          } else if (groupBy === 'week') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            dateKey = weekStart.toISOString().split('T')[0];
          } else if (groupBy === 'month') {
            dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          } else {
            dateKey = date.toISOString().split('T')[0];
          }

          if (!trends[dateKey]) {
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
          }

          const activityType = activity.activity_type || 'note';
          trends[dateKey][activityType] = (trends[dateKey][activityType] || 0) + 1;
          trends[dateKey].total += 1;
        });

        const sortedTrends = Object.values(trends).sort((a: any, b: any) =>
          a.date.localeCompare(b.date),
        );

        const totals = {
          call: activities.filter((a) => a.activity_type === 'call').length,
          email: activities.filter((a) => a.activity_type === 'email').length,
          meeting: activities.filter((a) => a.activity_type === 'meeting').length,
          demo: activities.filter((a) => a.activity_type === 'demo').length,
          proposal: activities.filter((a) => a.activity_type === 'proposal').length,
          task: activities.filter((a) => a.activity_type === 'task').length,
          note: activities.filter((a) => a.activity_type === 'note').length,
          total: activities.length,
        };

        return createCorsResponse(
          {
            trends: sortedTrends,
            totals,
            groupBy,
            dateRange: {
              start: startDate || 'all',
              end: endDate || 'all',
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error calculating activity trends:', error);
        return createCorsResponse({ error: 'Failed to calculate activity trends' }, 500, req);
      }
    }

    // ========================================================================
    // GET /goals-tracking
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'goals-tracking') {
      try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const repId = url.searchParams.get('repId');

        // Drift: route filters platformSalesGoals.repId/periodStart/periodEnd and reads
        // revenueTarget/actualRevenue/dealsTarget/actualDeals/activitiesTarget/
        // actualActivities — none exist. Real columns: assigned_to_user_id, start_date,
        // end_date, target_value, current_value, goal_type. Per-metric breakdown can't be
        // recovered, so revenue attainment is derived from target_value/current_value and
        // the deals/activities buckets default to 0.
        let query = admin
          .from('platform_sales_goals')
          .select('*')
          .order('start_date', { ascending: false }) as any;
        if (repId) query = query.eq('assigned_to_user_id', repId);
        if (startDate) query = query.gte('start_date', new Date(startDate).toISOString());
        if (endDate) query = query.lte('end_date', new Date(endDate).toISOString());

        const { data: goalsData, error: goalsErr } = await query;
        if (goalsErr) throw goalsErr;
        const goals = (goalsData || []) as any[];

        const goalsWithAttainment = goals.map((goal) => {
          const targetValue = num(goal.target_value);
          const currentValue = num(goal.current_value);

          const revenueAttainment = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
          const dealsAttainment = 0;
          const activitiesAttainment = 0;

          const overallAttainment =
            (revenueAttainment + dealsAttainment + activitiesAttainment) / 3;

          return {
            ...goal,
            attainment: {
              revenue: revenueAttainment.toFixed(2),
              deals: dealsAttainment.toFixed(2),
              activities: activitiesAttainment.toFixed(2),
              overall: overallAttainment.toFixed(2),
            },
            gaps: {
              revenue: (targetValue - currentValue).toFixed(2),
              deals: 0,
              activities: 0,
            },
          };
        });

        const teamSummary = {
          totalRevenueTarget: goals.reduce((sum, g) => sum + num(g.target_value), 0),
          totalRevenueActual: goals.reduce((sum, g) => sum + num(g.current_value), 0),
          totalDealsTarget: 0,
          totalDealsActual: 0,
          goalsOnTrack: goalsWithAttainment.filter(
            (g: any) => parseFloat(g.attainment.overall) >= 90,
          ).length,
          goalsAtRisk: goalsWithAttainment.filter((g: any) => parseFloat(g.attainment.overall) < 70)
            .length,
        };

        return createCorsResponse(
          {
            goals: goalsWithAttainment,
            teamSummary,
            dateRange: {
              start: startDate || 'all',
              end: endDate || 'all',
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error tracking goals:', error);
        return createCorsResponse({ error: 'Failed to track goals' }, 500, req);
      }
    }

    // ========================================================================
    // GET /conversion-metrics
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'conversion-metrics') {
      try {
        const timeframe = url.searchParams.get('timeframe') || '30d';
        const { startDate, endDate } = getDateRangeFromTimeframe(timeframe);

        let recordsQuery = admin.from('platform_business_records').select('*') as any;
        if (startDate) recordsQuery = recordsQuery.gte('created_at', startDate.toISOString());
        if (endDate) recordsQuery = recordsQuery.lte('created_at', endDate.toISOString());

        const { data: recordsData, error: recErr } = await recordsQuery;
        if (recErr) throw recErr;
        const allRecords = (recordsData || []) as any[];

        const statusCounts = {
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

        allRecords.forEach((record) => {
          const status = record.status;
          if (status && status in statusCounts) {
            statusCounts[status as keyof typeof statusCounts]++;
          }
        });

        const totalProspects = allRecords.filter((r) => r.record_type === 'prospect').length;
        const totalTenants = allRecords.filter((r) => r.record_type === 'tenant').length;
        const totalConverted = statusCounts.active_customer + statusCounts.trial_converted;

        const totalStart = Math.max(
          statusCounts.new +
            statusCounts.contacted +
            statusCounts.qualified +
            statusCounts.proposal_sent +
            statusCounts.negotiation +
            totalConverted,
          1,
        );

        const funnelStages = [
          { stage: 'Prospects', count: totalStart },
          {
            stage: 'Contacted',
            count:
              statusCounts.contacted +
              statusCounts.qualified +
              statusCounts.proposal_sent +
              statusCounts.negotiation +
              totalConverted,
          },
          {
            stage: 'Qualified',
            count:
              statusCounts.qualified +
              statusCounts.proposal_sent +
              statusCounts.negotiation +
              totalConverted,
          },
          {
            stage: 'Proposal Sent',
            count: statusCounts.proposal_sent + statusCounts.negotiation + totalConverted,
          },
          { stage: 'Negotiation', count: statusCounts.negotiation + totalConverted },
          { stage: 'Won', count: totalConverted },
        ];

        const funnelData = funnelStages.map((s) => ({
          stage: s.stage,
          count: s.count,
          percentage: totalStart > 0 ? parseFloat(((s.count / totalStart) * 100).toFixed(1)) : 0,
        }));

        const leadConversionRate =
          totalProspects > 0 ? parseFloat(((totalConverted / totalProspects) * 100).toFixed(2)) : 0;

        let dealsQuery = admin.from('platform_deals').select('*') as any;
        if (startDate) dealsQuery = dealsQuery.gte('created_at', startDate.toISOString());
        if (endDate) dealsQuery = dealsQuery.lte('created_at', endDate.toISOString());

        const { data: dealsData, error: dealsErr } = await dealsQuery;
        if (dealsErr) throw dealsErr;
        const deals = (dealsData || []) as any[];

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
      } catch (error) {
        console.error('Error calculating conversion metrics:', error);
        return createCorsResponse({ error: 'Failed to calculate conversion metrics' }, 500, req);
      }
    }

    // ========================================================================
    // GET /pipeline-metrics
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'pipeline-metrics') {
      try {
        const timeframe = url.searchParams.get('timeframe') || '30d';
        const { startDate, endDate } = getDateRangeFromTimeframe(timeframe);

        let dealsQuery = admin.from('platform_deals').select('*') as any;
        if (startDate) dealsQuery = dealsQuery.gte('created_at', startDate.toISOString());
        if (endDate) dealsQuery = dealsQuery.lte('created_at', endDate.toISOString());

        const { data: dealsData, error: dealsErr } = await dealsQuery;
        if (dealsErr) throw dealsErr;
        const allDeals = (dealsData || []) as any[];

        const openStages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closing'];
        const openDeals = allDeals.filter((d) => openStages.includes(d.stage || ''));

        const totalValue = openDeals.reduce((sum, d) => sum + num(d.deal_value), 0);
        const weightedValue = openDeals.reduce((sum, d) => {
          const value = num(d.deal_value);
          const prob = num(d.probability);
          return sum + (value * prob) / 100;
        }, 0);

        const closedWon = allDeals.filter((d) => d.stage === 'closed_won');
        const closedLost = allDeals.filter((d) => d.stage === 'closed_lost');
        const totalClosed = closedWon.length + closedLost.length;
        const winRate =
          totalClosed > 0 ? parseFloat(((closedWon.length / totalClosed) * 100).toFixed(1)) : 0;

        let avgSalesCycle = 0;
        if (closedWon.length > 0) {
          const totalDays = closedWon.reduce((sum, deal) => {
            const created = new Date(deal.created_at);
            const closed = deal.closed_at ? new Date(deal.closed_at) : new Date();
            const diffMs = closed.getTime() - created.getTime();
            return sum + Math.max(diffMs / (1000 * 60 * 60 * 24), 1);
          }, 0);
          avgSalesCycle = Math.round(totalDays / closedWon.length);
        }

        const wonRevenue = closedWon.reduce((sum, d) => sum + num(d.deal_value), 0);
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
            const stageDeals = openDeals.filter((d) => d.stage === stage);
            return {
              name: stageLabels[stage] || stage,
              value: stageDeals.length,
              color: stageColors[stage] || '#6b7280',
              totalValue: stageDeals.reduce((sum, d) => sum + num(d.deal_value), 0),
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
      } catch (error) {
        console.error('Error calculating pipeline metrics:', error);
        return createCorsResponse({ error: 'Failed to calculate pipeline metrics' }, 500, req);
      }
    }

    // ========================================================================
    // GET /performance-metrics
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'performance-metrics') {
      try {
        const timeframe = url.searchParams.get('timeframe') || '30d';
        const { startDate, endDate } = getDateRangeFromTimeframe(timeframe);

        let recordsQuery = admin.from('platform_business_records').select('*') as any;
        if (startDate) recordsQuery = recordsQuery.gte('created_at', startDate.toISOString());
        if (endDate) recordsQuery = recordsQuery.lte('created_at', endDate.toISOString());

        const { data: recordsData, error: recErr } = await recordsQuery;
        if (recErr) throw recErr;
        const allRecords = (recordsData || []) as any[];

        const sourceMap: Record<string, { leads: number; conversions: number }> = {};
        allRecords.forEach((record) => {
          const source = record.lead_source || 'Other';
          if (!sourceMap[source]) {
            sourceMap[source] = { leads: 0, conversions: 0 };
          }
          sourceMap[source].leads += 1;
          if (record.status === 'active_customer' || record.status === 'trial_converted') {
            sourceMap[source].conversions += 1;
          }
        });

        const sourceData = Object.entries(sourceMap)
          .map(([source, data]) => ({
            source,
            leads: data.leads,
            conversions: data.conversions,
            rate:
              data.leads > 0 ? parseFloat(((data.conversions / data.leads) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.leads - a.leads);

        // Activity reports for rep performance (filtered by period_start).
        let reportsQuery = admin
          .from('platform_activity_reports')
          .select('*')
          .order('period_start', { ascending: false }) as any;
        if (startDate) reportsQuery = reportsQuery.gte('period_start', startDate.toISOString());
        if (endDate) reportsQuery = reportsQuery.lte('period_start', endDate.toISOString());

        const { data: reportsData, error: repErr } = await reportsQuery;
        if (repErr) throw repErr;
        const reports = (reportsData || []) as any[];

        const repMap: Record<string, any> = {};
        reports.forEach((report) => {
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
          repMap[rep].totalCalls += num(report.total_calls);
          repMap[rep].totalEmails += num(report.total_emails);
          repMap[rep].totalMeetings += num(report.meetings_held);
          repMap[rep].totalDemos += num(report.demos_completed);
          repMap[rep].dealsWon += num(report.deals_won);
          repMap[rep].revenueGenerated += num(report.total_arr_booked);
        });

        const topPerformers = Object.values(repMap)
          .sort((a: any, b: any) => b.revenueGenerated - a.revenueGenerated)
          .slice(0, 10);

        const activityTotals = {
          calls: reports.reduce((sum, r) => sum + num(r.total_calls), 0),
          emails: reports.reduce((sum, r) => sum + num(r.total_emails), 0),
          meetings: reports.reduce((sum, r) => sum + num(r.meetings_held), 0),
          demos: reports.reduce((sum, r) => sum + num(r.demos_completed), 0),
          proposals: reports.reduce((sum, r) => sum + num(r.new_deals), 0),
        };

        const daysDiff =
          startDate && endDate
            ? Math.max(
                Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
                1,
              )
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
              totalRecords: allRecords.length,
              totalReports: reports.length,
              uniqueReps: Object.keys(repMap).length,
            },
            timeframe,
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error calculating performance metrics:', error);
        return createCorsResponse({ error: 'Failed to calculate performance metrics' }, 500, req);
      }
    }

    // ========================================================================
    // GET /growth-trends
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'growth-trends') {
      try {
        const timeframe = url.searchParams.get('timeframe') || '30d';
        const { startDate } = getDateRangeFromTimeframe(timeframe);

        let query = admin
          .from('platform_business_records')
          .select('*')
          .eq('record_type', 'tenant')
          .order('created_at', { ascending: true }) as any;
        if (startDate) query = query.gte('created_at', startDate.toISOString());

        const { data: tenantsData, error: tenErr } = await query;
        if (tenErr) throw tenErr;
        const allTenants = (tenantsData || []) as any[];

        const monthMap: Record<
          string,
          {
            newMRR: number;
            expansionMRR: number;
            churnMRR: number;
            activeTenants: number;
          }
        > = {};

        allTenants.forEach((tenant) => {
          const created = new Date(tenant.created_at);
          const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(
            2,
            '0',
          )}`;

          if (!monthMap[monthKey]) {
            monthMap[monthKey] = { newMRR: 0, expansionMRR: 0, churnMRR: 0, activeTenants: 0 };
          }

          const mrr = num(tenant.current_mrr);

          if (tenant.status === 'active_customer' || tenant.status === 'trial_active') {
            monthMap[monthKey].activeTenants += 1;
            // Drift: lastMRRChange has no real column -> mrrChange resolves to 0.
            const mrrChange = num(tenant.last_mrr_change);
            if (mrrChange > 0) {
              monthMap[monthKey].expansionMRR += mrrChange;
              monthMap[monthKey].newMRR += Math.max(mrr - mrrChange, 0);
            } else {
              monthMap[monthKey].newMRR += mrr;
            }
          } else if (tenant.status === 'churned' || tenant.status === 'trial_churned') {
            monthMap[monthKey].churnMRR += mrr;
          }
        });

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
          const label = `${monthNames[monthIndex]} ${year.slice(2)}`;

          runningMRR = runningMRR + data.newMRR + data.expansionMRR - data.churnMRR;
          runningMRR = Math.max(runningMRR, 0);

          return {
            month: label,
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
          const current = revenueData[revenueData.length - 1];
          const previous = revenueData[revenueData.length - 2];
          if (previous.mrr > 0) {
            mrrGrowth = parseFloat(
              (((current.mrr - previous.mrr) / previous.mrr) * 100).toFixed(1),
            );
            arrGrowth = parseFloat(
              (((current.arr - previous.arr) / previous.arr) * 100).toFixed(1),
            );
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
      } catch (error) {
        console.error('Error calculating growth trends:', error);
        return createCorsResponse({ error: 'Failed to calculate growth trends' }, 500, req);
      }
    }

    // ========================================================================
    // GET /health-trends
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'health-trends') {
      try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        let query = admin
          .from('platform_health_scores')
          .select('*')
          .order('calculated_at', { ascending: false }) as any;
        if (startDate) query = query.gte('calculated_at', new Date(startDate).toISOString());
        if (endDate) query = query.lte('calculated_at', new Date(endDate).toISOString());

        const { data: hsData, error: hsErr } = await query;
        if (hsErr) throw hsErr;
        const healthScores = (hsData || []) as any[];

        const byStatus = healthScores.reduce(
          (acc, score) => {
            const status = score.health_status || 'unknown';
            if (!acc[status]) {
              acc[status] = { count: 0, totalScore: 0, totalRevenue: 0 };
            }
            acc[status].count += 1;
            acc[status].totalScore += num(score.overall_score);
            return acc;
          },
          {} as Record<string, any>,
        );

        Object.values(byStatus).forEach((status: any) => {
          status.avgScore = status.count > 0 ? status.totalScore / status.count : 0;
        });

        const midpoint = Math.floor(healthScores.length / 2);
        const firstHalf = healthScores.slice(midpoint);
        const secondHalf = healthScores.slice(0, midpoint);

        const avgFirst =
          firstHalf.length > 0
            ? firstHalf.reduce((sum, s) => sum + num(s.overall_score), 0) / firstHalf.length
            : 0;
        const avgSecond =
          secondHalf.length > 0
            ? secondHalf.reduce((sum, s) => sum + num(s.overall_score), 0) / secondHalf.length
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
              total: healthScores.length,
              healthy: byStatus.healthy?.count || 0,
              at_risk: byStatus.at_risk?.count || 0,
              critical: byStatus.critical?.count || 0,
            },
            dateRange: {
              start: startDate || 'all',
              end: endDate || 'all',
            },
          },
          200,
          req,
        );
      } catch (error) {
        console.error('Error calculating health trends:', error);
        return createCorsResponse({ error: 'Failed to calculate health trends' }, 500, req);
      }
    }

    // Method/endpoint not found
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
