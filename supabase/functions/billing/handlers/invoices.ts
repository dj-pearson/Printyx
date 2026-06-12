// /billing/invoices/:id sub-resources (EDGE-002a).
//
// Ported from server/routes/billing.ts (consolidated router) onto the REAL
// `invoices` schema columns (see _context.ts schema audit — the Express
// handlers referenced phantom columns like `balance`/`paid`/`total`; here we
// use balance_due / amount_paid / total_amount and map camelCase out).
//
//   GET    /billing/invoices/:id                    → invoice + lineItems + customer fields
//   PATCH  /billing/invoices/:id  (also PUT)        → partial update (camelCase accepted)
//   POST   /billing/invoices/:id/pay  (PATCH /paid) → record payment
//   POST   /billing/invoices/:id/email (PATCH /send)→ SendGrid email + optional PDF attach
//   GET    /billing/invoices/:id/pdf                → binary PDF (watermarked by status)
//   POST   /billing/invoices/generate-from-contract → create invoice from contract base
//
// generate-from-contract had NO Express route either (frontend-only URL from
// client/src/pages/Invoices.tsx) — implemented here against contracts.monthly_base.

import { createCorsResponse, getCorsHeaders } from '../../_shared/cors.ts';
import { sendEmail } from '../../email-marketing/_sendgrid.ts';
import { renderInvoicePDF } from '../_pdf.ts';
import { type BillingCtx, mapInvoiceRow, num } from './_context.ts';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchInvoice(ctx: BillingCtx, invoiceId: string): Promise<Row | null> {
  const { data } = await ctx.admin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  return data ?? null;
}

async function fetchCustomer(ctx: BillingCtx, customerId: string | null): Promise<Row | null> {
  if (!customerId) return null;
  const { data } = await ctx.admin
    .from('business_records')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  return data ?? null;
}

async function fetchLineItems(ctx: BillingCtx, invoiceId: string): Promise<Row[]> {
  const { data } = await ctx.admin
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', ctx.tenantId);
  return data ?? [];
}

function watermarkFor(invoice: Row): string | undefined {
  const status = invoice.invoice_status ?? invoice.status;
  if (status === 'draft') return 'DRAFT';
  if (status === 'paid') return 'PAID';
  if (invoice.due_date && new Date(invoice.due_date) < new Date()) return 'OVERDUE';
  return undefined;
}

