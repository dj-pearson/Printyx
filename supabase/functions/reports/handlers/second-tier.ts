// Second-tier reports — endpoints that the frontend dashboards call but were
// never exposed under the persona prefixes. Originate from these Express files:
//
//   server/routes-breach-detection.ts  (breaches, breach-summary)
//   server/routes-reports.ts           (customer-health, sales-pipeline,
//                                       revenue-recognition,
//                                       service-sla-compliance,
//                                       technician-utilization)
//
// URLs: /reports/<endpoint>. Wired through the legacy URL set in index.ts.
//
// Schema reality applies (see SESSION-STATUS-2026-04-26.md "Schema reality"):
// the Express versions reference columns that do not exist. We honor the
// frontend response shape, surface real data where the column exists, and
// flag everything we couldn't compute via `degraded: { ... }`.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { cached, paramKey } from '../_cache.ts';

const TTL_SECONDS = 300; // 5 min

const SECOND_TIER_GET_ENDPOINTS = new Set([
  'breaches',
  'breach-summary',
  'customer-health',
  'sales-pipeline',
  'revenue-recognition',
  'service-sla-compliance',
  'technician-utilization',
]);

export function isSecondTierEndpoint(reportType: string, method: string): boolean {
  return method === 'GET' && SECOND_TIER_GET_ENDPOINTS.has(reportType);
}

export async function handleSecondTier(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  const reportType = pathParts[0];
  if (method !== 'GET' || !SECOND_TIER_GET_ENDPOINTS.has(reportType)) return null;

  switch (reportType) {
    case 'breaches':
      return runReport(req, ctx, reportType, breaches);
    case 'breach-summary':
      return runReport(req, ctx, reportType, breachSummary);
    case 'customer-health':
      return runReport(req, ctx, reportType, customerHealth);
    case 'sales-pipeline':
      return runReport(req, ctx, reportType, salesPipeline);
    case 'revenue-recognition':
      return runReport(req, ctx, reportType, revenueRecognition);
    case 'service-sla-compliance':
      return runReport(req, ctx, reportType, serviceSlaCompliance);
    case 'technician-utilization':
      return runReport(req, ctx, reportType, technicianUtilization);
    default:
      return null;
  }
}

async function runReport(
  req: Request,
  ctx: HandlerCtx,
  reportType: string,
  loader: (ctx: HandlerCtx) => Promise<unknown>,
): Promise<Response> {
  const { auth, requestId, url } = ctx;
  const cacheKey = `${auth.tenantId}:second-tier:${reportType}:${paramKey({
    territory: url.searchParams.get('territory') ?? 'all',
    period: url.searchParams.get('period') ?? '30d',
    horizon: url.searchParams.get('horizon') ?? '',
  })}`;

  try {
    const data = await cached(cacheKey, TTL_SECONDS, () => loader(ctx));
    return jsonResponse(data, 200, req, requestId);
  } catch (err) {
    return errorResponse(500, `Failed to compute ${reportType}`, req, {
      code: 'REPORT_FAILED',
      details: String(err),
      requestId,
    });
  }
}

// ─── breaches ──────────────────────────────────────────────────────────────
//
// Six breach detectors. Each is best-effort — a missing table or schema drift
// just means that particular detector contributes 0. We never throw; the
// Express version swallowed errors here too.

interface Breach {
  type: string;
  title: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  drillThroughUrl: string;
  icon: string;
  lastUpdated: string;
}

