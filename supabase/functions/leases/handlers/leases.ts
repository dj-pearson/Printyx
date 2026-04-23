// Leases — core resource handler + nested sub-resource forwarders.
//
// Paths (dispatcher stripped /leases):
//   GET    /                                        (list with filters)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   GET    /status/:status                          (by-status filter)
//   GET    /by-customer/:customerId                 (forwarded from /customers/:id/leases)
//
//   GET    /:leaseId/payments                       (forwards to payments.ts)
//   GET    /:leaseId/renewal                        (forwards to renewals.ts)
//   GET    /:leaseId/disposition                    (forwards to dispositions.ts)
//
//   POST   /:id/generate-payment-schedule
//   POST   /:id/initiate-renewal
//   POST   /:id/complete-disposition
//
// Optional ?format=pdf on GET /:id streams a generated lease PDF.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { handlePayments } from './payments.ts';
import { handleRenewals } from './renewals.ts';
import { handleDispositions } from './dispositions.ts';
import { renderLeasePDF } from '../_pdf.ts';

export async function handleLeases(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /status/:status
  if (method === 'GET' && first === 'status' && second) {
    return await listLeases(req, ctx, { status: second });
  }

  // GET /by-customer/:customerId (forwarded from dispatcher)
  if (method === 'GET' && first === 'by-customer' && second) {
    return await listLeases(req, ctx, { customerId: second });
  }

  // Actions + nested subresources: POST /:id/generate-payment-schedule etc.
  if (first && second === 'generate-payment-schedule' && method === 'POST') {
    return await generateSchedule(req, ctx, first);
  }
  if (first && second === 'initiate-renewal' && method === 'POST') {
    return await initiateRenewal(req, ctx, first);
  }
  if (first && second === 'complete-disposition' && method === 'POST') {
    return await completeDisposition(req, ctx, first);
  }

  // Nested-resource forwards
  if (first && second === 'payments' && method === 'GET') {
    return await handlePayments(req, { ...ctx, pathParts: ['for-lease', first] });
  }
  if (first && second === 'renewal' && method === 'GET') {
    return await handleRenewals(req, { ...ctx, pathParts: ['for-lease', first] });
  }
  if (first && second === 'disposition' && method === 'GET') {
    return await handleDispositions(req, { ...ctx, pathParts: ['for-lease', first] });
  }

  // Core CRUD
  if (method === 'GET' && !first) {
    return await listLeases(req, ctx, {
      status: url.searchParams.get('status') ?? undefined,
      customerId:
        url.searchParams.get('customerId') ?? url.searchParams.get('customer_id') ?? undefined,
    });
  }

  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('leases')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch lease', error);
    if (!data) return errorResponse(404, 'Lease not found', req, { code: 'NOT_FOUND', requestId });

    // PDF format?
    if (url.searchParams.get('format') === 'pdf') {
      return await streamPdf(req, ctx, data as Record<string, unknown>);
    }
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapLease(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (
      !row.lease_number ||
      !row.lease_name ||
      !row.customer_id ||
      row.total_amount === undefined
    ) {
      return errorResponse(
        400,
        'lease_number, lease_name, customer_id, total_amount required',
        req,
        {
          code: 'VALIDATION_ERROR',
          requestId,
        },
      );
    }
    const { data, error } = await db.from('leases').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create lease', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapLease(body);
    row.updated_by = auth.userId;
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('leases')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update lease', error);
    if (!data) return errorResponse(404, 'Lease not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && first && !second) {
    const { error } = await db
      .from('leases')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete lease', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// ─── List with filters ───────────────────────────────────────────────────────

async function listLeases(
  req: Request,
  ctx: HandlerCtx,
  filters: { status?: string; customerId?: string },
): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50);
  const offset = (page - 1) * limit;

  let q = db.from('leases').select('*', { count: 'exact' }).eq('tenant_id', auth.tenantId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.customerId) q = q.eq('customer_id', filters.customerId);
  q = q.order('start_date', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) return dbErr(req, requestId, 'Failed to fetch leases', error);
  return jsonResponse({ data: data ?? [], total: count ?? 0, page, limit }, 200, req, requestId);
}

// ─── Payment schedule generation ─────────────────────────────────────────────

async function generateSchedule(req: Request, ctx: HandlerCtx, leaseId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data: lease } = await db
    .from('leases')
    .select('id, term, monthly_payment, first_payment_date')
    .eq('id', leaseId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!lease) {
    return errorResponse(404, 'Lease not found', req, { code: 'NOT_FOUND', requestId });
  }
  if (!lease.first_payment_date || !lease.term) {
    return errorResponse(400, 'Lease is missing term or first_payment_date', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  // Straight-line schedule — one row per month, fixed monthly_payment.
  const start = new Date(lease.first_payment_date as string);
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < Number(lease.term); i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    rows.push({
      tenant_id: auth.tenantId,
      lease_id: lease.id,
      payment_number: i + 1,
      scheduled_date: d.toISOString(),
      scheduled_amount: lease.monthly_payment,
      status: 'scheduled',
    });
  }

  const { data, error } = await db.from('lease_payments').insert(rows).select();
  if (error) return dbErr(req, requestId, 'Failed to generate payment schedule', error);
  return jsonResponse(
    { message: 'Payment schedule generated', payments: data ?? [] },
    201,
    req,
    requestId,
  );
}

// ─── Initiate renewal ────────────────────────────────────────────────────────

async function initiateRenewal(req: Request, ctx: HandlerCtx, leaseId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as {
    renewalTerm?: number;
    renewalMonthlyPayment?: number;
  };

  const { data: lease } = await db
    .from('leases')
    .select('id, end_date, term, monthly_payment')
    .eq('id', leaseId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!lease) return errorResponse(404, 'Lease not found', req, { code: 'NOT_FOUND', requestId });

  const deadline = new Date(lease.end_date as string);
  deadline.setDate(deadline.getDate() - 30);

  const renewal = await db
    .from('lease_renewals')
    .insert({
      tenant_id: auth.tenantId,
      lease_id: lease.id,
      renewal_offered: true,
      renewal_offer_date: new Date().toISOString(),
      renewal_deadline: deadline.toISOString(),
      renewal_term: body.renewalTerm ?? lease.term,
      renewal_monthly_payment: body.renewalMonthlyPayment ?? lease.monthly_payment,
      created_by: auth.userId,
    })
    .select()
    .maybeSingle();
  if (renewal.error) return dbErr(req, requestId, 'Failed to create renewal', renewal.error);

  await db
    .from('leases')
    .update({
      status: 'pending_renewal',
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lease.id)
    .eq('tenant_id', auth.tenantId);

  return jsonResponse({ message: 'Renewal initiated', renewal: renewal.data }, 201, req, requestId);
}

// ─── Complete disposition ────────────────────────────────────────────────────

async function completeDisposition(
  req: Request,
  ctx: HandlerCtx,
  leaseId: string,
): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const { data: lease } = await db
    .from('leases')
    .select('id')
    .eq('id', leaseId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!lease) return errorResponse(404, 'Lease not found', req, { code: 'NOT_FOUND', requestId });

  const action = String(body.action ?? '').toLowerCase();
  if (!action) {
    return errorResponse(400, 'action is required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const disposition = await db
    .from('lease_dispositions')
    .insert({
      ...body,
      tenant_id: auth.tenantId,
      lease_id: lease.id,
      action,
      action_date: (body.actionDate as string) ?? new Date().toISOString(),
      final_status: 'completed',
      completion_date: new Date().toISOString(),
      created_by: auth.userId,
    })
    .select()
    .maybeSingle();
  if (disposition.error) {
    return dbErr(req, requestId, 'Failed to create disposition', disposition.error);
  }

  // Map action → new lease status (mirrors Express)
  const newStatus = action === 'renew' ? 'renewed' : action === 'purchase' ? 'active' : 'expired';
  await db
    .from('leases')
    .update({ status: newStatus, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq('id', lease.id)
    .eq('tenant_id', auth.tenantId);

  return jsonResponse(
    { message: 'Disposition completed', disposition: disposition.data },
    201,
    req,
    requestId,
  );
}

// ─── PDF streaming ───────────────────────────────────────────────────────────

async function streamPdf(
  req: Request,
  ctx: HandlerCtx,
  lease: Record<string, unknown>,
): Promise<Response> {
  const { auth, db, requestId } = ctx;

  // Pull the payment schedule so the PDF shows real rows.
  const { data: payments } = await db
    .from('lease_payments')
    .select('payment_number, scheduled_date, scheduled_amount, status, paid_amount, paid_date')
    .eq('tenant_id', auth.tenantId)
    .eq('lease_id', lease.id as string)
    .order('payment_number', { ascending: true });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderLeasePDF({
      lease: lease as Parameters<typeof renderLeasePDF>[0]['lease'],
      payments: (payments ?? []) as Parameters<typeof renderLeasePDF>[0]['payments'],
    });
  } catch (err) {
    return errorResponse(500, 'Failed to render lease PDF', req, {
      code: 'PDF_RENDER_ERROR',
      details: err instanceof Error ? err.message : String(err),
      requestId,
    });
  }

  const filename = `Lease-${lease.lease_number ?? lease.id}.pdf`;
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'X-Request-ID': requestId,
    },
  });
}

// ─── Field mapping ───────────────────────────────────────────────────────────

function mapLease(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('lease_number', 'leaseNumber', 'lease_number');
  set('lease_name', 'leaseName', 'lease_name');
  set('customer_id', 'customerId', 'customer_id');
  set('business_record_id', 'businessRecordId', 'business_record_id');
  set('proposal_id', 'proposalId', 'proposal_id');
  set('contract_id', 'contractId', 'contract_id');
  set('lease_type', 'leaseType', 'lease_type');
  if (body.status !== undefined) r.status = body.status;
  set('total_amount', 'totalAmount', 'total_amount');
  set('monthly_payment', 'monthlyPayment', 'monthly_payment');
  if (body.term !== undefined) r.term = body.term;
  set('interest_rate', 'interestRate', 'interest_rate');
  set('residual_value', 'residualValue', 'residual_value');
  set('buyout_amount', 'buyoutAmount', 'buyout_amount');
  set('start_date', 'startDate', 'start_date');
  set('end_date', 'endDate', 'end_date');
  set('first_payment_date', 'firstPaymentDate', 'first_payment_date');
  set('last_payment_date', 'lastPaymentDate', 'last_payment_date');
  set('equipment_ids', 'equipmentIds', 'equipment_ids');
  set('payment_method', 'paymentMethod', 'payment_method');
  set('payment_day_of_month', 'paymentDayOfMonth', 'payment_day_of_month');
  set('auto_pay_enabled', 'autoPayEnabled', 'auto_pay_enabled');
  set('insurance_required', 'insuranceRequired', 'insurance_required');
  set('maintenance_included', 'maintenanceIncluded', 'maintenance_included');
  if (body.taxable !== undefined) r.taxable = body.taxable;
  set('sales_tax_rate', 'salesTaxRate', 'sales_tax_rate');
  set('renewal_option', 'renewalOption', 'renewal_option');
  set('renewal_notice_months', 'renewalNoticeMonths', 'renewal_notice_months');
  set('early_termination_allowed', 'earlyTerminationAllowed', 'early_termination_allowed');
  set('early_termination_penalty', 'earlyTerminationPenalty', 'early_termination_penalty');
  set('document_url', 'documentUrl', 'document_url');
  set('e_signature_id', 'eSignatureId', 'e_signature_id');
  set('lessor_name', 'lessorName', 'lessor_name');
  set('lessor_contact_name', 'lessorContactName', 'lessor_contact_name');
  set('lessor_contact_email', 'lessorContactEmail', 'lessor_contact_email');
  set('lessor_contact_phone', 'lessorContactPhone', 'lessor_contact_phone');
  set('lessor_account_number', 'lessorAccountNumber', 'lessor_account_number');
  if (body.notes !== undefined) r.notes = body.notes;
  set('special_terms', 'specialTerms', 'special_terms');
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
