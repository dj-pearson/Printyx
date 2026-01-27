// Financial Edge Function
// Handles financial management endpoints: metrics, cash flow, revenue, expenses, forecasts, reports
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

    // Extract tenant ID from JWT metadata
    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Path structure: /financial/[resource]/[type]
    const resource = pathParts[1]; // metrics, cash-flow, revenue, expenses, forecasts, reports
    const subResource = pathParts[2]; // For reports/:type

    // Parse common query parameters
    const period = url.searchParams.get('period') || 'month';
    const startDateParam = url.searchParams.get('startDate') || url.searchParams.get('start_date');
    const endDateParam = url.searchParams.get('endDate') || url.searchParams.get('end_date');

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
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
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
          break;
        default:
          startDate.setMonth(now.getMonth() - 1);
      }
    }

    // =============================================================================
    // GET /financial/metrics - Get financial metrics (revenue, expenses, profit, cash flow)
    // =============================================================================
    if (req.method === 'GET' && resource === 'metrics') {
      const [invoicesResult, quotesResult, contractsResult] = await Promise.all([
        // Get all invoices for the period
        admin
          .from('invoices')
          .select(
            'id, total_amount, amount_paid, balance_due, invoice_status, invoice_date, invoice_type',
          )
          .eq('tenant_id', tenantId)
          .gte('invoice_date', startDate.toISOString())
          .lte('invoice_date', endDate.toISOString()),
        // Get accepted quotes (won deals) for the period
        admin
          .from('quotes')
          .select('id, total_amount, accepted_date, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'accepted')
          .gte('accepted_date', startDate.toISOString())
          .lte('accepted_date', endDate.toISOString()),
        // Get active contracts for MRR calculation
        admin
          .from('contracts')
          .select('id, monthly_base, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
      ]);

      if (invoicesResult.error) {
        console.error('Error fetching invoices:', invoicesResult.error);
        return createCorsResponse({ error: 'Failed to fetch financial metrics' }, 500, req);
      }

      const invoices = invoicesResult.data || [];
      const quotes = quotesResult.data || [];
      const contracts = contractsResult.data || [];

      // Calculate revenue metrics
      let totalRevenue = 0;
      let collectedRevenue = 0;
      let outstandingReceivables = 0;
      let overdueAmount = 0;

      for (const inv of invoices) {
        const totalAmount = parseFloat(inv.total_amount || '0');
        const amountPaid = parseFloat(inv.amount_paid || '0');
        const balanceDue = parseFloat(inv.balance_due || '0');

        totalRevenue += totalAmount;
        collectedRevenue += amountPaid;
        outstandingReceivables += balanceDue;

        if (inv.invoice_status === 'overdue') {
          overdueAmount += balanceDue;
        }
      }

      // Calculate MRR from active contracts
      const monthlyRecurringRevenue = contracts.reduce(
        (sum, c) => sum + parseFloat(c.monthly_base?.toString() || '0'),
        0,
      );

      // Calculate won deals value
      const wonDealsValue = quotes.reduce((sum, q) => sum + parseFloat(q.total_amount || '0'), 0);

      // Calculate estimated expenses (simplified - could be enhanced with actual expense tracking)
      // For now, estimate as a percentage of revenue or from contracts
      const estimatedCOGS = totalRevenue * 0.6; // 60% cost of goods sold estimate
      const estimatedOperatingExpenses = monthlyRecurringRevenue * 0.25; // 25% of MRR for operating
      const totalExpenses = estimatedCOGS + estimatedOperatingExpenses;

      // Calculate profit metrics
      const grossProfit = totalRevenue - estimatedCOGS;
      const netProfit = grossProfit - estimatedOperatingExpenses;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Cash flow metrics
      const cashInflow = collectedRevenue;
      const cashOutflow = totalExpenses * 0.9; // Assuming 90% of expenses are paid
      const netCashFlow = cashInflow - cashOutflow;

      return createCorsResponse(
        {
          period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          revenue: {
            total: Math.round(totalRevenue * 100) / 100,
            collected: Math.round(collectedRevenue * 100) / 100,
            outstanding: Math.round(outstandingReceivables * 100) / 100,
            overdue: Math.round(overdueAmount * 100) / 100,
            wonDeals: Math.round(wonDealsValue * 100) / 100,
            invoiceCount: invoices.length,
          },
          recurring: {
            mrr: Math.round(monthlyRecurringRevenue * 100) / 100,
            arr: Math.round(monthlyRecurringRevenue * 12 * 100) / 100,
            activeContracts: contracts.length,
          },
          expenses: {
            total: Math.round(totalExpenses * 100) / 100,
            cogs: Math.round(estimatedCOGS * 100) / 100,
            operating: Math.round(estimatedOperatingExpenses * 100) / 100,
          },
          profit: {
            gross: Math.round(grossProfit * 100) / 100,
            net: Math.round(netProfit * 100) / 100,
            grossMargin: Math.round(grossMargin * 100) / 100,
            netMargin: Math.round(netMargin * 100) / 100,
          },
          cashFlow: {
            inflow: Math.round(cashInflow * 100) / 100,
            outflow: Math.round(cashOutflow * 100) / 100,
            net: Math.round(netCashFlow * 100) / 100,
          },
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /financial/cash-flow - Get cash flow analysis
    // =============================================================================
    if (req.method === 'GET' && resource === 'cash-flow') {
      const groupBy =
        url.searchParams.get('groupBy') || url.searchParams.get('group_by') || 'month';

      // Fetch invoices with payment data
      const { data: invoices, error: invoicesError } = await admin
        .from('invoices')
        .select(
          'id, total_amount, amount_paid, paid_date, invoice_date, invoice_type, invoice_status',
        )
        .eq('tenant_id', tenantId)
        .gte('invoice_date', startDate.toISOString())
        .lte('invoice_date', endDate.toISOString())
        .order('invoice_date', { ascending: true });

      if (invoicesError) {
        console.error('Error fetching invoices for cash flow:', invoicesError);
        return createCorsResponse({ error: 'Failed to fetch cash flow data' }, 500, req);
      }

      // Group cash flow data by period
      const cashFlowByPeriod: Record<
        string,
        {
          period: string;
          inflow: number;
          outflow: number;
          net: number;
          invoiceCount: number;
          paidCount: number;
        }
      > = {};

      for (const inv of invoices || []) {
        const invoiceDate = new Date(inv.invoice_date);
        let periodKey: string;

        if (groupBy === 'day') {
          periodKey = invoiceDate.toISOString().split('T')[0];
        } else if (groupBy === 'week') {
          const weekStart = new Date(invoiceDate);
          weekStart.setDate(invoiceDate.getDate() - invoiceDate.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
        } else {
          // Default to month
          periodKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!cashFlowByPeriod[periodKey]) {
          cashFlowByPeriod[periodKey] = {
            period: periodKey,
            inflow: 0,
            outflow: 0,
            net: 0,
            invoiceCount: 0,
            paidCount: 0,
          };
        }

        const amountPaid = parseFloat(inv.amount_paid || '0');
        const totalAmount = parseFloat(inv.total_amount || '0');

        cashFlowByPeriod[periodKey].inflow += amountPaid;
        cashFlowByPeriod[periodKey].invoiceCount++;

        if (inv.invoice_status === 'paid') {
          cashFlowByPeriod[periodKey].paidCount++;
        }

        // Estimate outflow as 60% of invoiced amount (COGS)
        cashFlowByPeriod[periodKey].outflow += totalAmount * 0.6;
      }

      // Calculate net for each period
      const cashFlowData = Object.values(cashFlowByPeriod)
        .map((p) => ({
          ...p,
          net: Math.round((p.inflow - p.outflow) * 100) / 100,
          inflow: Math.round(p.inflow * 100) / 100,
          outflow: Math.round(p.outflow * 100) / 100,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      // Calculate summary
      const totalInflow = cashFlowData.reduce((sum, p) => sum + p.inflow, 0);
      const totalOutflow = cashFlowData.reduce((sum, p) => sum + p.outflow, 0);

      return createCorsResponse(
        {
          period,
          groupBy,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          summary: {
            totalInflow: Math.round(totalInflow * 100) / 100,
            totalOutflow: Math.round(totalOutflow * 100) / 100,
            netCashFlow: Math.round((totalInflow - totalOutflow) * 100) / 100,
          },
          data: cashFlowData,
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /financial/revenue - Get revenue breakdown by period, customer, product
    // =============================================================================
    if (req.method === 'GET' && resource === 'revenue') {
      const breakdown = url.searchParams.get('breakdown') || 'period'; // period, customer, type

      const { data: invoices, error: invoicesError } = await admin
        .from('invoices')
        .select(
          `
          id,
          total_amount,
          amount_paid,
          invoice_date,
          invoice_type,
          invoice_status,
          customer_id,
          customer:business_records!invoices_customer_id_fkey(id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .gte('invoice_date', startDate.toISOString())
        .lte('invoice_date', endDate.toISOString())
        .order('invoice_date', { ascending: true });

      if (invoicesError) {
        console.error('Error fetching revenue data:', invoicesError);
        return createCorsResponse({ error: 'Failed to fetch revenue data' }, 500, req);
      }

      let revenueData: any[] = [];

      if (breakdown === 'customer') {
        // Group by customer
        const byCustomer: Record<
          string,
          {
            customerId: string;
            customerName: string;
            revenue: number;
            collected: number;
            invoiceCount: number;
          }
        > = {};

        for (const inv of invoices || []) {
          const customerId = inv.customer_id || 'unknown';
          const customerName = (inv.customer as any)?.company_name || 'Unknown Customer';

          if (!byCustomer[customerId]) {
            byCustomer[customerId] = {
              customerId,
              customerName,
              revenue: 0,
              collected: 0,
              invoiceCount: 0,
            };
          }

          byCustomer[customerId].revenue += parseFloat(inv.total_amount || '0');
          byCustomer[customerId].collected += parseFloat(inv.amount_paid || '0');
          byCustomer[customerId].invoiceCount++;
        }

        revenueData = Object.values(byCustomer)
          .map((c) => ({
            ...c,
            revenue: Math.round(c.revenue * 100) / 100,
            collected: Math.round(c.collected * 100) / 100,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      } else if (breakdown === 'type') {
        // Group by invoice type
        const byType: Record<
          string,
          {
            type: string;
            revenue: number;
            collected: number;
            invoiceCount: number;
          }
        > = {};

        for (const inv of invoices || []) {
          const invType = inv.invoice_type || 'other';

          if (!byType[invType]) {
            byType[invType] = {
              type: invType,
              revenue: 0,
              collected: 0,
              invoiceCount: 0,
            };
          }

          byType[invType].revenue += parseFloat(inv.total_amount || '0');
          byType[invType].collected += parseFloat(inv.amount_paid || '0');
          byType[invType].invoiceCount++;
        }

        revenueData = Object.values(byType)
          .map((t) => ({
            ...t,
            revenue: Math.round(t.revenue * 100) / 100,
            collected: Math.round(t.collected * 100) / 100,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      } else {
        // Default: Group by period (month)
        const byPeriod: Record<
          string,
          {
            period: string;
            revenue: number;
            collected: number;
            invoiceCount: number;
          }
        > = {};

        for (const inv of invoices || []) {
          const invoiceDate = new Date(inv.invoice_date);
          const periodKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;

          if (!byPeriod[periodKey]) {
            byPeriod[periodKey] = {
              period: periodKey,
              revenue: 0,
              collected: 0,
              invoiceCount: 0,
            };
          }

          byPeriod[periodKey].revenue += parseFloat(inv.total_amount || '0');
          byPeriod[periodKey].collected += parseFloat(inv.amount_paid || '0');
          byPeriod[periodKey].invoiceCount++;
        }

        revenueData = Object.values(byPeriod)
          .map((p) => ({
            ...p,
            revenue: Math.round(p.revenue * 100) / 100,
            collected: Math.round(p.collected * 100) / 100,
          }))
          .sort((a, b) => a.period.localeCompare(b.period));
      }

      // Calculate totals
      const totalRevenue = revenueData.reduce((sum, r) => sum + r.revenue, 0);
      const totalCollected = revenueData.reduce((sum, r) => sum + r.collected, 0);
      const totalInvoices = revenueData.reduce((sum, r) => sum + r.invoiceCount, 0);

      return createCorsResponse(
        {
          period,
          breakdown,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          summary: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalCollected: Math.round(totalCollected * 100) / 100,
            outstandingAmount: Math.round((totalRevenue - totalCollected) * 100) / 100,
            totalInvoices,
            collectionRate:
              totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100 * 100) / 100 : 0,
          },
          data: revenueData,
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /financial/expenses - Get expense breakdown by category
    // =============================================================================
    if (req.method === 'GET' && resource === 'expenses') {
      // Since we don't have a dedicated expenses table, we estimate from invoices and contracts
      const [invoicesResult, contractsResult] = await Promise.all([
        admin
          .from('invoices')
          .select('id, total_amount, invoice_date, invoice_type')
          .eq('tenant_id', tenantId)
          .gte('invoice_date', startDate.toISOString())
          .lte('invoice_date', endDate.toISOString()),
        admin
          .from('contracts')
          .select('id, monthly_base, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
      ]);

      if (invoicesResult.error) {
        console.error('Error fetching expense data:', invoicesResult.error);
        return createCorsResponse({ error: 'Failed to fetch expense data' }, 500, req);
      }

      const invoices = invoicesResult.data || [];
      const contracts = contractsResult.data || [];

      // Calculate revenue for expense estimation
      const totalRevenue = invoices.reduce(
        (sum, inv) => sum + parseFloat(inv.total_amount || '0'),
        0,
      );

      // Calculate MRR
      const mrr = contracts.reduce(
        (sum, c) => sum + parseFloat(c.monthly_base?.toString() || '0'),
        0,
      );

      // Estimate expense categories (these would ideally come from actual expense tracking)
      const expenseCategories = [
        {
          category: 'Cost of Goods Sold',
          description: 'Direct costs for products and services',
          amount: Math.round(totalRevenue * 0.5 * 100) / 100, // 50% COGS
          percentage: 50,
        },
        {
          category: 'Labor & Payroll',
          description: 'Employee salaries and benefits',
          amount: Math.round(mrr * 0.3 * 100) / 100, // 30% of MRR
          percentage: 15,
        },
        {
          category: 'Overhead',
          description: 'Rent, utilities, insurance',
          amount: Math.round(mrr * 0.15 * 100) / 100, // 15% of MRR
          percentage: 8,
        },
        {
          category: 'Sales & Marketing',
          description: 'Advertising, commissions, promotions',
          amount: Math.round(totalRevenue * 0.1 * 100) / 100, // 10% of revenue
          percentage: 10,
        },
        {
          category: 'Operations',
          description: 'Vehicle, supplies, maintenance',
          amount: Math.round(mrr * 0.1 * 100) / 100, // 10% of MRR
          percentage: 5,
        },
        {
          category: 'Technology',
          description: 'Software, hardware, IT services',
          amount: Math.round(mrr * 0.05 * 100) / 100, // 5% of MRR
          percentage: 3,
        },
      ];

      const totalExpenses = expenseCategories.reduce((sum, c) => sum + c.amount, 0);

      // Group expenses by period (month)
      const expensesByPeriod: Record<string, { period: string; amount: number }> = {};
      const periodMonths = Math.max(
        1,
        Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)),
      );
      const monthlyExpense = totalExpenses / periodMonths;

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const periodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        expensesByPeriod[periodKey] = {
          period: periodKey,
          amount: Math.round(monthlyExpense * 100) / 100,
        };
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return createCorsResponse(
        {
          period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          summary: {
            totalExpenses: Math.round(totalExpenses * 100) / 100,
            expenseToRevenueRatio:
              totalRevenue > 0 ? Math.round((totalExpenses / totalRevenue) * 100 * 100) / 100 : 0,
          },
          byCategory: expenseCategories,
          byPeriod: Object.values(expensesByPeriod).sort((a, b) =>
            a.period.localeCompare(b.period),
          ),
          note: 'Expense data is estimated based on industry averages. Implement expense tracking for accurate data.',
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /financial/forecasts - Get financial forecasts
    // =============================================================================
    if (req.method === 'GET' && resource === 'forecasts') {
      const forecastMonths = parseInt(url.searchParams.get('months') || '6');

      // Get historical data for trend analysis
      const historicalStart = new Date();
      historicalStart.setMonth(historicalStart.getMonth() - 12); // Last 12 months

      const [invoicesResult, contractsResult, quotesResult] = await Promise.all([
        admin
          .from('invoices')
          .select('id, total_amount, amount_paid, invoice_date, invoice_status')
          .eq('tenant_id', tenantId)
          .gte('invoice_date', historicalStart.toISOString())
          .order('invoice_date', { ascending: true }),
        admin
          .from('contracts')
          .select('id, monthly_base, status, start_date, end_date')
          .eq('tenant_id', tenantId),
        admin
          .from('quotes')
          .select('id, total_amount, status, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', historicalStart.toISOString()),
      ]);

      if (invoicesResult.error) {
        console.error('Error fetching forecast data:', invoicesResult.error);
        return createCorsResponse({ error: 'Failed to fetch forecast data' }, 500, req);
      }

      const invoices = invoicesResult.data || [];
      const contracts = contractsResult.data || [];
      const quotes = quotesResult.data || [];

      // Calculate historical monthly revenue
      const monthlyRevenue: Record<string, number> = {};
      for (const inv of invoices) {
        const invoiceDate = new Date(inv.invoice_date);
        const periodKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[periodKey] =
          (monthlyRevenue[periodKey] || 0) + parseFloat(inv.total_amount || '0');
      }

      const historicalMonths = Object.entries(monthlyRevenue)
        .map(([period, revenue]) => ({ period, revenue }))
        .sort((a, b) => a.period.localeCompare(b.period));

      // Calculate average monthly revenue and growth rate
      const revenueValues = historicalMonths.map((m) => m.revenue);
      const avgMonthlyRevenue =
        revenueValues.length > 0
          ? revenueValues.reduce((a, b) => a + b, 0) / revenueValues.length
          : 0;

      // Calculate month-over-month growth
      let totalGrowth = 0;
      let growthCount = 0;
      for (let i = 1; i < revenueValues.length; i++) {
        if (revenueValues[i - 1] > 0) {
          totalGrowth += (revenueValues[i] - revenueValues[i - 1]) / revenueValues[i - 1];
          growthCount++;
        }
      }
      const avgGrowthRate = growthCount > 0 ? totalGrowth / growthCount : 0.02; // Default 2% growth

      // Calculate MRR from active contracts
      const activeContracts = contracts.filter((c) => c.status === 'active');
      const currentMRR = activeContracts.reduce(
        (sum, c) => sum + parseFloat(c.monthly_base?.toString() || '0'),
        0,
      );

      // Calculate pipeline value (pending quotes)
      const pendingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'pending');
      const pipelineValue = pendingQuotes.reduce(
        (sum, q) => sum + parseFloat(q.total_amount || '0'),
        0,
      );

      // Calculate win rate
      const acceptedQuotes = quotes.filter((q) => q.status === 'accepted').length;
      const totalQuotes = quotes.length;
      const winRate = totalQuotes > 0 ? acceptedQuotes / totalQuotes : 0.25; // Default 25%

      // Generate forecast
      const forecast: Array<{
        period: string;
        projectedRevenue: number;
        projectedMRR: number;
        projectedExpenses: number;
        projectedProfit: number;
        confidence: string;
      }> = [];

      const baseRevenue = avgMonthlyRevenue || currentMRR;
      const currentDate = new Date();

      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(currentDate);
        forecastDate.setMonth(currentDate.getMonth() + i);
        const periodKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;

        // Project revenue with growth
        const projectedRevenue = baseRevenue * Math.pow(1 + avgGrowthRate, i);
        const projectedMRR = currentMRR * Math.pow(1 + avgGrowthRate * 0.5, i); // MRR grows slower
        const projectedExpenses = projectedRevenue * 0.75; // 75% expense ratio
        const projectedProfit = projectedRevenue - projectedExpenses;

        // Confidence decreases with time
        let confidence: string;
        if (i <= 2) confidence = 'high';
        else if (i <= 4) confidence = 'medium';
        else confidence = 'low';

        forecast.push({
          period: periodKey,
          projectedRevenue: Math.round(projectedRevenue * 100) / 100,
          projectedMRR: Math.round(projectedMRR * 100) / 100,
          projectedExpenses: Math.round(projectedExpenses * 100) / 100,
          projectedProfit: Math.round(projectedProfit * 100) / 100,
          confidence,
        });
      }

      // Contracts expiring in forecast period
      const expiringContracts = contracts.filter((c) => {
        if (!c.end_date) return false;
        const endDate = new Date(c.end_date);
        const forecastEnd = new Date();
        forecastEnd.setMonth(forecastEnd.getMonth() + forecastMonths);
        return endDate >= currentDate && endDate <= forecastEnd;
      });

      return createCorsResponse(
        {
          forecastMonths,
          generatedAt: new Date().toISOString(),
          assumptions: {
            avgMonthlyRevenue: Math.round(avgMonthlyRevenue * 100) / 100,
            monthlyGrowthRate: Math.round(avgGrowthRate * 100 * 100) / 100,
            expenseRatio: 75,
            winRate: Math.round(winRate * 100 * 100) / 100,
          },
          currentMetrics: {
            mrr: Math.round(currentMRR * 100) / 100,
            arr: Math.round(currentMRR * 12 * 100) / 100,
            pipelineValue: Math.round(pipelineValue * 100) / 100,
            expectedPipelineRevenue: Math.round(pipelineValue * winRate * 100) / 100,
            activeContracts: activeContracts.length,
            expiringContracts: expiringContracts.length,
          },
          historical: historicalMonths.map((m) => ({
            ...m,
            revenue: Math.round(m.revenue * 100) / 100,
          })),
          forecast,
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /financial/reports - Get financial reports list
    // =============================================================================
    if (req.method === 'GET' && resource === 'reports' && !subResource) {
      const reports = [
        {
          id: 'profit-loss',
          name: 'Profit & Loss Statement',
          description: 'Income statement showing revenue, expenses, and net income',
          frequency: ['monthly', 'quarterly', 'yearly'],
          lastGenerated: null,
        },
        {
          id: 'balance-sheet',
          name: 'Balance Sheet',
          description: 'Snapshot of assets, liabilities, and equity',
          frequency: ['monthly', 'quarterly', 'yearly'],
          lastGenerated: null,
        },
        {
          id: 'cash-flow-statement',
          name: 'Cash Flow Statement',
          description: 'Cash inflows and outflows from operations, investing, and financing',
          frequency: ['monthly', 'quarterly', 'yearly'],
          lastGenerated: null,
        },
        {
          id: 'accounts-receivable-aging',
          name: 'Accounts Receivable Aging',
          description: 'Outstanding invoices by age bucket',
          frequency: ['weekly', 'monthly'],
          lastGenerated: null,
        },
        {
          id: 'revenue-by-customer',
          name: 'Revenue by Customer',
          description: 'Revenue breakdown by customer with rankings',
          frequency: ['monthly', 'quarterly'],
          lastGenerated: null,
        },
        {
          id: 'mrr-analysis',
          name: 'MRR Analysis',
          description: 'Monthly recurring revenue trends and breakdown',
          frequency: ['monthly'],
          lastGenerated: null,
        },
      ];

      return createCorsResponse({ reports }, 200, req);
    }

    // =============================================================================
    // POST /financial/reports/:type - Generate financial report
    // =============================================================================
    if (req.method === 'POST' && resource === 'reports' && subResource) {
      const reportType = subResource;

      // Generate report based on type
      switch (reportType) {
        case 'profit-loss': {
          const [invoicesResult, contractsResult] = await Promise.all([
            admin
              .from('invoices')
              .select('id, total_amount, amount_paid, invoice_date, invoice_type, invoice_status')
              .eq('tenant_id', tenantId)
              .gte('invoice_date', startDate.toISOString())
              .lte('invoice_date', endDate.toISOString()),
            admin
              .from('contracts')
              .select('id, monthly_base, status')
              .eq('tenant_id', tenantId)
              .eq('status', 'active'),
          ]);

          const invoices = invoicesResult.data || [];
          const contracts = contractsResult.data || [];

          const totalRevenue = invoices.reduce(
            (sum, inv) => sum + parseFloat(inv.total_amount || '0'),
            0,
          );

          const mrr = contracts.reduce(
            (sum, c) => sum + parseFloat(c.monthly_base?.toString() || '0'),
            0,
          );

          // Revenue breakdown by type
          const revenueByType: Record<string, number> = {};
          for (const inv of invoices) {
            const invType = inv.invoice_type || 'other';
            revenueByType[invType] =
              (revenueByType[invType] || 0) + parseFloat(inv.total_amount || '0');
          }

          // Estimated expenses
          const cogs = totalRevenue * 0.5;
          const laborExpense = mrr * 0.3;
          const overheadExpense = mrr * 0.15;
          const marketingExpense = totalRevenue * 0.1;
          const operationsExpense = mrr * 0.1;

          const totalExpenses =
            cogs + laborExpense + overheadExpense + marketingExpense + operationsExpense;
          const grossProfit = totalRevenue - cogs;
          const operatingIncome =
            grossProfit - (laborExpense + overheadExpense + marketingExpense + operationsExpense);
          const netIncome = operatingIncome;

          return createCorsResponse(
            {
              reportType: 'profit-loss',
              reportName: 'Profit & Loss Statement',
              period,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              generatedAt: new Date().toISOString(),
              data: {
                revenue: {
                  total: Math.round(totalRevenue * 100) / 100,
                  byType: Object.entries(revenueByType).map(([type, amount]) => ({
                    type,
                    amount: Math.round(amount * 100) / 100,
                  })),
                  recurringRevenue: Math.round(mrr * 100) / 100,
                },
                costOfGoodsSold: Math.round(cogs * 100) / 100,
                grossProfit: Math.round(grossProfit * 100) / 100,
                grossMargin:
                  totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100 * 100) / 100 : 0,
                operatingExpenses: {
                  labor: Math.round(laborExpense * 100) / 100,
                  overhead: Math.round(overheadExpense * 100) / 100,
                  marketing: Math.round(marketingExpense * 100) / 100,
                  operations: Math.round(operationsExpense * 100) / 100,
                  total:
                    Math.round(
                      (laborExpense + overheadExpense + marketingExpense + operationsExpense) * 100,
                    ) / 100,
                },
                operatingIncome: Math.round(operatingIncome * 100) / 100,
                netIncome: Math.round(netIncome * 100) / 100,
                netMargin:
                  totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 100 * 100) / 100 : 0,
              },
              note: 'Expenses are estimated based on industry averages.',
            },
            200,
            req,
          );
        }

        case 'accounts-receivable-aging': {
          const { data: invoices, error } = await admin
            .from('invoices')
            .select(
              `
              id,
              invoice_number,
              customer_id,
              total_amount,
              amount_paid,
              balance_due,
              invoice_date,
              due_date,
              invoice_status,
              customer:business_records!invoices_customer_id_fkey(id, company_name)
            `,
            )
            .eq('tenant_id', tenantId)
            .neq('invoice_status', 'paid')
            .gt('balance_due', 0);

          if (error) {
            console.error('Error fetching AR aging data:', error);
            return createCorsResponse({ error: 'Failed to generate AR aging report' }, 500, req);
          }

          const today = new Date();
          const agingBuckets = {
            current: { invoices: [] as any[], total: 0 },
            '1-30': { invoices: [] as any[], total: 0 },
            '31-60': { invoices: [] as any[], total: 0 },
            '61-90': { invoices: [] as any[], total: 0 },
            '90+': { invoices: [] as any[], total: 0 },
          };

          for (const inv of invoices || []) {
            const dueDate = new Date(inv.due_date);
            const daysOverdue = Math.floor(
              (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            const balanceDue = parseFloat(inv.balance_due || '0');

            const invoiceData = {
              id: inv.id,
              invoiceNumber: inv.invoice_number,
              customerName: (inv.customer as any)?.company_name || 'Unknown',
              invoiceDate: inv.invoice_date,
              dueDate: inv.due_date,
              totalAmount: parseFloat(inv.total_amount || '0'),
              balanceDue,
              daysOverdue: Math.max(0, daysOverdue),
            };

            if (daysOverdue <= 0) {
              agingBuckets.current.invoices.push(invoiceData);
              agingBuckets.current.total += balanceDue;
            } else if (daysOverdue <= 30) {
              agingBuckets['1-30'].invoices.push(invoiceData);
              agingBuckets['1-30'].total += balanceDue;
            } else if (daysOverdue <= 60) {
              agingBuckets['31-60'].invoices.push(invoiceData);
              agingBuckets['31-60'].total += balanceDue;
            } else if (daysOverdue <= 90) {
              agingBuckets['61-90'].invoices.push(invoiceData);
              agingBuckets['61-90'].total += balanceDue;
            } else {
              agingBuckets['90+'].invoices.push(invoiceData);
              agingBuckets['90+'].total += balanceDue;
            }
          }

          const totalOutstanding = Object.values(agingBuckets).reduce((sum, b) => sum + b.total, 0);

          return createCorsResponse(
            {
              reportType: 'accounts-receivable-aging',
              reportName: 'Accounts Receivable Aging',
              generatedAt: new Date().toISOString(),
              summary: {
                totalOutstanding: Math.round(totalOutstanding * 100) / 100,
                invoiceCount: invoices?.length || 0,
                current: Math.round(agingBuckets.current.total * 100) / 100,
                overdue1to30: Math.round(agingBuckets['1-30'].total * 100) / 100,
                overdue31to60: Math.round(agingBuckets['31-60'].total * 100) / 100,
                overdue61to90: Math.round(agingBuckets['61-90'].total * 100) / 100,
                overdue90plus: Math.round(agingBuckets['90+'].total * 100) / 100,
              },
              buckets: Object.entries(agingBuckets).map(([bucket, data]) => ({
                bucket,
                total: Math.round(data.total * 100) / 100,
                count: data.invoices.length,
                invoices: data.invoices,
              })),
            },
            200,
            req,
          );
        }

        case 'mrr-analysis': {
          const [contractsResult, invoicesResult] = await Promise.all([
            admin
              .from('contracts')
              .select(
                'id, contract_number, monthly_base, status, start_date, end_date, customer_id',
              )
              .eq('tenant_id', tenantId),
            admin
              .from('invoices')
              .select('id, total_amount, invoice_date, contract_id')
              .eq('tenant_id', tenantId)
              .gte('invoice_date', startDate.toISOString())
              .lte('invoice_date', endDate.toISOString()),
          ]);

          const contracts = contractsResult.data || [];
          const invoices = invoicesResult.data || [];

          const activeContracts = contracts.filter((c) => c.status === 'active');
          const currentMRR = activeContracts.reduce(
            (sum, c) => sum + parseFloat(c.monthly_base?.toString() || '0'),
            0,
          );

          // Calculate MRR by contract
          const mrrByContract = activeContracts
            .map((c) => ({
              contractId: c.id,
              contractNumber: c.contract_number,
              mrr: parseFloat(c.monthly_base?.toString() || '0'),
              startDate: c.start_date,
              endDate: c.end_date,
            }))
            .sort((a, b) => b.mrr - a.mrr);

          // Calculate historical MRR trend (simplified)
          const mrrTrend: Array<{ period: string; mrr: number; contractCount: number }> = [];
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const periodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

            // Count contracts active during this period
            const activeInPeriod = contracts.filter((c) => {
              const start = new Date(c.start_date);
              const end = c.end_date ? new Date(c.end_date) : new Date('2099-12-31');
              return start <= currentDate && end >= currentDate && c.status !== 'cancelled';
            });

            const periodMRR = activeInPeriod.reduce(
              (sum, c) => sum + parseFloat(c.monthly_base?.toString() || '0'),
              0,
            );

            mrrTrend.push({
              period: periodKey,
              mrr: Math.round(periodMRR * 100) / 100,
              contractCount: activeInPeriod.length,
            });

            currentDate.setMonth(currentDate.getMonth() + 1);
          }

          return createCorsResponse(
            {
              reportType: 'mrr-analysis',
              reportName: 'MRR Analysis',
              period,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              generatedAt: new Date().toISOString(),
              summary: {
                currentMRR: Math.round(currentMRR * 100) / 100,
                currentARR: Math.round(currentMRR * 12 * 100) / 100,
                activeContracts: activeContracts.length,
                avgMRRPerContract:
                  activeContracts.length > 0
                    ? Math.round((currentMRR / activeContracts.length) * 100) / 100
                    : 0,
              },
              byContract: mrrByContract.slice(0, 20), // Top 20
              trend: mrrTrend,
            },
            200,
            req,
          );
        }

        case 'revenue-by-customer': {
          const { data: invoices, error } = await admin
            .from('invoices')
            .select(
              `
              id,
              total_amount,
              amount_paid,
              invoice_date,
              customer_id,
              customer:business_records!invoices_customer_id_fkey(id, company_name)
            `,
            )
            .eq('tenant_id', tenantId)
            .gte('invoice_date', startDate.toISOString())
            .lte('invoice_date', endDate.toISOString());

          if (error) {
            console.error('Error fetching revenue by customer:', error);
            return createCorsResponse(
              { error: 'Failed to generate revenue by customer report' },
              500,
              req,
            );
          }

          // Group by customer
          const byCustomer: Record<
            string,
            {
              customerId: string;
              customerName: string;
              revenue: number;
              collected: number;
              invoiceCount: number;
            }
          > = {};

          for (const inv of invoices || []) {
            const customerId = inv.customer_id || 'unknown';
            const customerName = (inv.customer as any)?.company_name || 'Unknown Customer';

            if (!byCustomer[customerId]) {
              byCustomer[customerId] = {
                customerId,
                customerName,
                revenue: 0,
                collected: 0,
                invoiceCount: 0,
              };
            }

            byCustomer[customerId].revenue += parseFloat(inv.total_amount || '0');
            byCustomer[customerId].collected += parseFloat(inv.amount_paid || '0');
            byCustomer[customerId].invoiceCount++;
          }

          const customerData = Object.values(byCustomer)
            .map((c, idx, arr) => {
              const totalRevenue = arr.reduce((sum, x) => sum + x.revenue, 0);
              return {
                ...c,
                revenue: Math.round(c.revenue * 100) / 100,
                collected: Math.round(c.collected * 100) / 100,
                percentageOfTotal:
                  totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100 * 100) / 100 : 0,
              };
            })
            .sort((a, b) => b.revenue - a.revenue);

          const totalRevenue = customerData.reduce((sum, c) => sum + c.revenue, 0);
          const totalCollected = customerData.reduce((sum, c) => sum + c.collected, 0);

          return createCorsResponse(
            {
              reportType: 'revenue-by-customer',
              reportName: 'Revenue by Customer',
              period,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              generatedAt: new Date().toISOString(),
              summary: {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalCollected: Math.round(totalCollected * 100) / 100,
                customerCount: customerData.length,
                avgRevenuePerCustomer:
                  customerData.length > 0
                    ? Math.round((totalRevenue / customerData.length) * 100) / 100
                    : 0,
              },
              topCustomers: customerData.slice(0, 20),
              allCustomers: customerData,
            },
            200,
            req,
          );
        }

        case 'balance-sheet':
        case 'cash-flow-statement': {
          // These would require more comprehensive financial data
          return createCorsResponse(
            {
              reportType,
              reportName: reportType === 'balance-sheet' ? 'Balance Sheet' : 'Cash Flow Statement',
              generatedAt: new Date().toISOString(),
              message: `${reportType === 'balance-sheet' ? 'Balance Sheet' : 'Cash Flow Statement'} generation requires complete financial data integration. Currently returning placeholder structure.`,
              data: {
                note: 'Implement complete asset, liability, and equity tracking for accurate reports.',
              },
            },
            200,
            req,
          );
        }

        default:
          return createCorsResponse({ error: `Unknown report type: ${reportType}` }, 400, req);
      }
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed or invalid endpoint' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in financial function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
