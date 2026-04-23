// SendGrid event webhook — PUBLIC endpoint.
//
// POST /email-marketing/webhooks/sendgrid
//
// SendGrid posts an array of event objects. Each has sg_message_id,
// event (type), timestamp, and custom_args we attached during send
// (email_send_id, campaign_id, tenant_id).
//
// We resolve email_send_id from custom_args first (most reliable), falling
// back to sg_message_id lookup on email_sends.sendgrid_message_id. Events
// that can't be resolved are dropped with a log entry (don't 500 — SendGrid
// retries on non-2xx and we don't want the backlog to re-ingest forever).
//
// Uses the service-role client because this endpoint is unauthenticated and
// needs to write across tenants.
//
// Signature verification (follow-up): SendGrid sends X-Twilio-Email-Event-
// Webhook-Signature and X-Twilio-Email-Event-Webhook-Timestamp; verification
// uses ECDSA over the timestamp || raw_payload with a tenant-configured
// public key. Not yet implemented — matches Express's behavior (also none).
// Track: follow-up/email-marketing-webhook-verify.md.

import { getDb } from '../../_shared/db.ts';
import { createLogger } from '../../_shared/logger.ts';

const log = createLogger('email-marketing/webhooks-sendgrid');

// SendGrid → our canonical event_type
const EVENT_TYPE_MAP: Record<string, string> = {
  processed: 'sent',
  delivered: 'delivered',
  open: 'open',
  click: 'click',
  bounce: 'bounce',
  dropped: 'bounce',
  spamreport: 'spam_report',
  unsubscribe: 'unsubscribe',
  group_unsubscribe: 'unsubscribe',
  deferred: 'deferred',
};

interface SendGridEvent {
  sg_message_id?: string;
  event?: string;
  timestamp?: number;
  email?: string;
  url?: string;
  useragent?: string;
  ip?: string;
  email_send_id?: string;
  campaign_id?: string;
  tenant_id?: string;
}

export async function handleSendgridWebhook(req: Request, requestId: string): Promise<Response> {
  let events: SendGridEvent[];
  try {
    const parsed = await req.json();
    if (!Array.isArray(parsed)) {
      return new Response(JSON.stringify({ error: 'Payload must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
      });
    }
    events = parsed as SendGridEvent[];
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
    });
  }

  const db = getDb();

  let recorded = 0;
  let dropped = 0;
  for (const ev of events) {
    const eventType = EVENT_TYPE_MAP[ev.event ?? ''];
    if (!eventType) {
      dropped++;
      continue;
    }

    // Resolve email_send_id. custom_args is the fast path.
    let sendId = ev.email_send_id ?? null;
    let campaignId = ev.campaign_id ?? null;
    let tenantId = ev.tenant_id ?? null;

    if (!sendId && ev.sg_message_id) {
      // sg_message_id format: <id>.<recipient-etc> — strip everything after the dot
      const prefix = ev.sg_message_id.split('.')[0];
      const { data } = await db
        .from('email_sends')
        .select('id, tenant_id, campaign_id')
        .eq('sendgrid_message_id', prefix)
        .limit(1)
        .maybeSingle();
      if (data) {
        sendId = data.id;
        campaignId = data.campaign_id;
        tenantId = data.tenant_id;
      }
    }

    if (!sendId || !tenantId || !campaignId) {
      dropped++;
      continue;
    }

    // Insert the event
    const insertErr = (
      await db.from('email_events').insert({
        tenant_id: tenantId,
        email_send_id: sendId,
        campaign_id: campaignId,
        event_type: eventType,
        event_timestamp: ev.timestamp
          ? new Date(ev.timestamp * 1000).toISOString()
          : new Date().toISOString(),
        clicked_url: ev.url ?? null,
        user_agent: ev.useragent ?? null,
        ip_address: ev.ip ?? null,
        sendgrid_event_id: ev.sg_message_id ?? null,
        provider_data: ev as unknown as Record<string, unknown>,
      })
    ).error;

    if (insertErr) {
      log.warn({ requestId, err: insertErr, eventType }, 'event_insert_failed');
      dropped++;
      continue;
    }

    // Mirror key events onto email_sends
    if (eventType === 'delivered') {
      await db
        .from('email_sends')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sendId)
        .eq('tenant_id', tenantId);
    } else if (eventType === 'bounce') {
      await db
        .from('email_sends')
        .update({
          status: 'bounced',
          bounced_at: new Date().toISOString(),
          bounce_type: (ev as unknown as { type?: string }).type ?? null,
          bounce_reason: (ev as unknown as { reason?: string }).reason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sendId)
        .eq('tenant_id', tenantId);
    }

    recorded++;
  }

  log.info({ requestId, received: events.length, recorded, dropped }, 'sendgrid_webhook_processed');

  return new Response(JSON.stringify({ received: events.length, recorded, dropped }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
  });
}
