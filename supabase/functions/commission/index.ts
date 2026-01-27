// Commission Edge Function
// Handles commission plans and calculations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1];
    const resourceId = pathParts[2];

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
