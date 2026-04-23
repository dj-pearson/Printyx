// Engagement tracking.
//
// Paths (under /lead-scoring):
//   POST /engagement/:leadId    — record an engagement event
//   GET  /engagement/:leadId    — list recent engagements

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleEngagement(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  // pathParts[0] is 'engagement' (dispatcher didn't strip it); leadId follows
  const leadId = pathParts[1];
  if (!leadId) return null;

  // Tenant-scoped lead verification
  const { data: lead } = await db
    .from('business_records')
    .select('id')
    .eq('id', leadId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!lead) {
    return errorResponse(404, 'Lead not found', req, { code: 'NOT_FOUND', requestId });
  }

  if (method === 'POST') {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = {
      tenant_id: auth.tenantId,
      lead_id: leadId,
      engagement_type: (body.engagementType ?? body.engagement_type) as string,
      engagement_channel: (body.engagementChannel ?? body.engagement_channel ?? null) as
        | string
        | null,
      engagement_source: (body.engagementSource ?? body.engagement_source ?? null) as string | null,
      engagement_value: (body.engagementValue ?? body.engagement_value ?? 1) as number,
      engagement_metadata: (body.engagementMetadata ?? body.engagement_metadata ?? null) as Record<
        string,
        unknown
      > | null,
      campaign_id: (body.campaignId ?? body.campaign_id ?? null) as string | null,
      user_id: auth.userId,
    };
    if (!row.engagement_type) {
      return errorResponse(400, 'engagementType is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('lead_engagement_tracking')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to track engagement', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  if (method === 'GET') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
    const { data, error } = await db
      .from('lead_engagement_tracking')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', auth.tenantId)
      .order('engaged_at', { ascending: false })
      .limit(limit);
    if (error) {
      return errorResponse(500, 'Failed to fetch engagements', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  return null;
}