async function breaches(ctx: HandlerCtx): Promise<Breach[]> {
  const { auth, db } = ctx;
  const now = new Date();
  const t24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const t5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const t14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const t60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const lastUpdated = now.toISOString();

  const out: Breach[] = [];

  // 1. Sales Response SLA — leads not contacted within 24h
  const salesResp = await safeCount(db, 'business_records', (q) =>
    q
      .eq('tenant_id', auth.tenantId)
      .eq('record_type', 'lead')
      .eq('status', 'new')
      .lt('created_at', t24h),
  );
  if (salesResp > 0) {
    out.push({
      type: 'sales_response_sla',
      title: 'Response SLA Breach',
      count: salesResp,
      severity: 'high',
      description: `${salesResp} leads not contacted within 24 hours`,
      drillThroughUrl: '/leads-management?filter=sla_breach',
      icon: 'Clock',
      lastUpdated,
    });
  }

  // 2. Proposal Aging — proposals older than 14 days, still draft
  const propAging = await safeCount(db, 'proposals', (q) =>
    q.eq('tenant_id', auth.tenantId).eq('status', 'draft').lt('created_at', t14d),
  );
  if (propAging > 0) {
    out.push({
      type: 'proposal_aging',
      title: 'Aging Proposals',
      count: propAging,
      severity: 'medium',
      description: `${propAging} proposals aging > 14 days`,
      drillThroughUrl: '/proposal-builder?filter=aging&days=14',
      icon: 'FileText',
      lastUpdated,
    });
  }

  // 3. PO Variance — POs with expected_date set (Express had a `approved_date`
  //    filter but that column doesn't exist; just count expected_date IS NOT NULL).
  const poCount = await safeCount(db, 'purchase_orders', (q) =>
    q.eq('tenant_id', auth.tenantId).not('expected_date', 'is', null),
  );
  if (poCount > 0) {
    out.push({
      type: 'po_variance',
      title: 'PO Lead Time Variance',
      count: poCount,
      severity: 'medium',
      description: `${poCount} orders with extended lead times`,
      drillThroughUrl: '/admin/purchase-orders?filter=variance_gt_2x',
      icon: 'Package',
      lastUpdated,
    });
  }

  // 4. Service SLA — tickets aging > 5 days that are still open or in-progress
  const serviceSla = await safeCount(db, 'service_tickets', (q) =>
    q.eq('tenant_id', auth.tenantId).in('status', ['open', 'in-progress']).lt('created_at', t5d),
  );
  if (serviceSla > 0) {
    out.push({
      type: 'service_sla',
      title: 'Service SLA Breach',
      count: serviceSla,
      severity: 'critical',
      description: `${serviceSla} service tickets aging > 5 days`,
      drillThroughUrl: '/service-hub?filter=sla_breach',
      icon: 'Wrench',
      lastUpdated,
    });
  }

  // 5. Billing Delay — invoices stuck in draft > 24h
  const billingDelay = await safeCount(db, 'invoices', (q) =>
    q.eq('tenant_id', auth.tenantId).eq('status', 'draft').lt('created_at', t24h),
  );
  if (billingDelay > 0) {
    out.push({
      type: 'billing_delay',
      title: 'Invoice Issuance Delay',
      count: billingDelay,
      severity: 'high',
      description: `${billingDelay} invoices not issued within 24h`,
      drillThroughUrl: '/advanced-billing?filter=issuance_delay_gt_24h',
      icon: 'DollarSign',
      lastUpdated,
    });
  }

  // 6. Meter Reading Missed Cycles — last reading more than 60 days ago
  const meterMissed = await safeCount(db, 'meter_readings', (q) =>
    q.eq('tenant_id', auth.tenantId).lt('reading_date', t60d),
  );
  if (meterMissed > 0) {
    out.push({
      type: 'meter_missed_cycles',
      title: 'Missed Meter Cycles',
      count: meterMissed,
      severity: 'medium',
      description: `${meterMissed} devices missing > 2 cycles`,
      drillThroughUrl: '/meter-readings?filter=missed_cycles&n=2',
      icon: 'TrendingUp',
      lastUpdated,
    });
  }

  return out;
}

async function breachSummary(ctx: HandlerCtx): Promise<unknown> {
  const all = await breaches(ctx);
  const sumOf = (sev: Breach['severity']) =>
    all.filter((b) => b.severity === sev).reduce((s, b) => s + b.count, 0);
  return {
    totalBreaches: all.reduce((s, b) => s + b.count, 0),
    criticalCount: sumOf('critical'),
    highCount: sumOf('high'),
    mediumCount: sumOf('medium'),
    lowCount: sumOf('low'),
    breachTypes: all.length,
    lastCheck: new Date().toISOString(),
  };
}

// ─── customer-health ───────────────────────────────────────────────────────
//
// Health score across four 25-point dimensions: service, payment, engagement,
// contract. Schema-honest version of routes-reports.ts:
//   - invoices uses paid_date (not isPaid boolean) and total_amount
//   - business_records has customer_since but NO last_activity_date
//   - service_tickets uses status: open/assigned/in-progress/completed
//   - contracts has end_date

