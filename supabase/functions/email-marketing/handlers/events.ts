// Email events — manual record endpoint.
//
// Paths (dispatcher stripped /email-marketing/email-events):
//   POST /    — insert an event row (for tests / manual tracking)
//
// Note: the canonical ingest path is /webhooks/sendgrid (handled separately);
// this endpoint is a manual fallback used by QA and by the frontend to record
// in-app opens/clicks that never traverse SendGrid.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const VALID_EVENT_TYPES = new Set([
  'sent',
  'delivered',
  'open',
  'click',
  'bounce',
  'spam_report',
  'unsubscribe',
  'dropped',
]);

export async function handleEvents(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId } = ctx;
  if (method !== 'POST') return null;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });

  const eventType = (body.eventType ?? body.event_type) as string | undefined;
  const emailSendId = (body.emailSendId ?? body.email_send_id) as string | undefined;
  const campaignId = (body.campaignId ?? body.campaign_id) as string | undefined;

  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    return errorResponse(
      400,
      `eventType must be one of: ${[...VALID_EVENT_TYPES].join(', ')}`,
      req,
      {
        code: 'VALIDATION_ERROR',
        requestId,
      },
    );
  }
  if (!emailSendId || !campaignId) {
    return errorResponse(400, 'emailSendId and campaignId are required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const row = {
    tenant_id: auth.tenantId,
    email_send_id: emailSendId,
    campaign_id: campaignId,
    event_type: eventType,
    event_timestamp: (body.eventTimestamp ??
      body.event_timestamp ??
      new Date().toISOString()) as string,
    clicked_url: (body.clickedUrl ?? body.clicked_url ?? null) as string | null,
    link_label: (body.linkLabel ?? body.link_label ?? null) as string | null,
    user_agent: (body.userAgent ?? body.user_agent ?? null) as string | null,
    ip_address: (body.ipAddress ?? body.ip_address ?? null) as string | null,
    device_type: (body.deviceType ?? body.device_type ?? null) as string | null,
    email_client: (body.emailClient ?? body.email_client ?? null) as string | null,
    operating_system: (body.operatingSystem ?? body.operating_system ?? null) as string | null,
    country: (body.country ?? null) as string | null,
    city: (body.city ?? null) as string | null,
    provider_data: (body.providerData ?? body.provider_data ?? null) as Record<
      string,
      unknown
    > | null,
  };

  const { data, error } = await db.from('email_events').insert(row).select().maybeSingle();
  if (error) {
    return errorResponse(500, 'Failed to record event', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  return jsonResponse(data, 201, req, requestId);
}
