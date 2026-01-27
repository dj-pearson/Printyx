// Reports Edge Function
// Handles various reports and analytics queries
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const reportType = pathParts[1];
    const period = url.searchParams.get('period') || 'month';

    // Calculate date ranges
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // GET /reports/executive-summary
    if (req.method === 'GET' && reportType === 'executive-summary') {
      const [customers, quotes, tickets, revenue] = await Promise.all([
        admin
          .from('business_records')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('record_type', 'customer'),
        admin
          .from('quotes')
          .select('id, status, total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('service_tickets')
          .select('id, status')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('quotes')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .eq('status', 'accepted')
          .gte('accepted_date', startDate.toISOString()),
      ]);

      const totalRevenue =
        revenue.data?.reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0) || 0;
      const activeQuotes = quotes.data?.filter((q) => q.status === 'sent').length || 0;
      const wonQuotes = quotes.data?.filter((q) => q.status === 'accepted').length || 0;
      const openTickets =
        tickets.data?.filter((t) => ['open', 'assigned', 'in-progress'].includes(t.status))
          .length || 0;

      return createCorsResponse(
        {
          period,
          metrics: {
            totalCustomers: customers.count || 0,
            totalQuotes: quotes.data?.length || 0,
            activeQuotes,
            wonQuotes,
            totalRevenue,
            openTickets,
            totalTickets: tickets.data?.length || 0,
          },
        },
        200,
        req,
      );
    }

    // GET /reports/kpi-scorecards
    if (req.method === 'GET' && reportType === 'kpi-scorecards') {
      const [quotes, tickets, customers] = await Promise.all([
        admin
          .from('quotes')
          .select('status, total_amount, created_at, sent_date, accepted_date')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('service_tickets')
          .select('status, created_at, resolved_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('business_records')
          .select('record_type, status, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
      ]);

      const totalQuotes = quotes.data?.length || 0;
      const wonQuotes = quotes.data?.filter((q) => q.status === 'accepted').length || 0;
      const winRate = totalQuotes > 0 ? (wonQuotes / totalQuotes) * 100 : 0;

      const resolvedTickets = tickets.data?.filter((t) => t.status === 'completed').length || 0;
      const avgResolutionTime =
        tickets.data
          ?.filter((t) => t.resolved_at)
          .reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const resolved = new Date(t.resolved_at!).getTime();
            return sum + (resolved - created);
          }, 0) / (resolvedTickets || 1);

      const newCustomers = customers.data?.filter((c) => c.record_type === 'customer').length || 0;
      const newLeads = customers.data?.filter((c) => c.record_type === 'lead').length || 0;

      return createCorsResponse(
        {
          period,
          kpis: {
            sales: {
              winRate: Math.round(winRate),
              totalQuotes,
              wonQuotes,
              avgDealSize:
                wonQuotes > 0
                  ? quotes.data
                      ?.filter((q) => q.status === 'accepted')
                      .reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0)! / wonQuotes
                  : 0,
            },
            service: {
              totalTickets: tickets.data?.length || 0,
              resolvedTickets,
              avgResolutionHours: Math.round(avgResolutionTime / (1000 * 60 * 60)),
              openTickets:
                tickets.data?.filter((t) => ['open', 'assigned', 'in-progress'].includes(t.status))
                  .length || 0,
            },
            customers: {
              newCustomers,
              newLeads,
              conversionRate: newLeads > 0 ? Math.round((newCustomers / newLeads) * 100) : 0,
            },
          },
        },
        200,
        req,
      );
    }

    // GET /reports/business-insights
    if (req.method === 'GET' && reportType === 'business-insights') {
      const [topCustomers, productPerformance, territoryStats] = await Promise.all([
        admin
          .from('quotes')
          .select(
            'customer_id, total_amount, customer:business_records!quotes_customer_id_fkey(company_name)',
          )
          .eq('tenant_id', tenantId)
          .eq('status', 'accepted')
          .gte('accepted_date', startDate.toISOString()),
        admin
          .from('quote_line_items')
          .select('description, quantity, total_price')
          .eq('tenant_id', tenantId),
        admin
          .from('business_records')
          .select('territory, status')
          .eq('tenant_id', tenantId)
          .eq('record_type', 'customer'),
      ]);

      // Aggregate by customer
      const customerRevenue = new Map<string, { name: string; revenue: number }>();
      topCustomers.data?.forEach((q) => {
        const customerId = q.customer_id || 'unknown';
        const existing = customerRevenue.get(customerId) || {
          name: (q.customer as any)?.company_name || 'Unknown',
          revenue: 0,
        };
        existing.revenue += parseFloat(q.total_amount || '0');
        customerRevenue.set(customerId, existing);
      });

      const top5Customers = Array.from(customerRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Territory distribution
      const territories = new Map<string, number>();
      territoryStats.data?.forEach((c) => {
        const territory = c.territory || 'Unassigned';
        territories.set(territory, (territories.get(territory) || 0) + 1);
      });

      return createCorsResponse(
        {
          topCustomers: top5Customers,
          territoryDistribution: Array.from(territories.entries()).map(([name, count]) => ({
            name,
            count,
          })),
          totalProducts: productPerformance.data?.length || 0,
        },
        200,
        req,
      );
    }

    // GET /reports/competitive-metrics
    if (req.method === 'GET' && reportType === 'competitive-metrics') {
      const [quotes, tickets] = await Promise.all([
        admin
          .from('quotes')
          .select('status, created_at, sent_date, accepted_date')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
        admin
          .from('service_tickets')
          .select('created_at, resolved_at, status')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString()),
      ]);

      const avgQuoteResponseTime =
        quotes.data
          ?.filter((q) => q.sent_date)
          .reduce((sum, q) => {
            const created = new Date(q.created_at).getTime();
            const sent = new Date(q.sent_date!).getTime();
            return sum + (sent - created);
          }, 0) / (quotes.data?.filter((q) => q.sent_date).length || 1);

      const avgTicketResolution =
        tickets.data
          ?.filter((t) => t.resolved_at)
          .reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const resolved = new Date(t.resolved_at!).getTime();
            return sum + (resolved - created);
          }, 0) / (tickets.data?.filter((t) => t.resolved_at).length || 1);

      return createCorsResponse(
        {
          metrics: {
            avgQuoteResponseHours: Math.round(avgQuoteResponseTime / (1000 * 60 * 60)),
            avgTicketResolutionHours: Math.round(avgTicketResolution / (1000 * 60 * 60)),
            quoteWinRate:
              quotes.data?.length > 0
                ? Math.round(
                    (quotes.data?.filter((q) => q.status === 'accepted').length /
                      quotes.data.length) *
                      100,
                  )
                : 0,
            firstTimeFixRate:
              tickets.data?.length > 0
                ? Math.round(
                    (tickets.data?.filter((t) => t.status === 'completed').length /
                      tickets.data.length) *
                      100,
                  )
                : 0,
          },
        },
        200,
        req,
      );
    }

    // GET /reports/territory-performance
    if (req.method === 'GET' && reportType === 'territory-performance') {
      const [territories, quotes, customers] = await Promise.all([
        admin
          .from('sales_territories')
          .select('id, territory_name, owner_id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        admin
          .from('quotes')
          .select('total_amount, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'accepted')
          .gte('accepted_date', startDate.toISOString()),
        admin
          .from('business_records')
          .select('territory')
          .eq('tenant_id', tenantId)
          .eq('record_type', 'customer'),
      ]);

      const territoryPerformance = territories.data?.map((t) => {
        const customersInTerritory =
          customers.data?.filter((c) => c.territory === t.territory_name).length || 0;
        return {
          territoryId: t.id,
          territoryName: t.territory_name,
          customerCount: customersInTerritory,
          revenue: 0, // Would need to join with customer quotes
        };
      });

      return createCorsResponse(
        {
          period,
          territories: territoryPerformance || [],
        },
        200,
        req,
      );
    }

    // GET /reports/revenue-attribution
    if (req.method === 'GET' && reportType === 'revenue-attribution') {
      const quotes = await admin
        .from('quotes')
        .select(
          'total_amount, status, created_by, created_by_user:users!quotes_created_by_fkey(first_name, last_name)',
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'accepted')
        .gte('accepted_date', startDate.toISOString());

      const revenueByRep = new Map<string, { name: string; revenue: number; deals: number }>();
      quotes.data?.forEach((q) => {
        const repId = q.created_by || 'unknown';
        const repName = q.created_by_user
          ? `${(q.created_by_user as any).first_name} ${(q.created_by_user as any).last_name}`
          : 'Unknown';
        const existing = revenueByRep.get(repId) || { name: repName, revenue: 0, deals: 0 };
        existing.revenue += parseFloat(q.total_amount || '0');
        existing.deals += 1;
        revenueByRep.set(repId, existing);
      });

      const attribution = Array.from(revenueByRep.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return createCorsResponse(
        {
          period,
          attribution,
          totalRevenue: attribution.reduce((sum, a) => sum + a.revenue, 0),
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Report type not found' }, 404, req);
  } catch (error) {
    console.error('Error in reports function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