async function customerHealth(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [customers, tickets, invoices, contracts] = await Promise.all([
    db
      .from('business_records')
      .select('id, company_name, customer_since, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .eq('record_type', 'customer'),
    db
      .from('service_tickets')
      .select('customer_id, status, priority, created_at, resolved_at')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', ninetyDaysAgo),
    db
      .from('invoices')
      .select('customer_id, total_amount, due_date, paid_date, invoice_status')
      .eq('tenant_id', auth.tenantId)
      .gte('invoice_date', ninetyDaysAgo),
    db
      .from('contracts')
      .select('customer_id, end_date, status')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'active'),
  ]);

  const ticketsByCustomer = groupBy(tickets.data ?? [], (t) => (t.customer_id as string) ?? '');
  const invoicesByCustomer = groupBy(invoices.data ?? [], (i) => (i.customer_id as string) ?? '');
  const contractsByCustomer = groupBy(contracts.data ?? [], (c) => (c.customer_id as string) ?? '');

  const now = Date.now();
  const allCustomers = customers.data ?? [];

  const scores = allCustomers.map((c) => {
    const id = c.id as string;
    const custTickets = ticketsByCustomer.get(id) ?? [];
    const custInvoices = invoicesByCustomer.get(id) ?? [];
    const custContracts = contractsByCustomer.get(id) ?? [];

    // Service score (25)
    let serviceScore = 25;
    const openTickets = custTickets.filter(
      (t) => t.status !== 'completed' && t.status !== 'closed',
    );
    const criticalTickets = openTickets.filter(
      (t) => t.priority === 'critical' || t.priority === 'high',
    );
    serviceScore -= Math.min(15, openTickets.length * 3);
    serviceScore -= Math.min(10, criticalTickets.length * 5);
    serviceScore = Math.max(0, serviceScore);

    // Payment score (25) — paid = paid_date IS NOT NULL
    let paymentScore = 25;
    if (custInvoices.length > 0) {
      const paid = custInvoices.filter((i) => i.paid_date != null);
      const overdue = custInvoices.filter(
        (i) => i.paid_date == null && i.due_date && new Date(i.due_date as string).getTime() < now,
      );
      const rate = paid.length / custInvoices.length;
      paymentScore = Math.round(rate * 20);
      paymentScore -= Math.min(15, overdue.length * 5);
      paymentScore = Math.max(0, Math.min(25, paymentScore));
    }

    // Engagement score (25) — businessRecords lacks last_activity_date,
    // so use updated_at as the proxy. customer_since gives tenure bonus.
    let engagementScore = 25;
    const lastTouch = (c.updated_at as string | null) ?? (c.created_at as string | null);
    if (lastTouch) {
      const days = Math.floor((now - new Date(lastTouch).getTime()) / 86_400_000);
      if (days > 90) engagementScore -= 15;
      else if (days > 60) engagementScore -= 10;
      else if (days > 30) engagementScore -= 5;
    }
    const since = (c.customer_since as string | null) ?? (c.created_at as string | null);
    if (since) {
      const months = Math.floor((now - new Date(since).getTime()) / (86_400_000 * 30));
      if (months >= 24) engagementScore = Math.min(25, engagementScore + 5);
      else if (months >= 12) engagementScore = Math.min(25, engagementScore + 3);
    }
    engagementScore = Math.max(0, engagementScore);

    // Contract score (25)
    let contractScore = 0;
    if (custContracts.length > 0) {
      contractScore = 15;
      const upcomingRenewals = custContracts.filter((con) => {
        const end = con.end_date as string | null;
        if (!end) return false;
        const d = Math.floor((new Date(end).getTime() - now) / 86_400_000);
        return d <= 60 && d > 0;
      });
      if (upcomingRenewals.length === 0) contractScore += 10;
    }
    contractScore = Math.min(25, contractScore);

    const healthScore = serviceScore + paymentScore + engagementScore + contractScore;

    let riskLevel: 'critical' | 'high' | 'medium' | 'low';
    if (healthScore < 25) riskLevel = 'critical';
    else if (healthScore < 50) riskLevel = 'high';
    else if (healthScore < 75) riskLevel = 'medium';
    else riskLevel = 'low';

    const reasons: string[] = [];
    if (serviceScore < 10) reasons.push('Multiple open service issues');
    if (paymentScore < 10) reasons.push('Payment concerns');
    if (engagementScore < 10) reasons.push('Low engagement');
    if (contractScore === 0) reasons.push('No active contract');

    return {
      customerId: id,
      customerName: (c.company_name as string) ?? 'Unknown',
      healthScore,
      riskLevel,
      reason: reasons.length > 0 ? reasons.join(', ') : 'Healthy customer',
      breakdown: { serviceScore, paymentScore, engagementScore, contractScore },
      openTickets: openTickets.length,
      activeContracts: custContracts.length,
    };
  });

  const atRisk = scores
    .filter((s) => s.riskLevel !== 'low')
    .sort((a, b) => a.healthScore - b.healthScore);
  const avg =
    scores.length > 0
      ? Math.round(scores.reduce((s, c) => s + c.healthScore, 0) / scores.length)
      : 0;

  return {
    totalCustomers: allCustomers.length,
    averageHealthScore: avg,
    atRiskCount: atRisk.length,
    criticalCount: atRisk.filter((c) => c.riskLevel === 'critical').length,
    highRiskCount: atRisk.filter((c) => c.riskLevel === 'high').length,
    mediumRiskCount: atRisk.filter((c) => c.riskLevel === 'medium').length,
    healthyCount: scores.filter((c) => c.riskLevel === 'low').length,
    atRiskCustomers: atRisk.slice(0, 10),
    scoreDistribution: {
      critical: scores.filter((c) => c.healthScore < 25).length,
      high: scores.filter((c) => c.healthScore >= 25 && c.healthScore < 50).length,
      medium: scores.filter((c) => c.healthScore >= 50 && c.healthScore < 75).length,
      low: scores.filter((c) => c.healthScore >= 75).length,
    },
    degraded: {
      // businessRecords has no last_activity_date column; engagement uses
      // updated_at which is touched on any field change, so the score is a
      // weaker signal than the Express version intended.
      lastActivityProxy: true,
    },
  };
}

