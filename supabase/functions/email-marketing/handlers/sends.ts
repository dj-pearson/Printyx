// Email sends — dispatch via SendGrid + persist + event listing.
//
// Paths (dispatcher stripped /email-marketing/email-sends):
//   GET    /:id
//   POST   /                — single send (SendGrid call + persist)
//   POST   /bulk            — batch send, cap 500 recipients
//   PATCH  /:id             — status update (e.g. manual requeue)
//   GET    /:sendId/events  — per-send event timeline

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { sendEmail, sendBulk, SendGridError } from '../_sendgrid.ts';

const MAX_BULK = 500;

export async function handleSends(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // POST /bulk
  if (method === 'POST' && first === 'bulk') {
    return await bulkSend(req, ctx);
  }

  // GET /:sendId/events
  if (method === 'GET' && first && second === 'events') {
    const { data, error } = await db
      .from('email_events')
      .select('*')
      .eq('email_send_id', first)
      .eq('tenant_id', auth.tenantId)
      .order('event_timestamp', { ascending: false });
    if (error) return dbError(req, requestId, 'Failed to fetch events', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:id
  if (method === 'GET' && first && !second) {
    const { data, error } = await db
      .from('email_sends')
      .select('*')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to fetch send', error);
    if (!data) return errorResponse(404, 'Send not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  // POST / — single
  if (method === 'POST' && !first) {
    return await singleSend(req, ctx);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) patch.status = body.status;
    if (body.providerStatus !== undefined || body.provider_status !== undefined)
      patch.provider_status = body.providerStatus ?? body.provider_status;
    if (body.errorMessage !== undefined || body.error_message !== undefined)
      patch.error_message = body.errorMessage ?? body.error_message;
    const { data, error } = await db
      .from('email_sends')
      .update(patch)
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to update send', error);
    if (!data) return errorResponse(404, 'Send not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

// ─── Single send ──────────────────────────────────────────────────────────────

async function singleSend(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });

  const campaignId = (body.campaignId ?? body.campaign_id) as string | undefined;
  const recipientEmail = (body.recipientEmail ?? body.recipient_email ?? body.to) as
    | string
    | undefined;
  const subject = body.subject as string | undefined;
  const htmlContent = (body.htmlContent ?? body.html_content ?? body.html) as string | undefined;
  const textContent = (body.textContent ?? body.text_content ?? body.text) as string | undefined;
  const senderEmail = (body.senderEmail ?? body.sender_email ?? body.from) as string | undefined;
  const senderName = (body.senderName ?? body.sender_name) as string | undefined;
  const recipientName = (body.recipientName ?? body.recipient_name) as string | undefined;
  const replyTo = (body.replyTo ?? body.reply_to_email) as string | undefined;
  const templateId = (body.templateId ?? body.template_id) as string | undefined;

  if (!campaignId || !recipientEmail || !subject || !htmlContent || !senderEmail) {
    return errorResponse(
      400,
      'campaignId, recipientEmail, subject, htmlContent, senderEmail are required',
      req,
      { code: 'VALIDATION_ERROR', requestId },
    );
  }

  // Create the email_sends row first so we have a stable id to pass to
  // SendGrid as a custom_arg — webhook events can then resolve back to it.
  const nowIso = new Date().toISOString();
  const insertRow = {
    tenant_id: auth.tenantId,
    campaign_id: campaignId,
    template_id: templateId ?? null,
    recipient_email: recipientEmail,
    recipient_name: recipientName ?? null,
    contact_id: (body.contactId ?? body.contact_id ?? null) as string | null,
    subject,
    html_content: htmlContent,
    text_content: textContent ?? null,
    merge_data: (body.mergeData ?? body.merge_data ?? null) as Record<string, unknown> | null,
    status: 'queued',
    queued_at: nowIso,
  };
  const { data: send, error: insErr } = await db
    .from('email_sends')
    .insert(insertRow)
    .select()
    .maybeSingle();
  if (insErr || !send) return dbError(req, requestId, 'Failed to queue send', insErr);

  // Dispatch to SendGrid (or simulation).
  try {
    const result = await sendEmail({
      to: recipientEmail,
      from: senderEmail,
      fromName: senderName,
      subject,
      html: htmlContent,
      text: textContent,
      replyTo,
      customArgs: {
        email_send_id: send.id,
        campaign_id: campaignId,
        tenant_id: auth.tenantId,
      },
    });
    await db
      .from('email_sends')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sendgrid_message_id: result.messageId,
        provider_status: result.simulated ? 'simulated' : 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', send.id)
      .eq('tenant_id', auth.tenantId);
    return jsonResponse(
      {
        ...send,
        status: 'sent',
        sendgrid_message_id: result.messageId,
        simulated: !!result.simulated,
      },
      201,
      req,
      requestId,
    );
  } catch (err) {
    const status = err instanceof SendGridError ? 502 : 500;
    await db
      .from('email_sends')
      .update({
        status: 'failed',
        provider_status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('id', send.id)
      .eq('tenant_id', auth.tenantId);
    return errorResponse(status, 'SendGrid dispatch failed', req, {
      code: 'SENDGRID_ERROR',
      details: err instanceof Error ? err.message : String(err),
      requestId,
    });
  }
}

// ─── Bulk send ────────────────────────────────────────────────────────────────

async function bulkSend(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => null)) as {
    campaignId?: string;
    recipients?: Array<{
      email: string;
      name?: string;
      contactId?: string;
      mergeData?: Record<string, string>;
    }>;
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    senderEmail?: string;
    senderName?: string;
    replyTo?: string;
    templateId?: string;
  } | null;

  if (
    !body?.campaignId ||
    !Array.isArray(body?.recipients) ||
    body!.recipients.length === 0 ||
    !body?.subject ||
    !body?.htmlContent ||
    !body?.senderEmail
  ) {
    return errorResponse(
      400,
      'campaignId, recipients, subject, htmlContent, senderEmail are required',
      req,
      { code: 'VALIDATION_ERROR', requestId },
    );
  }
  if (body!.recipients.length > MAX_BULK) {
    return errorResponse(400, `recipients count exceeds limit of ${MAX_BULK}`, req, {
      code: 'BATCH_TOO_LARGE',
      requestId,
    });
  }

  // Create all email_sends rows up-front so each has a stable id to pass as
  // custom_args to SendGrid.
  const nowIso = new Date().toISOString();
  const sendRows = body!.recipients.map((r) => ({
    tenant_id: auth.tenantId,
    campaign_id: body!.campaignId!,
    template_id: body!.templateId ?? null,
    recipient_email: r.email,
    recipient_name: r.name ?? null,
    contact_id: r.contactId ?? null,
    subject: body!.subject!,
    html_content: body!.htmlContent!,
    text_content: body!.textContent ?? null,
    merge_data: r.mergeData ?? null,
    status: 'queued',
    queued_at: nowIso,
  }));

  const { data: inserted, error: insErr } = await db.from('email_sends').insert(sendRows).select();
  if (insErr || !inserted) return dbError(req, requestId, 'Failed to queue bulk sends', insErr);

  const insertedRows = inserted as Array<{ id: string; recipient_email: string }>;

  try {
    const bulk = await sendBulk(
      {
        from: body!.senderEmail,
        fromName: body!.senderName,
        subject: body!.subject,
        html: body!.htmlContent,
        text: body!.textContent,
        replyTo: body!.replyTo,
      },
      insertedRows.map((row, i) => ({
        to: row.recipient_email,
        name: body!.recipients[i]?.name,
        customArgs: {
          email_send_id: row.id,
          campaign_id: body!.campaignId!,
          tenant_id: auth.tenantId,
        },
      })),
    );

    // Mark all as sent — this is a simplification. SendGrid accepts the batch
    // atomically so either all are accepted or we throw. In practice some
    // addresses may bounce later; webhooks update row status then.
    await db
      .from('email_sends')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_status: bulk.simulated ? 'simulated' : 'accepted',
        updated_at: new Date().toISOString(),
      })
      .in(
        'id',
        insertedRows.map((r) => r.id),
      )
      .eq('tenant_id', auth.tenantId);

    return jsonResponse(
      {
        campaignId: body!.campaignId,
        queued: insertedRows.length,
        sent: insertedRows.length,
        chunks: bulk.chunks,
        simulated: bulk.simulated,
      },
      200,
      req,
      requestId,
    );
  } catch (err) {
    const status = err instanceof SendGridError ? 502 : 500;
    await db
      .from('email_sends')
      .update({
        status: 'failed',
        provider_status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .in(
        'id',
        insertedRows.map((r) => r.id),
      )
      .eq('tenant_id', auth.tenantId);
    return errorResponse(status, 'SendGrid bulk dispatch failed', req, {
      code: 'SENDGRID_ERROR',
      details: err instanceof Error ? err.message : String(err),
      requestId,
    });
  }
}

function dbError(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