export async function handleInvoiceSubResource(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId, parts } = ctx;
  const invoiceId = parts[1];
  const action = parts[2];

  if (!invoiceId) return null;

  // ── POST /invoices/generate-from-contract ────────────────────────────────
  if (req.method === 'POST' && invoiceId === 'generate-from-contract') {
    const body = await req.json();
    if (!body.contractId) {
      return createCorsResponse({ error: 'contractId is required' }, 400, req);
    }

    const { data: contract } = await admin
      .from('contracts')
      .select('*')
      .eq('id', body.contractId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!contract) {
      return createCorsResponse({ error: 'Contract not found' }, 404, req);
    }

    const now = new Date();
    const periodStart = body.billingPeriodStart
      ? new Date(body.billingPeriodStart)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = body.billingPeriodEnd ? new Date(body.billingPeriodEnd) : now;
    const amount = num(contract.monthly_base);

    const { data: invoice, error } = await admin
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        customer_id: String(contract.customer_id),
        contract_id: contract.id,
        invoice_number: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        invoice_date: now.toISOString(),
        due_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        billing_period_start: periodStart.toISOString(),
        billing_period_end: periodEnd.toISOString(),
        total_amount: amount.toFixed(2),
        amount_paid: '0',
        balance_due: amount.toFixed(2),
        invoice_status: 'open',
        status: 'open',
        payment_terms: 'Net 30',
        monthly_base: contract.monthly_base ?? null,
        invoice_notes: `Generated from contract ${contract.contract_number ?? contract.id}`,
        created_by: ctx.user.id,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error generating invoice from contract:', error);
      return createCorsResponse({ error: 'Failed to generate invoice' }, 500, req);
    }
    return createCorsResponse(mapInvoiceRow(invoice), 201, req);
  }

  // ── GET /invoices/:id/pdf ─────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'pdf') {
    const invoice = await fetchInvoice(ctx, invoiceId);
    if (!invoice) return createCorsResponse({ error: 'Invoice not found' }, 404, req);

    const customer = await fetchCustomer(ctx, invoice.customer_id);
    const lineItems = await fetchLineItems(ctx, invoiceId);

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await renderInvoicePDF({
        invoice,
        customer,
        lineItems,
        watermark: watermarkFor(invoice),
      });
    } catch (renderErr) {
      console.error('Invoice PDF render failed:', renderErr);
      return createCorsResponse({ error: 'Failed to render invoice PDF' }, 500, req);
    }

    const filename = `Invoice-${invoice.invoice_number ?? invoiceId}.pdf`;
    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        ...getCorsHeaders(req.headers.get('origin')),
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.byteLength),
      },
    });
  }

  // ── POST /invoices/:id/email | PATCH /invoices/:id/send ─────────────────
  if (
    (req.method === 'POST' && action === 'email') ||
    (req.method === 'PATCH' && action === 'send')
  ) {
    const body = await req.json().catch(() => ({}));
    const { recipientEmail, customMessage, includeAttachment = true } = body;

    const invoice = await fetchInvoice(ctx, invoiceId);
    if (!invoice) return createCorsResponse({ error: 'Invoice not found' }, 404, req);
    const customer = await fetchCustomer(ctx, invoice.customer_id);

    const toEmail = recipientEmail || customer?.primary_contact_email || customer?.email;
    if (!toEmail) {
      return createCorsResponse(
        {
          error: 'No recipient email available',
          message: 'Please provide a recipient email or ensure customer has an email on file',
        },
        400,
        req,
      );
    }

    const attachments = [];
    if (includeAttachment) {
      try {
        const lineItems = await fetchLineItems(ctx, invoiceId);
        const pdfBytes = await renderInvoicePDF({
          invoice,
          customer,
          lineItems,
          watermark: watermarkFor(invoice),
        });
        attachments.push({
          content: bytesToBase64(pdfBytes),
          filename: `Invoice-${invoice.invoice_number ?? invoiceId}.pdf`,
          type: 'application/pdf',
        });
      } catch (renderErr) {
        console.error('Invoice PDF render for email failed:', renderErr);
        return createCorsResponse({ error: 'Failed to render invoice PDF' }, 500, req);
      }
    }

    const customerName = customer?.company_name || 'valued customer';
    const amountDue = num(invoice.balance_due ?? invoice.total_amount);
    const safeMessage = customMessage
      ? String(customMessage).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      : 'Please find attached your invoice for recent services.';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #1F2937; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Invoice from Printyx</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <p>Hello ${customerName},</p>
          <p>${safeMessage}</p>
          <div style="background-color: white; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <p><strong>Invoice Number:</strong> ${invoice.invoice_number ?? invoiceId}</p>
            <p><strong>Due Date:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}</p>
            <p style="font-size: 1.2em;"><strong>Amount Due:</strong> $${amountDue.toFixed(2)}</p>
          </div>
          <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
          <p>Thank you for your business!</p>
          <p>Best regards,<br>The Printyx Team</p>
        </div>
      </div>`;

    let emailResult;
    try {
      emailResult = await sendEmail({
        to: toEmail,
        from:
          Deno.env.get('BILLING_FROM_EMAIL') ||
          Deno.env.get('DEFAULT_FROM_EMAIL') ||
          'billing@printyx.com',
        fromName: 'Printyx Billing',
        subject: `Invoice ${invoice.invoice_number ?? invoiceId} from Printyx`,
        html: emailHtml,
        text: `Invoice ${invoice.invoice_number ?? invoiceId}\n\nAmount Due: $${amountDue.toFixed(2)}\nDue Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}`,
        attachments,
      });
    } catch (sendErr) {
      console.error('Invoice email send failed:', sendErr);
      return createCorsResponse(
        { error: 'Failed to send email', message: String(sendErr) },
        500,
        req,
      );
    }

    const { data: updatedInvoice } = await admin
      .from('invoices')
      .update({
        status: 'sent',
        invoice_status: 'sent',
        issued_at: invoice.issued_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    return createCorsResponse(
      {
        message: 'Invoice sent successfully',
        invoice: updatedInvoice ? mapInvoiceRow(updatedInvoice) : null,
        sentTo: toEmail,
        messageId: emailResult.messageId,
        ...(emailResult.simulated && { simulated: true }),
      },
      200,
      req,
    );
  }

  // ── POST /invoices/:id/pay | PATCH /invoices/:id/paid ───────────────────
  if (
    (req.method === 'POST' && action === 'pay') ||
    (req.method === 'PATCH' && action === 'paid')
  ) {
    const body = await req.json().catch(() => ({}));
    const { paymentDate, paymentMethod, paymentNotes, amount } = body;

    const invoice = await fetchInvoice(ctx, invoiceId);
    if (!invoice) return createCorsResponse({ error: 'Invoice not found' }, 404, req);

    const totalAmount = num(invoice.total_amount);
    const paymentAmount =
      amount != null ? num(amount) : num(invoice.balance_due ?? invoice.total_amount);
    const newPaid = num(invoice.amount_paid) + paymentAmount;
    const newBalance = totalAmount - newPaid;
    const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'open';

    // The invoices schema has no payment_method/notes columns — record the
    // payment context in invoice_notes so it isn't silently dropped.
    const paymentNote = `Payment of $${paymentAmount.toFixed(2)} recorded ${
      paymentDate ? new Date(paymentDate).toLocaleDateString() : new Date().toLocaleDateString()
    }${paymentMethod ? ` via ${paymentMethod}` : ''}${paymentNotes ? ` — ${paymentNotes}` : ''}`;

    const { data: updated, error } = await admin
      .from('invoices')
      .update({
        invoice_status: newStatus,
        status: newStatus,
        amount_paid: newPaid.toFixed(2),
        balance_due: newBalance.toFixed(2),
        paid_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
        invoice_notes: invoice.invoice_notes
          ? `${invoice.invoice_notes}\n${paymentNote}`
          : paymentNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error recording invoice payment:', error);
      return createCorsResponse({ error: 'Failed to mark invoice as paid' }, 500, req);
    }
    return createCorsResponse(mapInvoiceRow(updated), 200, req);
  }

  if (action) return null; // unknown sub-action — let the dispatcher 405

  // ── GET /invoices/:id ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const invoice = await fetchInvoice(ctx, invoiceId);
    if (!invoice) return createCorsResponse({ error: 'Invoice not found' }, 404, req);

    const customer = await fetchCustomer(ctx, invoice.customer_id);
    const lineItems = await fetchLineItems(ctx, invoiceId);

    return createCorsResponse({ ...mapInvoiceRow(invoice, customer), lineItems }, 200, req);
  }

  // ── PATCH/PUT /invoices/:id ──────────────────────────────────────────────
  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = await req.json();

    const invoice = await fetchInvoice(ctx, invoiceId);
    if (!invoice) return createCorsResponse({ error: 'Invoice not found' }, 404, req);

    const update: Row = { updated_at: new Date().toISOString() };
    // `status` updates mirror to invoice_status — they are the legacy/new pair
    // and the list views read invoice_status while Invoices.tsx sends status.
    if (body.status !== undefined) {
      update.status = body.status;
      update.invoice_status = body.status;
    }
    if (body.invoiceStatus !== undefined) update.invoice_status = body.invoiceStatus;
    const fieldMap: Record<string, string> = {
      invoiceNumber: 'invoice_number',
      invoiceDate: 'invoice_date',
      dueDate: 'due_date',
      paymentTerms: 'payment_terms',
      poNumber: 'po_number',
      invoiceType: 'invoice_type',
      totalAmount: 'total_amount',
      amountPaid: 'amount_paid',
      balanceDue: 'balance_due',
      billingPeriodStart: 'billing_period_start',
      billingPeriodEnd: 'billing_period_end',
      invoiceNotes: 'invoice_notes',
      notes: 'invoice_notes',
      description: 'invoice_notes',
    };
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (body[camel] !== undefined) update[snake] = body[camel];
    }

    const { data: updated, error } = await admin
      .from('invoices')
      .update(update)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating invoice:', error);
      return createCorsResponse({ error: 'Failed to update invoice' }, 500, req);
    }
    return createCorsResponse(mapInvoiceRow(updated), 200, req);
  }

  // ── DELETE /invoices/:id (drafts only) ───────────────────────────────────
  if (req.method === 'DELETE') {
    const invoice = await fetchInvoice(ctx, invoiceId);
    if (!invoice) return createCorsResponse({ error: 'Invoice not found' }, 404, req);

    if (invoice.status !== 'draft' && invoice.invoice_status !== 'draft') {
      return createCorsResponse({ error: 'Only draft invoices can be deleted' }, 400, req);
    }

    await admin
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId);
    const { error } = await admin
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error deleting invoice:', error);
      return createCorsResponse({ error: 'Failed to delete invoice' }, 500, req);
    }
    return createCorsResponse({ message: 'Invoice deleted successfully' }, 200, req);
  }

  return null;
}
