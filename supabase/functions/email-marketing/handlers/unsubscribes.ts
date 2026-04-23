// Email unsubscribes — record + query + per-email check.
//
// Paths (dispatcher stripped /email-marketing/email-unsubscribes):
//   GET    /                    — list tenant unsubscribes
//   POST   /                    — record an unsubscribe
//   GET    /check/:email        — boolean check (tenant-scoped)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleUnsubscribes(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  // GET /check/:email — boolean only, no cross-tenant leak
  if (method === 'GET' && first === 'check' && second) {
    const email = decodeURIComponent(second);
    const { data } = await db
      .from('email_unsubscribes')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    return jsonResponse({ unsubscribed: !!data }, 200, req, requestId);
  }

  if (method === 'GET' && !first) {
    const { data, error } = await db
      .from('email_unsubscribes')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('unsubscribed_at', { ascending: false });
    if (error) return dbError(req, requestId, 'Failed to fetch unsubscribes', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const email = body.email as string | undefined;
    const unsubscribeType = (body.unsubscribeType ?? body.unsubscribe_type) as string | undefined;
    if (!email || !unsubscribeType) {
      return errorResponse(400, 'email and unsubscribeType are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const row = {
      tenant_id: auth.tenantId,
      email,
      contact_id: (body.contactId ?? body.contact_id ?? null) as string | null,
      unsubscribe_type: unsubscribeType,
      campaign_id: (body.campaignId ?? body.campaign_id ?? null) as string | null,
      list_id: (body.listId ?? body.list_id ?? null) as string | null,
      reason: (body.reason ?? null) as string | null,
      feedback_text: (body.feedbackText ?? body.feedback_text ?? null) as string | null,
      unsubscribe_method: (body.unsubscribeMethod ?? body.unsubscribe_method ?? null) as
        | string
        | null,
      email_send_id: (body.emailSendId ?? body.email_send_id ?? null) as string | null,
      user_agent: (body.userAgent ?? body.user_agent ?? null) as string | null,
      ip_address: (body.ipAddress ?? body.ip_address ?? null) as string | null,
    };
    // UNIQUE (tenant_id, email, unsubscribe_type) — use upsert to be idempotent.
    const { data, error } = await db
      .from('email_unsubscribes')
      .upsert(row, {
        onConflict: 'tenant_id,email,unsubscribe_type',
        ignoreDuplicates: false,
      })
      .select()
      .maybeSingle();
    if (error) return dbError(req, requestId, 'Failed to record unsubscribe', error);
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}

function dbError(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
