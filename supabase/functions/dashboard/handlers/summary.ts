// The four endpoints server/routes-dashboards-core.ts served in dev and nothing
// served in production: /metrics (bare), /recent-tickets, /top-customers and
// /alerts (DASH-METRICS-001).
//
// These were already real queries, which is why they are ported rather than
// rewritten. Three things changed on the way across. The bare /metrics returned
// `recentGrowth: 0` with the comment "Calculate based on historical data if
// needed" - a zero is a measurement, so it is null with a reason now. Its
// monthly revenue was bucketed on created_at rather than invoice_date, which
// counts a back-dated invoice in the wrong month. And /alerts ran
// `quantity_on_hand <= reorder_point` as raw SQL, which PostgREST cannot
// express at all, so the comparison happens here over a capped read.
import { startOfUtcDay } from '../../_shared/date-months.ts';
import { fetchInBatches } from '../../_shared/batch-fetch.ts';
import { type Admin, monthStart, sumNumericField, WIDGET_LIMIT } from './_context.ts';

const OPEN_TICKET_STATUSES = ['open', 'in_progress', 'scheduled', 'assigned'];

export async function dashboardSummary(
  admin: Admin,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const from = monthStart(now);
  const to = monthStart(now, -1);

  const [customers, contracts, invoiceRows, tickets] = await Promise.all([
    admin
      .from('business_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('record_type', 'customer'),
    admin
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    admin
      .from('invoices')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('invoice_date', startOfUtcDay(from).toISOString())
      .lt('invoice_date', startOfUtcDay(to).toISOString()),
    admin
      .from('service_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', OPEN_TICKET_STATUSES),
  ]);

  return {
    totalCustomers: customers.count ?? 0,
    activeContracts: contracts.count ?? 0,
    monthlyRevenue: sumNumericField(
      (invoiceRows.data ?? []) as Array<Record<string, unknown>>,
      'total_amount',
    ),
    openTickets: tickets.count ?? 0,
    recentGrowth: null,
    unbacked: ['recentGrowth'],
    reason: 'Growth needs a prior-period customer count and nothing versions it.',
  };
}

export async function dashboardRecentTickets(
  admin: Admin,
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await admin
    .from('service_tickets')
    .select('id, title, status, priority, customer_id, description, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const customerIds = rows.map((r) => String(r.customer_id ?? '')).filter(Boolean);
  const names = new Map<string, string>();
  if (customerIds.length > 0) {
    // PostgREST has no join without a declared FK relationship, so the customer
    // names are one extra read for the whole page rather than one per ticket.
    const accounts = await fetchInBatches<Record<string, unknown>>(customerIds, 'id', () =>
      admin.from('business_records').select('id, company_name').eq('tenant_id', tenantId),
    );
    for (const account of accounts) {
      names.set(String(account.id), String(account.company_name ?? ''));
    }
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    customer: names.get(String(row.customer_id ?? '')) || null,
    description: row.description,
    createdAt: row.created_at,
  }));
}

export async function dashboardTopCustomers(
  admin: Admin,
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const { data: accounts, error } = await admin
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .eq('record_type', 'customer');
  if (error) throw error;

  const rows = (accounts ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  // PostgREST has no SUM or GROUP BY, so the contract values are totalled here.
  const contracts = await fetchInBatches<Record<string, unknown>>(
    rows.map((r) => String(r.id)),
    'customer_id',
    () =>
      admin
        .from('contracts')
        .select('id, customer_id, monthly_base')
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
  );

  const byCustomer = new Map<string, Array<Record<string, unknown>>>();
  for (const contract of contracts) {
    const key = String(contract.customer_id ?? '');
    const bucket = byCustomer.get(key);
    if (bucket) bucket.push(contract);
    else byCustomer.set(key, [contract]);
  }

  return rows
    .map((account) => {
      const owned = byCustomer.get(String(account.id)) ?? [];
      return {
        id: account.id,
        name: account.company_name,
        accountValue: sumNumericField(owned, 'monthly_base'),
        contractsCount: owned.length,
      };
    })
    .sort((a, b) => b.accountValue - a.accountValue)
    .slice(0, 10);
}

export async function dashboardAlerts(
  admin: Admin,
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await admin
    .from('inventory_items')
    .select('id, item_description, item_category, quantity_on_hand, reorder_point')
    .eq('tenant_id', tenantId)
    .not('reorder_point', 'is', null)
    .order('quantity_on_hand', { ascending: true })
    .limit(500);
  if (error) throw error;

  const now = new Date().toISOString();
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((item) => {
      const onHand = Number(item.quantity_on_hand ?? 0);
      const reorderAt = Number(item.reorder_point);
      return Number.isFinite(onHand) && Number.isFinite(reorderAt) && onHand <= reorderAt;
    })
    .slice(0, WIDGET_LIMIT)
    .map((item) => ({
      id: item.id,
      type: 'low_stock',
      severity: 'medium',
      title: `Low Stock: ${item.item_description}`,
      message: `${item.item_description} is running low (${item.quantity_on_hand} remaining, reorder at ${item.reorder_point})`,
      category: item.item_category,
      timestamp: now,
    }));
}
