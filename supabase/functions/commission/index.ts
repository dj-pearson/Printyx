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

      // A hardcoded "Sales Rep Standard" plan used to be returned here on any
      // error, tiers and rates and all — 5%/6.5%/8% presented to a rep as their
      // own commission structure, with a 200 so nothing downstream could tell
      // it apart from a real plan. The rest of this file (EDGE-002h) already
      // refused to port Express's mocks; this branch predates that.
      if (error) {
        console.error('Error fetching commission plans:', error);
        return createCorsResponse({ error: 'Failed to fetch commission plans' }, 500, req);
      }

      return createCorsResponse(plans || [], 200, req);
    }

    // GET /commission/calculations - the calculations that were actually run
    //
    // This used to recompute commission from won deals at a flat "simplified -
    // 5% base rate", plus a $2,500 bonus over $100,000, and return it at 200.
    // That is a rep reading invented numbers as their own pay - the same defect
    // EDGE-002g removed from the /plans error branch and CR-017 removed from
    // routes-commission.ts, still live here and harder to spot because it read
    // real deals to get there. No plan, tier or product rate was consulted.
    //
    // POST /calculate answers 501 and says the engine that would write
    // commission_calculations has not been built. This branch now agrees with
    // it: it reads what the engine would have written, so an unbuilt engine
    // shows an empty list rather than a plausible one.
    //
    // commission_calculation_details and commission_bonuses carry NO tenant_id
    // - they hang off calculation_id - so they are fetched by the ids of the
    // already-tenant-scoped calculations rather than filtered directly.
    if (req.method === 'GET' && endpoint === 'calculations') {
      const employeeId = url.searchParams.get('employeeId');

      let query = admin
        .from('commission_calculations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('calculation_period_start', { ascending: false })
        .limit(500);
      if (employeeId) query = query.eq('employee_id', employeeId);

      const { data: calcs, error } = await query;
      if (error) {
        console.error('Error fetching commission calculations:', error);
        return createCorsResponse({ error: 'Failed to fetch commission calculations' }, 500, req);
      }
      if (!calcs || calcs.length === 0) return createCorsResponse([], 200, req);

      const ids = calcs.map((c: any) => c.id);
      const employeeIds = [...new Set(calcs.map((c: any) => c.employee_id).filter(Boolean))];
      const planIds = [...new Set(calcs.map((c: any) => c.plan_id).filter(Boolean))];

      const [detailRes, bonusRes, adjustmentRes, userRes, planRes] = await Promise.all([
        admin.from('commission_calculation_details').select('*').in('calculation_id', ids),
        admin.from('commission_bonuses').select('*').in('calculation_id', ids),
        admin
          .from('commission_adjustments')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('calculation_id', ids),
        employeeIds.length
          ? admin.from('users').select('id, first_name, last_name, role').in('id', employeeIds)
          : Promise.resolve({ data: [] }),
        planIds.length
          ? admin.from('commission_plans').select('id, plan_name').in('id', planIds)
          : Promise.resolve({ data: [] }),
      ]);

      const groupBy = (rows: any[] | null, key: string) => {
        const out = new Map<string, any[]>();
        for (const row of rows ?? []) {
          const id = row[key];
          if (!id) continue;
          if (!out.has(id)) out.set(id, []);
          out.get(id)!.push(row);
        }
        return out;
      };
      const detailsByCalc = groupBy(detailRes.data, 'calculation_id');
      const bonusesByCalc = groupBy(bonusRes.data, 'calculation_id');
      const adjustmentsByCalc = groupBy(adjustmentRes.data, 'calculation_id');

      // users has first_name/last_name, not name.
      const employeeNames = new Map<string, string>();
      const employeeRoles = new Map<string, string>();
      for (const u of (userRes.data as any[]) ?? []) {
        employeeNames.set(u.id, [u.first_name, u.last_name].filter(Boolean).join(' ').trim());
        employeeRoles.set(u.id, u.role);
      }
      const planNames = new Map<string, string>();
      for (const pl of (planRes.data as any[]) ?? []) planNames.set(pl.id, pl.plan_name);

      const calculations = calcs.map((c: any) => ({
        id: c.id,
        employeeId: c.employee_id,
        employeeName: employeeNames.get(c.employee_id) ?? null,
        // users.role is the system role (the RBAC code), not a sales title. It
        // is what exists; the page renders it as a badge, so do not read it as
        // "this person's commission role".
        employeeRole: employeeRoles.get(c.employee_id) ?? null,
        planId: c.plan_id,
        planName: planNames.get(c.plan_id) ?? null,
        calculationPeriod: {
          startDate: c.calculation_period_start,
          endDate: c.calculation_period_end,
          periodName: c.period_name,
        },
        salesMetrics: {
          totalSales: toNumber(c.total_sales),
          quotaTarget: toNumber(c.quota_target),
          quotaAchievement: toNumber(c.quota_achievement),
        },
        commissionDetails: (detailsByCalc.get(c.id) ?? []).map((d: any) => ({
          category: d.category_name ?? d.category,
          salesAmount: toNumber(d.sales_amount),
          commissionRate: toNumber(d.commission_rate),
          commissionAmount: toNumber(d.commission_amount),
          description: d.description ?? null,
        })),
        bonuses: (bonusesByCalc.get(c.id) ?? []).map((b: any) => ({
          type: b.bonus_type,
          description: b.description,
          amount: toNumber(b.amount),
          eligibilityMet: b.eligibility_met === true,
        })),
        adjustments: (adjustmentsByCalc.get(c.id) ?? []).map((a: any) => ({
          type: a.adjustment_type,
          description: a.description ?? a.reason,
          amount: toNumber(a.amount),
          reason: a.reason,
        })),
        summary: {
          grossCommission: toNumber(c.gross_commission),
          totalBonuses: toNumber(c.total_bonuses),
          totalAdjustments: toNumber(c.total_adjustments),
          netCommission: toNumber(c.net_commission),
          payoutDate: c.payout_date,
          status: c.status,
        },
        calculatedAt: c.calculated_at,
      }));

      return createCorsResponse(calculations, 200, req);
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