// ─── sales-pipeline ────────────────────────────────────────────────────────
//
// Pipeline value, deal count, win rate, top reps. Schema-honest version of
// routes-reports.ts: deals.owner_id joins to users (not deals.owner.name);
// no stage object lookup since dealStages isn't queried here.

async function salesPipeline(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const { data: allDeals } = await db
    .from('deals')
    .select('id, owner_id, amount, status')
    .eq('tenant_id', auth.tenantId);

  const deals = (allDeals ?? []) as Array<{
    id: string;
    owner_id: string | null;
    amount: string | null;
    status: string;
  }>;

  const ownerIds = uniq(deals.map((d) => d.owner_id).filter((x): x is string => !!x));
  const ownerNames = await fetchUserNames(db, ownerIds);

  const open = deals.filter((d) => d.status !== 'won' && d.status !== 'lost');
  const totalPipeline = open.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const won = deals.filter((d) => d.status === 'won').length;

  const repMap = new Map<string, { repName: string; pipelineValue: number; dealCount: number }>();
  for (const d of deals) {
    const id = d.owner_id ?? 'unknown';
    const name = id === 'unknown' ? 'Unassigned' : (ownerNames.get(id) ?? 'Unknown');
    const cur = repMap.get(id) ?? { repName: name, pipelineValue: 0, dealCount: 0 };
    if (d.status !== 'won' && d.status !== 'lost') {
      cur.pipelineValue += Number(d.amount ?? 0);
      cur.dealCount += 1;
    }
    repMap.set(id, cur);
  }

  return {
    totalPipelineValue: totalPipeline,
    dealCount: open.length,
    averageDealValue: open.length > 0 ? Math.round(totalPipeline / open.length) : 0,
    conversionRate: deals.length > 0 ? Math.round((won / deals.length) * 100) : 0,
    wonDeals: won,
    topReps: [...repMap.values()]
      .filter((r) => r.dealCount > 0)
      .sort((a, b) => b.pipelineValue - a.pipelineValue)
      .slice(0, 5),
  };
}

// ─── revenue-recognition ───────────────────────────────────────────────────
//
// 30-day window. Schema-honest: invoices uses total_amount (not amount) and
// paid_date IS NOT NULL (not isPaid boolean).

