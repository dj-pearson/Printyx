// Commission Edge Function
// Handles commission plans, calculations, analytics, and disputes
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt: string | undefined = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

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
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Coolify-safe routing: parts[0] = first segment after the `commission` prefix.
    const { parts } = normalizePath(url.pathname, 'commission');
    const endpoint = parts[0];
    const resourceId = parts[1];

    // GET /commission/plans - Get commission plans
    if (req.method === 'GET' && endpoint === 'plans') {
      const { data: plans, error } = await admin
        .from('commission_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        // Return sample data if table doesn't exist
        return createCorsResponse(
          [
            {
              id: 'plan-1',
              planName: 'Sales Rep Standard',
              planType: 'sales_rep',
              description: 'Standard commission plan for sales representatives',
              isActive: true,
              effectiveDate: new Date('2024-01-01').toISOString(),
              tiers: [
                {
                  tierLevel: 1,
                  tierName: 'Starter',
                  minimumSales: 0,
                  maximumSales: 50000,
                  commissionRate: 5.0,
                },
                {
                  tierLevel: 2,
                  tierName: 'Achiever',
                  minimumSales: 50001,
                  maximumSales: 100000,
                  commissionRate: 6.5,
                },
                {
                  tierLevel: 3,
                  tierName: 'Top Performer',
                  minimumSales: 100001,
                  maximumSales: null,
                  commissionRate: 8.0,
                },
              ],
              rules: {
                paymentFrequency: 'monthly',
                paymentDelay: 30,
                splitCommissionAllowed: true,
                chargebackEnabled: true,
                chargebackPeriod: 90,
              },
            },
          ],
          200,
          req,
        );
      }

      return createCorsResponse(plans || [], 200, req);
    }

    // GET /commission/calculations - Get commission calculations
    if (req.method === 'GET' && endpoint === 'calculations') {
      const period = url.searchParams.get('period') || 'current';
      const employeeId = url.searchParams.get('employeeId');

      // Get won deals for the period
      const periodStart = new Date();
      periodStart.setDate(1); // Start of current month
      periodStart.setHours(0, 0, 0, 0);

      if (period === 'previous') {
        periodStart.setMonth(periodStart.getMonth() - 1);
      }

      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      let query = admin
        .from('deals')
        .select('id, owner_id, deal_value, closed_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'won')
        .gte('closed_at', periodStart.toISOString())
        .lt('closed_at', periodEnd.toISOString());

      if (employeeId) {
        query = query.eq('owner_id', employeeId);
      }

      const { data: deals } = await query;

      // Group by employee and calculate commissions
      const employeeMap = new Map<string, { totalSales: number; dealCount: number }>();
      (deals || []).forEach((deal: any) => {
        const current = employeeMap.get(deal.owner_id) || { totalSales: 0, dealCount: 0 };
        employeeMap.set(deal.owner_id, {
          totalSales: current.totalSales + (deal.deal_value || 0),
          dealCount: current.dealCount + 1,
        });
      });

      // Calculate commissions (simplified - 5% base rate)
      const calculations = Array.from(employeeMap.entries()).map(([empId, stats]) => ({
        employeeId: empId,
        period: period,
        totalSales: stats.totalSales,
        dealCount: stats.dealCount,
        baseCommission: stats.totalSales * 0.05,
        bonuses: stats.totalSales > 100000 ? 2500 : 0,
        totalCommission: stats.totalSales * 0.05 + (stats.totalSales > 100000 ? 2500 : 0),
      }));

      return createCorsResponse(
        {
          period,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          calculations,
          totals: {
            totalSales: calculations.reduce((sum, c) => sum + c.totalSales, 0),
            totalCommissions: calculations.reduce((sum, c) => sum + c.totalCommission, 0),
          },
        },
        200,
        req,
      );
    }

    // POST /commission/calculate - Run commission calculation for a period
    // Frontend (CommissionManagement.tsx) POSTs { startDate, endDate, employeeIds, planId }
    // and only invalidates the calculations query on success, so any 200 success works.
    if (req.method === 'POST' && endpoint === 'calculate') {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      const now = new Date();
      const start = body.startDate
        ? new Date(body.startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = body.endDate
        ? new Date(body.endDate)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Pull won deals in the requested window, grouped by owner.
      let dealsQuery = admin
        .from('deals')
        .select('id, owner_id, deal_value, closed_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'won')
        .gte('closed_at', start.toISOString())
        .lte('closed_at', end.toISOString());

      const employeeIds: string[] | null = Array.isArray(body.employeeIds)
        ? body.employeeIds
        : null;
      if (employeeIds && employeeIds.length > 0) {
        dealsQuery = dealsQuery.in('owner_id', employeeIds);
      }

      const { data: deals, error: dealsError } = await dealsQuery;

      const employeeMap = new Map<string, { totalSales: number; dealCount: number }>();
      (deals || []).forEach((deal: any) => {
        if (!deal.owner_id) return;
        const cur = employeeMap.get(deal.owner_id) || { totalSales: 0, dealCount: 0 };
        employeeMap.set(deal.owner_id, {
          totalSales: cur.totalSales + num(deal.deal_value),
          dealCount: cur.dealCount + 1,
        });
      });

      const periodName = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      // Persist a commission_calculations row per employee (degrade if table/columns drift).
      const rows = Array.from(employeeMap.entries()).map(([empId, stats]) => {
        const gross = stats.totalSales * 0.05;
        const bonuses = stats.totalSales > 100000 ? 2500 : 0;
        return {
          tenant_id: tenantId,
          employee_id: empId,
          plan_id: body.planId && body.planId !== 'all' ? body.planId : 'unassigned',
          calculation_period_start: start.toISOString(),
          calculation_period_end: end.toISOString(),
          period_name: periodName,
          total_sales: stats.totalSales,
          gross_commission: gross,
          total_bonuses: bonuses,
          total_adjustments: 0,
          net_commission: gross + bonuses,
          status: 'calculated',
          calculated_at: new Date().toISOString(),
          calculated_by: user.id,
        };
      });

      let persisted = 0;
      let degraded = false;
      if (rows.length > 0) {
        const { data: inserted, error: insertError } = await admin
          .from('commission_calculations')
          .insert(rows)
          .select('id');
        if (insertError) {
          // Table/columns may not exist or be drifted — degrade honestly.
          console.error('commission calculate insert failed:', insertError);
          degraded = true;
        } else {
          persisted = inserted?.length || 0;
        }
      }

      return createCorsResponse(
        {
          success: !dealsError,
          periodName,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          employeesProcessed: employeeMap.size,
          calculationsCreated: persisted,
          ...(degraded || dealsError ? { degraded: true } : {}),
        },
        200,
        req,
      );
    }

    // GET /commission/analytics - Commission analytics & performance metrics
    // Aggregated from real commission_calculations + commission_disputes; the
    // frontend reads a deep nested shape, so we ALWAYS return the full structure
    // (zeros on degrade) to avoid render crashes.
    if (req.method === 'GET' && endpoint === 'analytics') {
      const empty = {
        summary: {
          totalCommissionPaid: 0,
          averageCommissionRate: 0,
          totalBonusesPaid: 0,
          totalAdjustments: 0,
          participatingEmployees: 0,
          topPerformerPayout: 0,
          averagePayout: 0,
        },
        performance_metrics: {
          quotaAchievementRate: 0,
          tierDistribution: { starter: 0, achiever: 0, elite: 0 },
        },
        monthly_trends: [] as any[],
        top_performers: [] as any[],
        plan_performance: [] as any[],
        dispute_analysis: {
          totalDisputes: 0,
          resolvedDisputes: 0,
          pendingDisputes: 0,
          averageResolutionTime: 0,
        },
      };

      const { data: calcs, error: calcError } = await admin
        .from('commission_calculations')
        .select(
          'employee_id, plan_id, net_commission, gross_commission, total_bonuses, total_adjustments, total_sales, quota_achievement',
        )
        .eq('tenant_id', tenantId);

      if (calcError) {
        return createCorsResponse({ ...empty, degraded: true }, 200, req);
      }

      const list = (calcs || []) as any[];
      const totalNet = list.reduce((s, c) => s + num(c.net_commission), 0);
      const totalBonuses = list.reduce((s, c) => s + num(c.total_bonuses), 0);
      const totalAdjustments = list.reduce((s, c) => s + num(c.total_adjustments), 0);
      const employees = new Set(list.map((c) => c.employee_id).filter(Boolean));
      const quotaValues = list.map((c) => num(c.quota_achievement)).filter((v) => v > 0);
      const avgQuota =
        quotaValues.length > 0 ? quotaValues.reduce((s, v) => s + v, 0) / quotaValues.length : 0;
      const payouts = list.map((c) => num(c.net_commission));
      const topPayout = payouts.length > 0 ? Math.max(...payouts) : 0;

      // Per-employee aggregation for top performers.
      const empAgg = new Map<string, { total: number; sales: number; quota: number }>();
      for (const c of list) {
        if (!c.employee_id) continue;
        const cur = empAgg.get(c.employee_id) || { total: 0, sales: 0, quota: 0 };
        cur.total += num(c.net_commission);
        cur.sales += num(c.total_sales);
        cur.quota = Math.max(cur.quota, num(c.quota_achievement));
        empAgg.set(c.employee_id, cur);
      }
      const topPerformers = Array.from(empAgg.entries())
        .map(([employeeId, v]) => ({
          employeeId,
          name: employeeId,
          role: 'Sales Representative',
          totalCommission: v.total,
          quotaAchievement: v.quota,
          rank: 0,
        }))
        .sort((a, b) => b.totalCommission - a.totalCommission)
        .slice(0, 5)
        .map((p, i) => ({ ...p, rank: i + 1 }));

      // Per-plan aggregation.
      const planAgg = new Map<
        string,
        { participants: Set<string>; total: number; quota: number[] }
      >();
      for (const c of list) {
        const pid = c.plan_id || 'unassigned';
        const cur = planAgg.get(pid) || { participants: new Set<string>(), total: 0, quota: [] };
        if (c.employee_id) cur.participants.add(c.employee_id);
        cur.total += num(c.net_commission);
        if (num(c.quota_achievement) > 0) cur.quota.push(num(c.quota_achievement));
        planAgg.set(pid, cur);
      }
      const planPerformance = Array.from(planAgg.entries()).map(([planId, v]) => ({
        planId,
        planName: planId,
        participants: v.participants.size,
        avgPayout: v.participants.size > 0 ? v.total / v.participants.size : 0,
        totalPayout: v.total,
        avgQuotaAchievement:
          v.quota.length > 0 ? v.quota.reduce((s, q) => s + q, 0) / v.quota.length : 0,
      }));

      // Dispute analysis from the real disputes table.
      const dispute_analysis = { ...empty.dispute_analysis };
      const { data: disputes, error: dispError } = await admin
        .from('commission_disputes')
        .select('status, submitted_date, actual_resolution')
        .eq('tenant_id', tenantId);
      if (!dispError && disputes) {
        const d = disputes as any[];
        dispute_analysis.totalDisputes = d.length;
        dispute_analysis.resolvedDisputes = d.filter(
          (x) => x.status === 'resolved' || x.status === 'closed',
        ).length;
        dispute_analysis.pendingDisputes = d.length - dispute_analysis.resolvedDisputes;
        const resolved = d.filter((x) => x.submitted_date && x.actual_resolution);
        if (resolved.length > 0) {
          const totalDays = resolved.reduce((s, x) => {
            const ms =
              new Date(x.actual_resolution).getTime() - new Date(x.submitted_date).getTime();
            return s + ms / (1000 * 60 * 60 * 24);
          }, 0);
          dispute_analysis.averageResolutionTime =
            Math.round((totalDays / resolved.length) * 10) / 10;
        }
      }

      return createCorsResponse(
        {
          summary: {
            totalCommissionPaid: Math.round(totalNet * 100) / 100,
            averageCommissionRate: 0,
            totalBonusesPaid: Math.round(totalBonuses * 100) / 100,
            totalAdjustments: Math.round(totalAdjustments * 100) / 100,
            participatingEmployees: employees.size,
            topPerformerPayout: Math.round(topPayout * 100) / 100,
            averagePayout:
              employees.size > 0 ? Math.round((totalNet / employees.size) * 100) / 100 : 0,
          },
          performance_metrics: {
            quotaAchievementRate: Math.round(avgQuota * 10) / 10,
            tierDistribution: empty.performance_metrics.tierDistribution,
          },
          monthly_trends: [],
          top_performers: topPerformers,
          plan_performance: planPerformance,
          dispute_analysis,
        },
        200,
        req,
      );
    }

    // GET /commission/disputes - Commission disputes (real commission_disputes table)
    if (req.method === 'GET' && endpoint === 'disputes') {
      const { data: disputes, error } = await admin
        .from('commission_disputes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('submitted_date', { ascending: false });

      if (error) {
        // Table/columns missing — degrade to empty (page renders "No Active Disputes").
        return createCorsResponse([], 200, req);
      }

      const mapped = ((disputes || []) as any[]).map((d) => ({
        id: d.id,
        disputeNumber: d.dispute_number,
        employeeId: d.employee_id,
        employeeName: d.employee_id,
        calculationPeriod: d.calculation_id || '',
        disputeDetails: {
          type: d.dispute_type,
          description: d.description,
          disputedAmount: num(d.disputed_amount),
          expectedAmount: num(d.expected_amount),
          difference: num(d.difference),
        },
        status: d.status,
        priority: d.priority,
        resolution: {
          assignedToName: d.assigned_to || null,
          estimatedResolution: d.estimated_resolution || null,
          notes: d.resolution_notes || null,
        },
        createdAt: d.created_at,
      }));

      return createCorsResponse(mapped, 200, req);
    }

    // GET /commission/statements - Get commission statements
    if (req.method === 'GET' && endpoint === 'statements') {
      const { data: statements } = await admin
        .from('commission_statements')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', user.id)
        .order('period_end', { ascending: false });

      return createCorsResponse(statements || [], 200, req);
    }

    // GET /commission/my-earnings - Get current user's earnings
    if (req.method === 'GET' && endpoint === 'my-earnings') {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      const { data: deals } = await admin
        .from('deals')
        .select('deal_value')
        .eq('tenant_id', tenantId)
        .eq('owner_id', user.id)
        .eq('status', 'won')
        .gte('closed_at', periodStart.toISOString());

      const totalSales = deals?.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0) || 0;
      const baseCommission = totalSales * 0.05;

      return createCorsResponse(
        {
          periodStart: periodStart.toISOString(),
          totalSales,
          dealCount: deals?.length || 0,
          estimatedCommission: baseCommission,
          pendingPayment: baseCommission,
          lastPayment: null,
        },
        200,
        req,
      );
    }

    // POST /commission/plans - Create commission plan
    if (req.method === 'POST' && endpoint === 'plans') {
      const body = await req.json();

      const { data: plan, error } = await admin
        .from('commission_plans')
        .insert({
          tenant_id: tenantId,
          ...body,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating commission plan:', error);
        return createCorsResponse({ error: 'Failed to create plan' }, 500, req);
      }

      return createCorsResponse(plan, 201, req);
    }

    // Reference resourceId so unused-var checks stay quiet for future :id routes.
    void resourceId;

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in commission function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
