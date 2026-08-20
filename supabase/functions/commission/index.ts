// Commission Edge Function
// Handles commission plans and calculations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { toNumber } from '../_shared/quote-math.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel } from '../_shared/case.ts';

/**
 * A deal's amount as a number.
 *
 * deals.amount is numeric(12,2) and PostgREST returns numeric as a STRING, so
 * `sum + row.amount` concatenates instead of adding — a commission total of
 * "01500.002400.00" rather than 3900.
 */
function dealAmount(deal: { amount?: unknown }): number {
  return toNumber(deal?.amount);
}

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /commission, making this correct whether or not the prefix survived.
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
      let periodStart = new Date();
      periodStart.setDate(1); // Start of current month
      periodStart.setHours(0, 0, 0, 0);

      if (period === 'previous') {
        periodStart.setMonth(periodStart.getMonth() - 1);
      }

      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // COP-M01: deal_value and closed_at are not columns on `deals` — they are
      // amount and actual_close_date. PostgREST answered 42703, `deals` came back
      // undefined, and the handler returned an empty commission list rather than
      // an error, so every rep's calculated commission was silently zero.
      let query = admin
        .from('deals')
        .select('id, owner_id, amount, actual_close_date')
        .eq('tenant_id', tenantId)
        .eq('status', 'won')
        .gte('actual_close_date', periodStart.toISOString())
        .lt('actual_close_date', periodEnd.toISOString());

      if (employeeId) {
        query = query.eq('owner_id', employeeId);
      }

      const { data: deals, error: dealsError } = await query;

      if (dealsError) {
        console.error('Error loading won deals for commission calculation:', dealsError);
        return createCorsResponse(
          { error: 'Failed to calculate commissions', details: dealsError.message },
          500,
          req,
        );
      }

      // Group by employee and calculate commissions
      const employeeMap = new Map<string, { totalSales: number; dealCount: number }>();
      (deals || []).forEach((deal: any) => {
        const current = employeeMap.get(deal.owner_id) || { totalSales: 0, dealCount: 0 };
        employeeMap.set(deal.owner_id, {
          totalSales: current.totalSales + dealAmount(deal),
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
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('owner_id', user.id)
        .eq('status', 'won')
        .gte('actual_close_date', periodStart.toISOString());

      const totalSales = (deals ?? []).reduce((sum: number, d: any) => sum + dealAmount(d), 0);
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

    // ─── Disputes and analytics (EDGE-002h) ─────────────────────────────────

    // GET /commission/disputes
    //
    // Express builds this with raw SQL that cannot run: it selects u.name
    // (users has first_name/last_name, no name) and filters on cd.tenantId /
    // orders by cd.createdAt - unquoted camelCase, which Postgres folds to
    // tenantid and createdat, neither of which is a column. The table itself is
    // real, so this is a rewrite against tenant_id / created_at.
    if (req.method === 'GET' && endpoint === 'disputes' && !resourceId) {
      const { data: disputes, error } = await admin
        .from('commission_disputes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching commission disputes:', error);
        return createCorsResponse({ error: 'Failed to fetch commission disputes' }, 500, req);
      }

      const rows = disputes ?? [];
      const employeeIds = [...new Set(rows.map((d: any) => d.employee_id).filter(Boolean))];
      const calculationIds = [...new Set(rows.map((d: any) => d.calculation_id).filter(Boolean))];

      const employeeNames = new Map<string, string>();
      const periodNames = new Map<string, string>();

      if (employeeIds.length > 0) {
        const { data: users } = await admin
          .from('users')
          .select('id, first_name, last_name')
          .in('id', employeeIds);
        for (const u of users ?? []) {
          employeeNames.set(
            u.id as string,
            [u.first_name, u.last_name].filter(Boolean).join(' ').trim(),
          );
        }
      }

      if (calculationIds.length > 0) {
        const { data: calcs } = await admin
          .from('commission_calculations')
          .select('id, period_name')
          .in('id', calculationIds);
        for (const c of calcs ?? []) periodNames.set(c.id as string, c.period_name as string);
      }

      // The page reads disputeNumber, employeeName, calculationPeriod,
      // disputeDetails, priority, status, resolution and createdAt.
      return createCorsResponse(
        rows.map((d: any) => ({
          ...toCamel(d),
          employeeName: employeeNames.get(d.employee_id) ?? null,
          calculationPeriod: periodNames.get(d.calculation_id) ?? null,
          disputeDetails: d.description,
          resolution: d.resolution_notes,
        })),
        200,
        req,
      );
    }

    // POST /commission/disputes
    if (req.method === 'POST' && endpoint === 'disputes') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);

      // Express writes dispute_amount and claimed_amount; the columns are
      // disputed_amount and expected_amount, so its insert failed too.
      const disputed = body.disputedAmount ?? body.disputed_amount ?? body.dispute_amount;
      const expected = body.expectedAmount ?? body.expected_amount ?? body.claimed_amount;
      const difference =
        disputed !== undefined && expected !== undefined
          ? Number(expected) - Number(disputed)
          : null;

      const { data: dispute, error } = await admin
        .from('commission_disputes')
        .insert({
          tenant_id: tenantId,
          dispute_number: `DIS-${Date.now()}`,
          calculation_id: (body.calculationId ?? body.commission_calculation_id ?? null) as
            | string
            | null,
          employee_id: (body.employeeId ?? body.employee_id ?? null) as string | null,
          dispute_type: (body.disputeType ?? body.dispute_type ?? 'calculation') as string,
          status: 'submitted',
          priority: (body.priority ?? 'medium') as string,
          disputed_amount: disputed ?? null,
          expected_amount: expected ?? null,
          difference,
          description: (body.description ?? null) as string | null,
          submitted_date: new Date().toISOString(),
          submitted_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating commission dispute:', error);
        return createCorsResponse(
          { error: 'Failed to create dispute', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(toCamel(dispute), 201, req);
    }

    // GET /commission/analytics
    //
    // Express returns a HARDCODED MOCK here - "John Smith", 245780, fixed
    // monthly trends - and never touches the database. Porting that would have
    // moved fabricated numbers onto a second backend, so this computes the same
    // shape from commission_calculations, commission_disputes, commission_plans
    // and users, all of which carry the columns needed.
    //
    // Aggregation happens in the handler because PostgREST expresses no SUM,
    // AVG, GROUP BY or count(DISTINCT).
    if (req.method === 'GET' && endpoint === 'analytics') {
      const [calcRes, disputeRes] = await Promise.all([
        admin
          .from('commission_calculations')
          .select(
            'employee_id, plan_id, period_name, total_sales, quota_achievement, gross_commission, total_bonuses, total_adjustments, net_commission, status, calculation_period_start',
          )
          .eq('tenant_id', tenantId),
        admin
          .from('commission_disputes')
          .select('status, submitted_date, actual_resolution')
          .eq('tenant_id', tenantId),
      ]);

      const calcs = calcRes.data ?? [];
      const num = (v: unknown) => toNumber(v) || 0;

      const netTotal = calcs.reduce((sum: number, c: any) => sum + num(c.net_commission), 0);
      const grossTotal = calcs.reduce((sum: number, c: any) => sum + num(c.gross_commission), 0);
      const salesTotal = calcs.reduce((sum: number, c: any) => sum + num(c.total_sales), 0);
      const employees = new Set(calcs.map((c: any) => c.employee_id).filter(Boolean));
      const payouts = calcs.map((c: any) => num(c.net_commission));
      const quotaValues = calcs
        .map((c: any) => c.quota_achievement)
        .filter((q: unknown) => q !== null && q !== undefined)
        .map(num);

      // Per employee, per plan and per period rollups.
      const byEmployee = new Map<string, { total: number; quota: number[] }>();
      const byPlan = new Map<
        string,
        { total: number; participants: Set<string>; quota: number[] }
      >();
      const byPeriod = new Map<string, { total: number; payouts: number[]; quota: number[] }>();

      for (const c of calcs as any[]) {
        if (c.employee_id) {
          const e = byEmployee.get(c.employee_id) ?? { total: 0, quota: [] };
          e.total += num(c.net_commission);
          if (c.quota_achievement !== null && c.quota_achievement !== undefined) {
            e.quota.push(num(c.quota_achievement));
          }
          byEmployee.set(c.employee_id, e);
        }
        if (c.plan_id) {
          const pl = byPlan.get(c.plan_id) ?? { total: 0, participants: new Set(), quota: [] };
          pl.total += num(c.net_commission);
          if (c.employee_id) pl.participants.add(c.employee_id);
          if (c.quota_achievement !== null && c.quota_achievement !== undefined) {
            pl.quota.push(num(c.quota_achievement));
          }
          byPlan.set(c.plan_id, pl);
        }
        const period = c.period_name ?? 'Unknown';
        const pd = byPeriod.get(period) ?? { total: 0, payouts: [], quota: [] };
        pd.total += num(c.net_commission);
        pd.payouts.push(num(c.net_commission));
        if (c.quota_achievement !== null && c.quota_achievement !== undefined) {
          pd.quota.push(num(c.quota_achievement));
        }
        byPeriod.set(period, pd);
      }

      const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

      const employeeIds = [...byEmployee.keys()];
      const employeeNames = new Map<string, string>();
      if (employeeIds.length > 0) {
        const { data: users } = await admin
          .from('users')
          .select('id, first_name, last_name, role')
          .in('id', employeeIds);
        for (const u of users ?? []) {
          employeeNames.set(
            u.id as string,
            [u.first_name, u.last_name].filter(Boolean).join(' ').trim(),
          );
        }
      }

      const planIds = [...byPlan.keys()];
      const planNames = new Map<string, string>();
      if (planIds.length > 0) {
        const { data: plans } = await admin
          .from('commission_plans')
          .select('id, plan_name')
          .eq('tenant_id', tenantId)
          .in('id', planIds);
        for (const pl of plans ?? []) planNames.set(pl.id as string, pl.plan_name as string);
      }

      const disputes = disputeRes.data ?? [];
      const resolvedDisputes = disputes.filter((d: any) =>
        ['resolved', 'closed'].includes(String(d.status ?? '').toLowerCase()),
      );
      const resolutionDays = resolvedDisputes
        .filter((d: any) => d.submitted_date && d.actual_resolution)
        .map(
          (d: any) =>
            (new Date(d.actual_resolution).getTime() - new Date(d.submitted_date).getTime()) /
            86_400_000,
        );

      return createCorsResponse(
        {
          summary: {
            totalCommissionPaid: netTotal,
            // No rate column: derived as gross commission over total sales.
            averageCommissionRate: salesTotal > 0 ? (grossTotal / salesTotal) * 100 : 0,
            totalBonusesPaid: calcs.reduce((sum: number, c: any) => sum + num(c.total_bonuses), 0),
            totalAdjustments: calcs.reduce(
              (sum: number, c: any) => sum + num(c.total_adjustments),
              0,
            ),
            participatingEmployees: employees.size,
            topPerformerPayout: payouts.length ? Math.max(...payouts) : 0,
            averagePayout: mean(payouts),
          },
          performance_metrics: {
            quotaAchievementRate: mean(quotaValues),
            // tierDistribution is omitted: no plan tier is recorded anywhere.
          },
          monthly_trends: [...byPeriod.entries()].map(([month, v]) => ({
            month,
            totalCommissions: v.total,
            avgPayout: mean(v.payouts),
            quotaAchievement: mean(v.quota),
          })),
          top_performers: [...byEmployee.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10)
            .map(([employeeId, v], index) => ({
              employeeId,
              name: employeeNames.get(employeeId) ?? null,
              totalCommission: v.total,
              quotaAchievement: mean(v.quota),
              rank: index + 1,
            })),
          plan_performance: [...byPlan.entries()].map(([planId, v]) => ({
            planId,
            planName: planNames.get(planId) ?? null,
            participants: v.participants.size,
            avgPayout: v.participants.size ? v.total / v.participants.size : 0,
            totalPayout: v.total,
            avgQuotaAchievement: mean(v.quota),
          })),
          dispute_analysis: {
            totalDisputes: disputes.length,
            resolvedDisputes: resolvedDisputes.length,
            pendingDisputes: disputes.length - resolvedDisputes.length,
            averageResolutionTime: mean(resolutionDays),
          },
          unbacked: [
            'performance_metrics.tierDistribution: no plan tier is recorded on commission_plans or commission_calculations',
            'top_performers[].role: users.role is a system role, not the sales role this card implies',
          ],
        },
        200,
        req,
      );
    }

    // POST /commission/calculate - NOT IMPLEMENTED ANYWHERE.
    //
    // CommissionManagement.tsx calls this, and there is no handler on Express
    // either - it 404s on both backends, so this is a feature request rather
    // than a porting gap. Saying so beats a bare 404.
    //
    // The schema for it does exist: commission_plans + commission_plan_tiers
    // (tiered rates), commission_product_rates (per-product overrides),
    // employee_commission_assignments (who is on which plan) and
    // commission_sales_transactions (what to pay on), writing
    // commission_calculations. Whoever builds it has the map.
    if (req.method === 'POST' && endpoint === 'calculate') {
      return createCorsResponse(
        {
          error: 'Commission calculation is not implemented',
          code: 'COMMISSION_ENGINE_NOT_BUILT',
          details:
            'No handler exists on Express either, so this is a feature rather than a port. The ' +
            'tables it would need are commission_plans, commission_plan_tiers, ' +
            'commission_product_rates, employee_commission_assignments and ' +
            'commission_sales_transactions, writing results to commission_calculations.',
        },
        501,
        req,
      );
    }

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
