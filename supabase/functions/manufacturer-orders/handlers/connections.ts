// Manufacturer connections — CRUD + test probe + health tick.
//
// Paths (dispatcher stripped /manufacturer-orders/connections):
//   GET    /                     — list (?manufacturerType&connectionStatus)
//   GET    /:id
//   POST   /                     — credentials in (redacted on response)
//   PUT    /:id                  — credentials in (redacted on response)
//   DELETE /:id
//   POST   /:id/test             — probes api_endpoint; records last_connection_test
//   PATCH  /:id/health           — manual health-status update
//
// Every response path goes through redactConnection() so no credential value
// ever flows back out to the frontend.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { redactConnection, redactConnections } from '../_credentials.ts';

export async function handleConnections(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const id = pathParts[0];
  const sub = pathParts[1];

  // POST /:id/test
  if (method === 'POST' && id && sub === 'test') {
    return await testConnection(req, ctx, id);
  }

  // PATCH /:id/health
  if (method === 'PATCH' && id && sub === 'health') {
    const body = (await req.json().catch(() => ({}))) as {
      connectionStatus?: string;
      connection_status?: string;
      lastError?: string;
      last_error?: string;
    };
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.connectionStatus ?? body.connection_status)
      update.connection_status = body.connectionStatus ?? body.connection_status;
    if (body.lastError !== undefined || body.last_error !== undefined)
      update.last_error = body.lastError ?? body.last_error;
    const { data, error } = await db
      .from('manufacturer_connections')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update health', error);
    if (!data)
      return errorResponse(404, 'Connection not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(redactConnection(data), 200, req, requestId);
  }

  if (method === 'GET' && !id) {
    let q = db.from('manufacturer_connections').select('*').eq('tenant_id', auth.tenantId);
    const mType =
      url.searchParams.get('manufacturerType') ?? url.searchParams.get('manufacturer_type');
    const cStatus =
      url.searchParams.get('connectionStatus') ?? url.searchParams.get('connection_status');
    if (mType) q = q.eq('manufacturer_type', mType);
    if (cStatus) q = q.eq('connection_status', cStatus);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch connections', error);
    return jsonResponse(
      redactConnections((data ?? []) as Record<string, unknown>[]),
      200,
      req,
      requestId,
    );
  }

  if (method === 'GET' && id) {
    const { data, error } = await db
      .from('manufacturer_connections')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch connection', error);
    if (!data)
      return errorResponse(404, 'Connection not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(redactConnection(data), 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapConnection(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (!row.manufacturer_type || !row.manufacturer_name) {
      return errorResponse(400, 'manufacturer_type and manufacturer_name required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('manufacturer_connections')
      .insert(row)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create connection', error);
    return jsonResponse(redactConnection(data), 201, req, requestId);
  }

  if ((method === 'PUT' || method === 'PATCH') && id && !sub) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapConnection(body);
    row.updated_by = auth.userId;
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('manufacturer_connections')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update connection', error);
    if (!data)
      return errorResponse(404, 'Connection not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(redactConnection(data), 200, req, requestId);
  }

  if (method === 'DELETE' && id && !sub) {
    const { error } = await db
      .from('manufacturer_connections')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete connection', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// Probe: if api_endpoint is configured, do a GET with a short timeout. Never
// echo credentials in the response — only pass/fail + HTTP status.
async function testConnection(req: Request, ctx: HandlerCtx, id: string): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const { data: conn } = await db
    .from('manufacturer_connections')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!conn)
    return errorResponse(404, 'Connection not found', req, { code: 'NOT_FOUND', requestId });

  const now = new Date().toISOString();

  if (!conn.api_endpoint) {
    await db
      .from('manufacturer_connections')
      .update({
        last_connection_test: now,
        last_error: 'No api_endpoint configured — probe skipped',
        updated_at: now,
      })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    return jsonResponse(
      {
        success: false,
        message: 'No api_endpoint configured. Save the endpoint before testing.',
      },
      200,
      req,
      requestId,
    );
  }

  let status = 0;
  let ok = false;
  let err: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000); // 15s budget
    const res = await fetch(String(conn.api_endpoint), {
      method: 'GET',
      headers: conn.api_key ? { Authorization: `Bearer ${conn.api_key}` } : {},
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = res.status;
    ok = res.ok;
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const updates: Record<string, unknown> = {
    last_connection_test: now,
    updated_at: now,
  };
  if (!ok) {
    updates.last_error = err ?? `Probe failed with HTTP ${status}`;
    updates.consecutive_failures = (conn.consecutive_failures ?? 0) + 1;
  } else {
    updates.last_error = null;
    updates.consecutive_failures = 0;
    updates.connection_status = 'active';
  }
  await db
    .from('manufacturer_connections')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId);

  return jsonResponse({ success: ok, status, error: err }, ok ? 200 : 502, req, requestId);
}

function mapConnection(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('manufacturer_type', 'manufacturerType', 'manufacturer_type');
  set('manufacturer_name', 'manufacturerName', 'manufacturer_name');
  set('connection_status', 'connectionStatus', 'connection_status');
  set('api_endpoint', 'apiEndpoint', 'api_endpoint');
  set('api_key', 'apiKey', 'api_key');
  set('api_secret', 'apiSecret', 'api_secret');
  set('client_id', 'clientId', 'client_id');
  set('client_secret', 'clientSecret', 'client_secret');
  set('access_token', 'accessToken', 'access_token');
  set('refresh_token', 'refreshToken', 'refresh_token');
  set('token_expires_at', 'tokenExpiresAt', 'token_expires_at');
  set('edi_enabled', 'ediEnabled', 'edi_enabled');
  set('edi_interchange_id', 'ediInterchangeId', 'edi_interchange_id');
  set('edi_qualifier', 'ediQualifier', 'edi_qualifier');
  set('edi_password', 'ediPassword', 'edi_password');
  set('order_method', 'orderMethod', 'order_method');
  set('auto_submit_enabled', 'autoSubmitEnabled', 'auto_submit_enabled');
  set('sandbox_mode', 'sandboxMode', 'sandbox_mode');
  set('webhook_url', 'webhookUrl', 'webhook_url');
  set('webhook_secret', 'webhookSecret', 'webhook_secret');
  set('portal_username', 'portalUsername', 'portal_username');
  set('portal_password', 'portalPassword', 'portal_password');
  set('dealer_account_number', 'dealerAccountNumber', 'dealer_account_number');
  set('dealer_account_name', 'dealerAccountName', 'dealer_account_name');
  set('shipping_account_number', 'shippingAccountNumber', 'shipping_account_number');
  set('default_ship_to_address_id', 'defaultShipToAddressId', 'default_ship_to_address_id');
  set('configuration_options', 'configurationOptions', 'configuration_options');
  set('custom_fields', 'customFields', 'custom_fields');
  if (body.notes !== undefined) r.notes = body.notes;
  return r;
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
