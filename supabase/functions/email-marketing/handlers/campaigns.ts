// Email campaigns — CRUD + refresh-metrics + list sends for a campaign.
//
// Paths (dispatcher stripped /email-marketing/email-campaigns):
//   GET    /
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   POST   /:id/refresh-metrics
//   GET    /:campaignId/sends
//   GET    /:campaignId/events

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleCampaigns(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];
  const sub = pathParts[1];

  // POST /:id/refresh-metrics
  if (method === 'POST' && id && sub === 'refresh-metrics') {
    return await refreshMetrics(req, ctx, id);
  }

  // GET /:campaignId/sends
  if (method === 'GET' && id && sub === 'sends') {
    const { data, error } = await db
      .from('email_sends')
      .select('*')
      .eq('campaign_id', id)
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return dbError(req, requestId, 'Failed to fetch sends', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // GET /:campaignId/events
  if (method === 'GET' && id && sub === 'events') {
    const { data, error } = await db
      .from('email_events')
      .select('*')
      .eq('campaign_id', id)
      .eq('tenant_id', auth.tenantId)
      .order('event_timestamp', { ascending: false })
      .limit(1000);
    if (error) return dbError(req, requestId, 'Failed to fetch events', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && !id) {
    let q = db.from('email_campaigns').select('*').eq('tenant_id', auth.tenantId);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('campaignType') ?? url.searchParams.get('type');
    if (status) q = q.eq('status', status);
    if (type) q = q.eq('campaign_type', type);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) return dbError(req, requestId, 'Failed to fetch campaigns', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id && !sub) {
    const { data, error } = await db
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to fetch campaign', error);
    if (!data)
      return errorResponse(404, 'Campaign not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapCampaign(body);
    row.tenant_id = auth.tenantId;
    row.owner_id = row.owner_id ?? auth.userId;
    row.created_by = auth.userId;
    if (
      !row.campaign_name ||
      !row.campaign_type ||
      !row.subject ||
      !row.sender_email ||
      !row.schedule_type
    ) {
      return errorResponse(
        400,
        'campaign_name, campaign_type, subject, sender_email, schedule_type required',
        req,
        { code: 'VALIDATION_ERROR', requestId },
      );
    }
    if (!row.sender_name) row.sender_name = String(row.sender_email).split('@')[0];
    const { data, error } = await db.from('email_campaigns').insert(row).select().maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to create campaign', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id && !sub) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapCampaign(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('email_campaigns')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to update campaign', error);
    if (!data)
      return errorResponse(404, 'Campaign not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id && !sub) {
    const { error } = await db
      .from('email_campaigns')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbError(req, requestId, 'Failed to delete campaign', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

async function refreshMetrics(
  req: Request,
  ctx: HandlerCtx,
  campaignId: string,
): Promise<Response> {
  const { auth, db, requestId } = ctx;

  // Count totals + events aggregates
  const [sends, delivered, opened, clicked, bounced, unsubscribed, spam] = await Promise.all([
    db
      .from('email_sends')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('campaign_id', campaignId),
    countEvent(db, auth.tenantId, campaignId, 'delivered'),
    countEvent(db, auth.tenantId, campaignId, 'open'),
    countEvent(db, auth.tenantId, campaignId, 'click'),
    countEvent(db, auth.tenantId, campaignId, 'bounce'),
    countEvent(db, auth.tenantId, campaignId, 'unsubscribe'),
    countEvent(db, auth.tenantId, campaignId, 'spam_report'),
  ]);

  const totalSent = sends.count ?? 0;
  const rate = (n: number) => (totalSent > 0 ? Number(((n / totalSent) * 100).toFixed(2)) : 0);

  const update = {
    total_recipients: totalSent,
    emails_sent: totalSent,
    emails_delivered: delivered,
    emails_opened: opened,
    emails_clicked: clicked,
    emails_bounced: bounced,
    emails_unsubscribed: unsubscribed,
    emails_spam_reported: spam,
    delivery_rate: rate(delivered),
    open_rate: rate(opened),
    click_rate: rate(clicked),
    bounce_rate: rate(bounced),
    unsubscribe_rate: rate(unsubscribed),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('email_campaigns')
    .update(update)
    .eq('id', campaignId)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle();

  if (error) return dbError(req, requestId, 'Failed to refresh metrics', error);
  if (!data) return errorResponse(404, 'Campaign not found', req, { code: 'NOT_FOUND', requestId });
  return jsonResponse(data, 200, req, requestId);
}

async function countEvent(
  // deno-lint-ignore no-explicit-any
  db: any,
  tenantId: string,
  campaignId: string,
  eventType: string,
): Promise<number> {
  const { count } = await db
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('campaign_id', campaignId)
    .eq('event_type', eventType);
  return count ?? 0;
}

function mapCampaign(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };

  set('campaign_name', 'campaignName', 'campaign_name');
  set('campaign_description', 'campaignDescription', 'campaign_description');
  set('campaign_type', 'campaignType', 'campaign_type');
  set('template_id', 'templateId', 'template_id');
  if (body.subject !== undefined) r.subject = body.subject;
  set('sender_name', 'senderName', 'sender_name');
  set('sender_email', 'senderEmail', 'sender_email');
  set('reply_to_email', 'replyToEmail', 'reply_to_email');
  set('list_ids', 'listIds', 'list_ids');
  set('segment_criteria', 'segmentCriteria', 'segment_criteria');
  set('exclude_list_ids', 'excludeListIds', 'exclude_list_ids');
  set('sequence_steps', 'sequenceSteps', 'sequence_steps');
  set('current_step', 'currentStep', 'current_step');
  set('schedule_type', 'scheduleType', 'schedule_type');
  set('scheduled_date', 'scheduledDate', 'scheduled_date');
  if (body.timezone !== undefined) r.timezone = body.timezone;
  set('recurring_pattern', 'recurringPattern', 'recurring_pattern');
  if (body.status !== undefined) r.status = body.status;
  set('is_ab_test', 'isAbTest', 'is_ab_test');
  set('ab_test_variants', 'abTestVariants', 'ab_test_variants');
  set('owner_id', 'ownerId', 'owner_id');

  return r;
}

function dbError(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
