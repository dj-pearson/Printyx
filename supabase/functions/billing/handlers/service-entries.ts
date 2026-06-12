// POST /billing/service-entries — technician service-call billing entry (EDGE-002a).
//
// NO Express implementation ever existed for this endpoint — the only caller
// is client/src/components/service/TechnicianTicketWorkflow.tsx, which posts a
// camelCase billing entry on ticket completion and only needs `{ id }` back
// (it navigates to /advanced-billing?serviceEntryId=<id>). Rather than a stub,
// this creates a real DRAFT service invoice in the `invoices` table so the
// "Customer will receive invoice within 24 hours" flow is reviewable in the
// billing pages instead of vanishing:
//   - invoice_type 'service', invoice_status/status 'draft' (never auto-sent)
//   - external_customer_id carries the service ticket id — the invoices list
//     already treats that column as ticketId (?ticketId= filter)
//   - a line item records labor hours/rate + parts cost when provided

import { createCorsResponse } from '../../_shared/cors.ts';
import { type BillingCtx, mapInvoiceRow, num } from './_context.ts';

export async function handleServiceEntries(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId, user } = ctx;
  if (req.method !== 'POST') return null;

  const body = await req.json();

  if (!body.customerId) {
    return createCorsResponse({ error: 'customerId is required' }, 400, req);
  }

  const laborHours = num(body.laborHours);
  const laborRate = num(body.laborRate);
  const partsCost = num(body.partsCost);
  const totalAmount =
    body.totalAmount != null ? num(body.totalAmount) : laborHours * laborRate + partsCost;

  const now = new Date();
  const description = body.description || 'Service call';
  const invoiceRow = {
    tenant_id: tenantId,
    customer_id: String(body.customerId),
    invoice_number: `SVC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    invoice_date: (body.serviceDate ? new Date(body.serviceDate) : now).toISOString(),
    due_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    invoice_type: 'service',
    invoice_status: 'draft',
    status: 'draft',
    total_amount: totalAmount.toFixed(2),
    amount_paid: '0',
    balance_due: totalAmount.toFixed(2),
    payment_terms: 'Net 30',
    invoice_notes: body.serviceTicketId
      ? `${description} (service ticket ${body.serviceTicketId})`
      : description,
    external_customer_id: body.serviceTicketId ? String(body.serviceTicketId) : null,
    created_by: user.id,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data: invoice, error } = await admin
    .from('invoices')
    .insert(invoiceRow)
    .select()
    .single();

  if (error) {
    console.error('Error creating service billing entry:', error);
    return createCorsResponse({ error: 'Failed to create service billing entry' }, 500, req);
  }

  // Best-effort labor/parts line item — the draft invoice total is already set.
  const lineDescription =
    `Labor: ${laborHours}h @ $${laborRate.toFixed(2)}/h` +
    (partsCost > 0 ? ` + parts $${partsCost.toFixed(2)}` : '');
  const { error: lineError } = await admin.from('invoice_line_items').insert({
    tenant_id: tenantId,
    invoice_id: invoice.id,
    line_description: lineDescription,
    quantity: 1,
    unit_price: totalAmount.toFixed(2),
    extended_price: totalAmount.toFixed(2),
  });
  if (lineError) {
    console.error('Service entry line item insert failed (continuing):', lineError);
  }

  return createCorsResponse(mapInvoiceRow(invoice), 201, req);
}
