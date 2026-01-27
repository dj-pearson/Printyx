// Billing Edge Function
// Handles billing analytics, invoices, rules, and invoice generation
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
    // Path structure: /billing/[resource]/[id]
    const resource = pathParts[1]; // analytics, invoices, rules, generate-invoices, contract-profitability
    const resourceId = pathParts[2]; // :id for rules

    // =============================================================================
    // GET /billing/analytics - Get billing analytics
    // =============================================================================
    if (req.method === 'GET' && resource === 'analytics') {
      // Get invoice statistics
      const { data: invoices, error: invoicesError } = await admin
        .from('invoices')
        .select('id, total_amount, amount_paid, balance_due, invoice_status, billing_period_start')
        .eq('tenant_id', tenantId);

      if (invoicesError) {
        console.error('Error fetching invoices for analytics:', invoicesError);
        return createCorsResponse({ error: 'Failed to fetch billing analytics' }, 500, req);
      }

      const allInvoices = invoices || [];
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      let totalRevenue = 0;
      let outstandingAmount = 0;
      let overdueCount = 0;
      let monthlyRecurring = 0;

      for (const inv of allInvoices) {
        const totalAmount = parseFloat(inv.total_amount || '0');
        const amountPaid = parseFloat(inv.amount_paid || '0');
        const balanceDue = parseFloat(inv.balance_due || '0');

        if (inv.invoice_status === 'paid') {
          totalRevenue += totalAmount;
        }

        if (inv.invoice_status !== 'paid') {
          outstandingAmount += balanceDue;
        }

        if (inv.invoice_status === 'overdue') {
          overdueCount++;
        }

        // Check if invoice is from current month for MRR calculation
        if (inv.billing_period_start) {
          const invoiceDate = new Date(inv.billing_period_start);
          if (invoiceDate >= currentMonth) {
            monthlyRecurring += totalAmount;
          }
        }
      }

      const totalInvoices = allInvoices.length;
      const averageInvoiceAmount = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
      const collectionRate =
        totalRevenue > 0 ? totalRevenue / (totalRevenue + outstandingAmount) : 0;

      return createCorsResponse(
        {
          totalInvoices,
          totalRevenue,
          outstandingAmount,
          overdueInvoices: overdueCount,
          averageInvoiceAmount,
          collectionRate,
          monthlyRecurringRevenue: monthlyRecurring,
          annualRecurringRevenue: monthlyRecurring * 12,
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /billing/invoices - List invoices
    // =============================================================================
    if (req.method === 'GET' && resource === 'invoices' && !resourceId) {
      const status = url.searchParams.get('status');
      const contractId = url.searchParams.get('contractId') || url.searchParams.get('contract_id');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('invoices')
        .select(
          `
          *,
          customer:business_records!invoices_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_email)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && status !== 'all') {
        query = query.eq('invoice_status', status);
      }

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data: invoices, error, count } = await query;

      if (error) {
        console.error('Error fetching invoices:', error);
        return createCorsResponse({ error: 'Failed to fetch invoices' }, 500, req);
      }

      return createCorsResponse({ data: invoices || [], total: count || 0 }, 200, req);
    }

    // =============================================================================
    // GET /billing/rules - List billing rules
    // =============================================================================
    if (req.method === 'GET' && resource === 'rules' && !resourceId) {
      const status = url.searchParams.get('status') || url.searchParams.get('ruleStatus');
      const ruleType = url.searchParams.get('ruleType') || url.searchParams.get('rule_type');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const contractId = url.searchParams.get('contractId') || url.searchParams.get('contract_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('billing_rules')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('rule_status', status);
      }

      if (ruleType) {
        query = query.eq('rule_type', ruleType);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data: rules, error, count } = await query;

      if (error) {
        console.error('Error fetching billing rules:', error);
        return createCorsResponse({ error: 'Failed to fetch billing rules' }, 500, req);
      }

      return createCorsResponse(
        {
          rules: rules || [],
          pagination: {
            total: count || 0,
            limit,
            offset,
            hasMore: offset + limit < (count || 0),
          },
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /billing/rules/:id - Get single billing rule
    // =============================================================================
    if (req.method === 'GET' && resource === 'rules' && resourceId) {
      const { data: rule, error } = await admin
        .from('billing_rules')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !rule) {
        console.error('Error fetching billing rule:', error);
        return createCorsResponse({ error: 'Billing rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // =============================================================================
    // POST /billing/rules - Create billing rule
    // =============================================================================
    if (req.method === 'POST' && resource === 'rules') {
      const body = await req.json();

      const ruleData = {
        tenant_id: tenantId,
        rule_name: body.ruleName || body.rule_name,
        rule_type: body.ruleType || body.rule_type,
        rule_status: body.ruleStatus || body.rule_status || 'active',
        description: body.description || null,
        priority: body.priority || 0,
        customer_id: body.customerId || body.customer_id || null,
        contract_id: body.contractId || body.contract_id || null,
        conditions: body.conditions || null,
        actions: body.actions || null,
        effective_from: body.effectiveFrom || body.effective_from || null,
        effective_to: body.effectiveTo || body.effective_to || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newRule, error } = await admin
        .from('billing_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating billing rule:', error);
        return createCorsResponse(
          { error: 'Failed to create billing rule', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(newRule, 201, req);
    }

    // =============================================================================
    // PUT/PATCH /billing/rules/:id - Update billing rule
    // =============================================================================
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'rules' && resourceId) {
      const body = await req.json();

      // Verify rule exists and belongs to tenant
      const { data: existingRule, error: fetchError } = await admin
        .from('billing_rules')
        .select('id')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingRule) {
        return createCorsResponse({ error: 'Billing rule not found' }, 404, req);
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map camelCase to snake_case
      const fieldMap: Record<string, string> = {
        ruleName: 'rule_name',
        ruleType: 'rule_type',
        ruleStatus: 'rule_status',
        description: 'description',
        priority: 'priority',
        customerId: 'customer_id',
        contractId: 'contract_id',
        conditions: 'conditions',
        actions: 'actions',
        effectiveFrom: 'effective_from',
        effectiveTo: 'effective_to',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] ?? body[snakeKey];
        }
      }

      const { data: updatedRule, error } = await admin
        .from('billing_rules')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating billing rule:', error);
        return createCorsResponse({ error: 'Failed to update billing rule' }, 500, req);
      }

      return createCorsResponse(updatedRule, 200, req);
    }

    // =============================================================================
    // DELETE /billing/rules/:id - Delete billing rule (soft delete)
    // =============================================================================
    if (req.method === 'DELETE' && resource === 'rules' && resourceId) {
      // Verify rule exists
      const { data: existingRule, error: fetchError } = await admin
        .from('billing_rules')
        .select('id')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingRule) {
        return createCorsResponse({ error: 'Billing rule not found' }, 404, req);
      }

      // Soft delete by setting status to inactive
      const { data: deletedRule, error } = await admin
        .from('billing_rules')
        .update({
          rule_status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting billing rule:', error);
        return createCorsResponse({ error: 'Failed to delete billing rule' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Billing rule deactivated successfully', rule: deletedRule },
        200,
        req,
      );
    }

    // =============================================================================
    // POST /billing/generate-invoices - Generate invoices from meter readings
    // =============================================================================
    if (req.method === 'POST' && resource === 'generate-invoices') {
      // Get all pending meter readings
      const { data: pendingReadings, error: readingsError } = await admin
        .from('meter_readings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('billing_status', 'pending');

      if (readingsError) {
        console.error('Error fetching pending meter readings:', readingsError);
        return createCorsResponse({ error: 'Failed to fetch meter readings' }, 500, req);
      }

      if (!pendingReadings || pendingReadings.length === 0) {
        return createCorsResponse(
          { message: 'No pending meter readings to process', invoices: [] },
          200,
          req,
        );
      }

      // Extract unique contract IDs
      const contractIds = [
        ...new Set(pendingReadings.filter((r) => r.contract_id).map((r) => String(r.contract_id))),
      ];

      if (contractIds.length === 0) {
        return createCorsResponse(
          { message: 'No meter readings with valid contracts', invoices: [] },
          200,
          req,
        );
      }

      // Batch fetch all contracts
      const { data: allContracts, error: contractsError } = await admin
        .from('contracts')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('id', contractIds);

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
        return createCorsResponse({ error: 'Failed to fetch contracts' }, 500, req);
      }

      // Batch fetch tiered rates
      const { data: allTieredRates, error: ratesError } = await admin
        .from('contract_tiered_rates')
        .select('*')
        .in('contract_id', contractIds)
        .order('sort_order', { ascending: true });

      if (ratesError) {
        console.error('Error fetching tiered rates:', ratesError);
      }

      // Create lookup maps
      const contractMap = new Map((allContracts || []).map((c) => [c.id, c]));
      const tieredRatesMap = new Map<string, any[]>();
      for (const rate of allTieredRates || []) {
        const rates = tieredRatesMap.get(rate.contract_id) || [];
        rates.push(rate);
        tieredRatesMap.set(rate.contract_id, rates);
      }

      const generatedInvoices: any[] = [];
      const failedReadings: string[] = [];

      // Process each reading
      for (const reading of pendingReadings) {
        try {
          if (!reading.contract_id) continue;

          const contract = contractMap.get(String(reading.contract_id));
          if (!contract) continue;

          const tieredRates = tieredRatesMap.get(String(reading.contract_id)) || [];

          // Calculate billing amounts
          let blackAmount = 0;
          let colorAmount = 0;

          if (reading.black_copies && Number(reading.black_copies) > 0) {
            const blackRates = tieredRates
              .filter((rate) => rate.color_type === 'black')
              .sort((a, b) => a.minimum_volume - b.minimum_volume);
            blackAmount = calculateTieredAmount(
              Number(reading.black_copies),
              blackRates,
              parseFloat(contract.black_rate?.toString() || '0'),
            );
          }

          if (reading.color_copies && Number(reading.color_copies) > 0) {
            const colorRates = tieredRates
              .filter((rate) => rate.color_type === 'color')
              .sort((a, b) => a.minimum_volume - b.minimum_volume);
            colorAmount = calculateTieredAmount(
              Number(reading.color_copies),
              colorRates,
              parseFloat(contract.color_rate?.toString() || '0'),
            );
          }

          const totalAmount =
            blackAmount + colorAmount + parseFloat(contract.monthly_base?.toString() || '0');

          // Create invoice
          const invoiceData = {
            tenant_id: tenantId,
            customer_id: String(contract.customer_id),
            contract_id: contract.id,
            invoice_number: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            invoice_date: new Date().toISOString(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            total_amount: String(totalAmount),
            amount_paid: '0',
            balance_due: String(totalAmount),
            invoice_status: 'open',
            payment_terms: 'Net 30',
            invoice_notes: `Meter billing for ${new Date(reading.reading_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: invoice, error: invoiceError } = await admin
            .from('invoices')
            .insert(invoiceData)
            .select()
            .single();

          if (invoiceError) {
            console.error('Error creating invoice:', invoiceError);
            failedReadings.push(reading.id);
            continue;
          }

          // Update meter reading billing status
          await admin
            .from('meter_readings')
            .update({
              billing_status: 'processed',
              billing_amount: totalAmount.toString(),
              invoice_id: invoice.id,
            })
            .eq('id', reading.id)
            .eq('tenant_id', tenantId);

          generatedInvoices.push(invoice);
        } catch (readingError) {
          console.error(`Error processing reading ${reading.id}:`, readingError);
          failedReadings.push(reading.id);
        }
      }

      return createCorsResponse(
        {
          message: `Generated ${generatedInvoices.length} invoices`,
          invoices: generatedInvoices,
          ...(failedReadings.length > 0 && { failedReadingIds: failedReadings }),
        },
        200,
        req,
      );
    }

    // =============================================================================
    // GET /billing/contract-profitability - Get contract profitability analysis
    // =============================================================================
    if (req.method === 'GET' && resource === 'contract-profitability') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50'), 100);
      const offset = (page - 1) * pageSize;

      // Get contracts with invoice aggregation
      const { data: contracts, error: contractsError } = await admin
        .from('contracts')
        .select('id, contract_number, monthly_base, customer_id')
        .eq('tenant_id', tenantId)
        .range(offset, offset + pageSize - 1);

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
        return createCorsResponse({ error: 'Failed to fetch contracts' }, 500, req);
      }

      // Get total count
      const { count: totalCount, error: countError } = await admin
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (countError) {
        console.error('Error counting contracts:', countError);
      }

      // Get invoice totals per contract
      const contractIds = (contracts || []).map((c) => c.id);
      const { data: invoiceData, error: invoiceError } = await admin
        .from('invoices')
        .select('contract_id, total_amount, amount_paid')
        .eq('tenant_id', tenantId)
        .in('contract_id', contractIds);

      if (invoiceError) {
        console.error('Error fetching invoice data:', invoiceError);
      }

      // Aggregate invoice data by contract
      const invoiceAggregation = new Map<
        string,
        { totalRevenue: number; totalPaid: number; invoiceCount: number }
      >();
      for (const inv of invoiceData || []) {
        const existing = invoiceAggregation.get(inv.contract_id) || {
          totalRevenue: 0,
          totalPaid: 0,
          invoiceCount: 0,
        };
        existing.totalRevenue += parseFloat(inv.total_amount || '0');
        existing.totalPaid += parseFloat(inv.amount_paid || '0');
        existing.invoiceCount++;
        invoiceAggregation.set(inv.contract_id, existing);
      }

      // Calculate profitability metrics
      const profitabilityData = (contracts || []).map((contract) => {
        const invoiceStats = invoiceAggregation.get(contract.id) || {
          totalRevenue: 0,
          totalPaid: 0,
          invoiceCount: 0,
        };
        const monthlyCosts = parseFloat(contract.monthly_base?.toString() || '0') * 12;
        const grossProfit = invoiceStats.totalRevenue - monthlyCosts;
        const marginPercent =
          invoiceStats.totalRevenue > 0 ? (grossProfit / invoiceStats.totalRevenue) * 100 : 0;

        return {
          contractId: contract.id,
          contractNumber: contract.contract_number,
          totalRevenue: invoiceStats.totalRevenue,
          totalPaid: invoiceStats.totalPaid,
          invoiceCount: invoiceStats.invoiceCount,
          estimatedCosts: monthlyCosts,
          grossProfit,
          marginPercent: Math.round(marginPercent * 100) / 100,
        };
      });

      // Sort by total revenue descending
      profitabilityData.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return createCorsResponse(
        {
          data: profitabilityData,
          pagination: {
            page,
            pageSize,
            total: totalCount || 0,
            totalPages: Math.ceil((totalCount || 0) / pageSize),
          },
        },
        200,
        req,
      );
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in billing function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// Helper function to calculate tiered billing amounts
function calculateTieredAmount(
  volume: number,
  tieredRates: Array<{ minimum_volume: number; rate_per_unit: number }>,
  defaultRate: number,
): number {
  if (!tieredRates || tieredRates.length === 0) {
    return volume * defaultRate;
  }

  let totalAmount = 0;
  let remainingVolume = volume;

  for (let i = 0; i < tieredRates.length; i++) {
    const currentTier = tieredRates[i];
    const nextTier = tieredRates[i + 1];

    const tierStart = currentTier.minimum_volume;
    const tierEnd = nextTier ? nextTier.minimum_volume : Infinity;
    const tierRate = parseFloat(currentTier.rate_per_unit?.toString() || '0') || defaultRate;

    if (remainingVolume <= 0) break;

    const tierVolume = Math.min(remainingVolume, tierEnd - tierStart);
    if (tierVolume > 0) {
      totalAmount += tierVolume * tierRate;
      remainingVolume -= tierVolume;
    }
  }

  return totalAmount;
}