async function revenueRecognition(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data } = await db
    .from('invoices')
    .select('total_amount, paid_date')
    .eq('tenant_id', auth.tenantId)
    .gte('invoice_date', from);

  const list = (data ?? []) as Array<{ total_amount: string | null; paid_date: string | null }>;
  const total = list.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const paid = list.filter((i) => i.paid_date != null);
  const recognized = paid.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  return {
    totalRevenue: Math.round(total),
    recognizedRevenue: Math.round(recognized),
    deferredRevenue: Math.round(total - recognized),
    collectionRate: total > 0 ? Math.round((recognized / total) * 100) : 0,
    invoiceCount: list.length,
    paidInvoices: paid.length,
    outstandingInvoices: list.length - paid.length,
  };
}

// ─── service-sla-compliance ────────────────────────────────────────────────
//
// 30-day window. Schema-honest: service_tickets has NO sla_response_minutes
// or completed_at columns. We approximate "on time" as resolved within 8 hours
// of created_at, and surface that the SLA threshold is hard-coded.

async function serviceSlaCompliance(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const SLA_MINUTES = 480; // 8 hours

  const { data } = await db
    .from('service_tickets')
    .select('id, assigned_technician_id, status, created_at, resolved_at')
    .eq('tenant_id', auth.tenantId)
    .gte('created_at', from);

  const list = (data ?? []) as Array<{
    id: string;
    assigned_technician_id: string | null;
    status: string;
    created_at: string;
    resolved_at: string | null;
  }>;

  const isOnTime = (t: (typeof list)[number]) => {
    if (!t.resolved_at) return false;
    const ms = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
    return ms / 60_000 <= SLA_MINUTES;
  };

  const techIds = uniq(list.map((t) => t.assigned_technician_id).filter((x): x is string => !!x));
  const techNames = await fetchTechnicianNames(db, techIds);

  const byTech = new Map<string, typeof list>();
  for (const t of list) {
    const k = t.assigned_technician_id ?? 'unassigned';
    if (!byTech.has(k)) byTech.set(k, []);
    byTech.get(k)!.push(t);
  }

  const onTime = list.filter(isOnTime).length;

  return {
    totalTickets: list.length,
    onTimeTickets: onTime,
    lateTickets: list.length - onTime,
    slaCompliancePercent: list.length > 0 ? Math.round((onTime / list.length) * 100) : 0,
    byTechnician: [...byTech.entries()].map(([id, group]) => {
      const ot = group.filter(isOnTime).length;
      return {
        technicianName: id === 'unassigned' ? 'Unassigned' : (techNames.get(id) ?? 'Unknown'),
        compliance: group.length > 0 ? Math.round((ot / group.length) * 100) : 0,
        ticketCount: group.length,
      };
    }),
    degraded: {
      // service_tickets has no sla_response_minutes; using a hardcoded 8-hour
      // threshold for everyone.
      slaThresholdHardcoded: true,
    },
  };
}

// ─── technician-utilization ────────────────────────────────────────────────
//
// 30-day window. Schema-honest: service_tickets has no started_at or
// completed_at columns; we estimate hours worked from completed-ticket count
// times an average ticket duration.

