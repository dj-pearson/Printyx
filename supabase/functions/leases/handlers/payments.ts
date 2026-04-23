// Lease payments.
//
// Paths (dispatcher stripped /lease-payments):
//   GET    /upcoming       (scheduled_date within N days, status='scheduled')
//   GET    /past-due       (scheduled_date < now, status != completed)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   POST   /:id/process    — mark completed + update lease totals
//
// Also invoked via /leases/:leaseId/payments with pathParts=['for-lease', leaseId].

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handlePayments(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // Forwarded from /leases/:leaseId/payments
  if (method === 'GET' && first === 'for-lease' && second) {
    const { data, error } = await db
      .from('lease_payments')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('lease_id', second)
      .order('payment_number', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch lease payments', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && first === 'upcoming') {
    const days = Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10) || 30);
    const cutoff = new Date(Date.now() + days * 86400000).toISOString();
    const { data, error } = await db
      .from('lease_payments')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', new Date().toISOString())
      .lte('scheduled_date', cutoff)
      .order('scheduled_date', { ascending: true })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch upcoming', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && first === 'past-due') {
    const { data, error } = await db
      .from('lease_payments')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .lt('scheduled_date', new Date().toISOString())
      .not('status', 'in', '(completed,refunded)')
      .order('scheduled_date', { ascending: true })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch past-due', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /:id/process
  if (method === 'POST' && first && second === 'process') {
    return await processPayment(req, ctx, first);
  }

  // POST / — manual payment row insert
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapPayment(body);
    row.tenant_id = auth.tenantId;
    if (
      !row.lease_id ||
      row.payment_number === undefined ||
      !row.scheduled_date ||
      row.scheduled_amount === undefined
    ) {
      return errorResponse(
        400,
        'lease_id, payment_number, scheduled_date, scheduled_amount required',
        req,
        {
          code: 'VALIDATION_ERROR',
          requestId,
        },
      );
    }
    const { data, error } = await db.from('lease_payments').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create payment', error);
    return jsonResponse(data, 201, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('lease_payments')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch payment', error);
    if (!data)
      return errorResponse(404, 'Payment not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first && !second) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapPayment(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('lease_payments')
      .update(row)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update payment', error);
    if (!data)
      return errorResponse(404, 'Payment not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // DELETE /:id
  if (method === 'DELETE' && first && !second) {
    const { error } = await db
      .from('lease_payments')
      .delete()
      .eq('id', first)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete payment', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

async function processPayment(req: Request, ctx: HandlerCtx, paymentId: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const { data: payment } = await db
    .from('lease_payments')
    .select('id, lease_id, scheduled_amount')
    .eq('id', paymentId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!payment)
    return errorResponse(404, 'Payment not found', req, { code: 'NOT_FOUND', requestId });

  const updateRow: Record<string, unknown> = {
    status: 'completed',
    paid_date: new Date().toISOString(),
    paid_amount: payment.scheduled_amount,
    updated_at: new Date().toISOString(),
  };
  if (body.paymentMethod ?? body.payment_method)
    updateRow.payment_method = body.paymentMethod ?? body.payment_method;
  if (body.confirmationNumber ?? body.confirmation_number)
    updateRow.confirmation_number = body.confirmationNumber ?? body.confirmation_number;
  if (body.transactionId ?? body.transaction_id)
    updateRow.transaction_id = body.transactionId ?? body.transaction_id;
  if (body.invoiceId ?? body.invoice_id) updateRow.invoice_id = body.invoiceId ?? body.invoice_id;
  if (body.principal !== undefined) updateRow.principal = body.principal;
  if (body.interest !== undefined) updateRow.interest = body.interest;
  if (body.tax !== undefined) updateRow.tax = body.tax;
  if (body.fees !== undefined) updateRow.fees = body.fees;

  const { data: updated, error: updErr } = await db
    .from('lease_payments')
    .update(updateRow)
    .eq('id', paymentId)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();
  if (updErr) return dbErr(req, requestId, 'Failed to mark payment complete', updErr);

  // Bump lease totals (race-tolerant — cosmetic counter)
  const { data: lease } = await db
    .from('leases')
    .select('payments_completed, total_paid')
    .eq('id', payment.lease_id as string)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (lease) {
    await db
      .from('leases')
      .update({
        payments_completed: ((lease.payments_completed as number | null) ?? 0) + 1,
        total_paid:
          parseFloat(String(lease.total_paid ?? '0')) +
          parseFloat(String(payment.scheduled_amount ?? '0')),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.lease_id as string)
      .eq('tenant_id', auth.tenantId);
  }

  return jsonResponse(updated, 200, req, requestId);
}

function mapPayment(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('lease_id', 'leaseId', 'lease_id');
  set('payment_number', 'paymentNumber', 'payment_number');
  set('scheduled_date', 'scheduledDate', 'scheduled_date');
  set('scheduled_amount', 'scheduledAmount', 'scheduled_amount');
  set('paid_date', 'paidDate', 'paid_date');
  set('paid_amount', 'paidAmount', 'paid_amount');
  if (body.status !== undefined) r.status = body.status;
  set('payment_method', 'paymentMethod', 'payment_method');
  set('confirmation_number', 'confirmationNumber', 'confirmation_number');
  set('transaction_id', 'transactionId', 'transaction_id');
  set('invoice_id', 'invoiceId', 'invoice_id');
  set('payment_integration_id', 'paymentIntegrationId', 'payment_integration_id');
  if (body.principal !== undefined) r.principal = body.principal;
  if (body.interest !== undefined) r.interest = body.interest;
  if (body.tax !== undefined) r.tax = body.tax;
  if (body.fees !== undefined) r.fees = body.fees;
  set('failure_reason', 'failureReason', 'failure_reason');
  if (body.notes !== undefined) r.notes = body.notes;
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
