// Integration credentials — CRUD + test probe.
//
// Paths (dispatcher stripped /signatures/integration-credentials):
//   GET    /                  — list (?provider filter)
//   GET    /:id
//   POST   /
//   PATCH  /:id
//   DELETE /:id
//   POST   /:id/test          — health probe (stub today; real probe when provider wired)
//
// All responses redact sensitive fields via _shared/credentials.ts.
//
// Scope: only signature-provider creds (docusign, adobe_sign, hellosign).
// Other providers (manufacturer-orders, SSO, etc.) may share the
// integration_credentials table but have their own edge functions.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import { redactCredentials } from '../../_shared/credentials.ts';
import type { HandlerCtx } from '../_context.ts';

const SIGNATURE_PROVIDERS = ['docusign', 'adobe_sign', 'hellosign'];

export async function handleCredentials(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];
  const sub = pathParts[1];

  // POST /:id/test
  if (method === 'POST' && id && sub === 'test') {
    return await testCredential(req, ctx, id);
  }

  // GET /
  if (method === 'GET' && !id) {
    const provider = url.searchParams.get('provider');
    let q = db
      .from('integration_credentials')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .in('provider', SIGNATURE_PROVIDERS);
    if (provider) q = q.eq('provider', provider);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch credentials', error);
    return jsonResponse(
      (data ?? []).map((r: Record<string, unknown>) => redactCredentials(r)),
      200,
      req,
      requestId,
    );
  }

  // GET /:id
  if (method === 'GET' && id && !sub) {
    const { data, error } = await db
      .from('integration_credentials')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch credential', error);
    if (!data || !SIGNATURE_PROVIDERS.includes((data as { provider: string }).provider)) {
      return errorResponse(404, 'Credential not found', req, { code: 'NOT_FOUND', requestId });
    }
    return jsonResponse(redactCredentials(data as Record<string, unknown>), 200, req, requestId);
  }

  // POST /
  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapCredential(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.provider || !row.integration_name) {
      return errorResponse(400, 'provider and integration_name are required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    if (!SIGNATURE_PROVIDERS.includes(String(row.provider))) {
      return errorResponse(400, `provider must be one of: ${SIGNATURE_PROVIDERS.join(', ')}`, req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('integration_credentials')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create credential', error);
    return jsonResponse(redactCredentials(data as Record<string, unknown>), 201, req, requestId);
  }

  // PATCH /:id
  if ((method === 'PATCH' || method === 'PUT') && id && !sub) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapCredential(body);
    row.updated_by = auth.userId;
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('integration_credentials')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update credential', error);
    if (!data)
      return errorResponse(404, 'Credential not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(redactCredentials(data as Record<string, unknown>), 200, req, requestId);
  }

  // DELETE /:id
  if (method === 'DELETE' && id && !sub) {
    const { error } = await db
      .from('integration_credentials')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete credential', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// Stub today. When a real provider is wired (DocuSign first per PRD §1),
// replace with a /accounts or /ping probe against the provider's REST API.
async function testCredential(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const { data, error } = await db
    .from('integration_credentials')
    .select('id, provider, integration_name, status')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to load credential', error);
  if (!data)
    return errorResponse(404, 'Credential not found', req, { code: 'NOT_FOUND', requestId });

  // Record a "test pending wiring" health check so the UI shows a realistic state.
  await db
    .from('integration_credentials')
    .update({
      last_health_check: new Date().toISOString(),
      health_status: 'unknown',
      error_message: 'Provider probe not yet wired (stub). Credentials stored.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId);

  return jsonResponse(
    {
      success: true,
      stub: true,
      message:
        'Credential test is a stub until a real provider integration lands. Credential is stored correctly.',
      credential: data,
    },
    200,
    req,
    requestId,
  );
}

function mapCredential(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  if (body.provider !== undefined) r.provider = body.provider;
  set('integration_name', 'integrationName', 'integration_name');
  if (body.status !== undefined) r.status = body.status;
  set('api_key', 'apiKey', 'api_key');
  set('api_secret', 'apiSecret', 'api_secret');
  set('access_token', 'accessToken', 'access_token');
  set('refresh_token', 'refreshToken', 'refresh_token');
  set('token_expiry', 'tokenExpiry', 'token_expiry');
  set('account_id', 'accountId', 'account_id');
  set('webhook_secret', 'webhookSecret', 'webhook_secret');
  set('sandbox_mode', 'sandboxMode', 'sandbox_mode');
  if (body.config !== undefined) r.config = body.config;
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