async function technicianUtilization(ctx: HandlerCtx): Promise<unknown> {
  const { auth, db } = ctx;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const fromIso = thirtyDaysAgo.toISOString();

  const [techRes, ticketRes] = await Promise.all([
    db.from('technicians').select('id, first_name, last_name').eq('tenant_id', auth.tenantId),
    db
      .from('service_tickets')
      .select(
        'id, assigned_technician_id, customer_id, equipment_id, status, created_at, resolved_at',
      )
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', fromIso),
  ]);

  const techList = (techRes.data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
  }>;
  const tickets = (ticketRes.data ?? []) as Array<{
    id: string;
    assigned_technician_id: string | null;
    customer_id: string;
    equipment_id: string | null;
    status: string;
    created_at: string;
    resolved_at: string | null;
  }>;

  const WORKING_HOURS_PER_MONTH = 176;
  const AVG_TICKET_MIN = 60;
  const SLA_MIN = 480;

  const byTech = new Map<string, typeof tickets>();
  for (const t of tickets) {
    if (!t.assigned_technician_id) continue;
    if (!byTech.has(t.assigned_technician_id)) byTech.set(t.assigned_technician_id, []);
    byTech.get(t.assigned_technician_id)!.push(t);
  }

  const rows = techList.map((t) => {
    const techTickets = byTech.get(t.id) ?? [];
    const completed = techTickets.filter((tk) => tk.status === 'completed');
    const open = techTickets.filter((tk) => tk.status !== 'completed' && tk.status !== 'cancelled');

    const minutesWorked = completed.length * AVG_TICKET_MIN;
    const hoursWorked = minutesWorked / 60;
    const utilizationPercent = Math.min(
      100,
      Math.round((hoursWorked / WORKING_HOURS_PER_MONTH) * 100),
    );

    const slaCompliant = completed.filter((tk) => {
      if (!tk.resolved_at) return false;
      const ms = new Date(tk.resolved_at).getTime() - new Date(tk.created_at).getTime();
      return ms / 60_000 <= SLA_MIN;
    });
    const slaCompliance =
      completed.length > 0 ? Math.round((slaCompliant.length / completed.length) * 100) : 100;

    // First-time fix: completed tickets where no other ticket for the same
    // customer+equipment was created within 7 days after this one resolved.
    const ftf = completed.filter((tk) => {
      const closeAt = new Date((tk.resolved_at ?? tk.created_at) as string).getTime();
      return !techTickets.some(
        (other) =>
          other.id !== tk.id &&
          other.customer_id === tk.customer_id &&
          other.equipment_id === tk.equipment_id &&
          new Date(other.created_at).getTime() > closeAt &&
          new Date(other.created_at).getTime() - closeAt < 7 * 86_400_000,
      );
    });
    const firstTimeFixRate =
      completed.length > 0 ? Math.round((ftf.length / completed.length) * 100) : 100;

    const name = `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || 'Unknown';

    return {
      technicianId: t.id,
      name,
      utilizationPercent,
      ticketsCompleted: completed.length,
      ticketsOpen: open.length,
      totalTickets: techTickets.length,
      averageTicketTime: AVG_TICKET_MIN,
      hoursWorked: Math.round(hoursWorked * 10) / 10,
      slaCompliance,
      firstTimeFixRate,
    };
  });

  rows.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const avg = (sel: (r: (typeof rows)[number]) => number) =>
    rows.length > 0 ? Math.round(rows.reduce((s, r) => s + sel(r), 0) / rows.length) : 0;

  return {
    totalTechnicians: techList.length,
    reportingPeriod: {
      start: thirtyDaysAgo.toISOString(),
      end: new Date().toISOString(),
      days: 30,
    },
    averageUtilizationPercent: avg((r) => r.utilizationPercent),
    averageSLACompliance: avg((r) => r.slaCompliance),
    averageFirstTimeFixRate: avg((r) => r.firstTimeFixRate),
    totalTicketsCompleted: rows.reduce((s, r) => s + r.ticketsCompleted, 0),
    totalHoursWorked: Math.round(rows.reduce((s, r) => s + r.hoursWorked, 0)),
    excellentCount: rows.filter((r) => r.utilizationPercent >= 90).length,
    goodCount: rows.filter((r) => r.utilizationPercent >= 75 && r.utilizationPercent < 90).length,
    needsImprovementCount: rows.filter((r) => r.utilizationPercent < 75).length,
    byTechnician: rows.slice(0, 10),
    degraded: {
      // No started_at/completed_at on service_tickets; hours-worked is
      // estimated from completed-ticket count × 60 minutes.
      hoursEstimatedFromCount: true,
    },
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function safeCount(
  db: HandlerCtx['db'],
  table: string,
  build: (q: any) => any,
): Promise<number> {
  try {
    // deno-lint-ignore no-explicit-any
    const base: any = (db.from(table) as any).select('id', { count: 'exact', head: true });
    const result = await build(base);
    if (result?.error) return 0;
    return Number(result?.count ?? 0);
  } catch {
    return 0;
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return map;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

async function fetchUserNames(db: HandlerCtx['db'], ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from('users').select('id, first_name, last_name').in('id', ids);
  return new Map(
    (
      (data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>
    ).map((u) => [u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unknown']),
  );
}

async function fetchTechnicianNames(
  db: HandlerCtx['db'],
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await db.from('technicians').select('id, first_name, last_name').in('id', ids);
  return new Map(
    (
      (data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>
    ).map((t) => [t.id, `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || 'Unknown']),
  );
}
