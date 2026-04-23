/**
 * SSO edge function.
 *
 * Replaces server/routes/sso-routes.ts (14 endpoints) + sso-service.ts.
 *
 * URL prefix: /sso/*
 *
 * Scope split for this port:
 *   **Fully ported:**
 *     - Provider config CRUD (with credential redaction)
 *     - OIDC callback (token exchange + userinfo via fetch)
 *     - Session validate + logout (local session state)
 *     - SAML metadata XML generation (static template)
 *
 *   **Stubbed with clear follow-up (per PRD §3 + §10 risk):**
 *     - SAML assertion signature verification — XML crypto in Deno is the
 *       single highest-risk port. `xml-crypto`+`@xmldom/xmldom` via esm.sh
 *       works but is fragile; a security review is warranted before sunset.
 *       Currently the /callback/saml/:providerId handler returns 501 with a
 *       clear follow-up marker. Track in follow-up/sso-saml-signing.md.
 *     - SAML SLO (single-logout) response signing — same reason
 *     - JIT user provisioning + Supabase GoTrue admin session minting —
 *       framework present; needs review against current auth-setup
 *
 * One-time SQL:
 *   \i drizzle/rls/auth-security-tables.sql
 *   \i drizzle/rls/auth-security.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { redactProvider } from './_credentials.ts';

const log = createLogger('sso');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/sso/, '')
      .replace(/\/$/, '') || '/'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();
  const sub = stripPrefix(url.pathname);

  try {
    const parts = sub.split('/').filter(Boolean);
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];

    // PUBLIC: SAML/OIDC callbacks don't carry a JWT yet (pre-session).
    if (p0 === 'callback') {
      if (p1 === 'saml' && p2 && method === 'POST') {
        return await samlCallback(req, p2, requestId);
      }
      if (p1 === 'oidc' && p2 && method === 'GET') {
        return await oidcCallback(req, p2, url, requestId);
      }
    }

    // PUBLIC: metadata XML for SP discovery
    if (method === 'GET' && p0 === 'metadata' && p1) {
      return await metadataXml(req, p1, url, requestId);
    }

    // ─── Authenticated endpoints ───────────────────────────────────────────

    const auth = await requireAuth(req);
    const db = getDb();

    // POST /providers
    if (method === 'POST' && p0 === 'providers' && !p1) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
      const row = mapProvider(body);
      row.tenant_id = auth.tenantId;
      row.created_by = auth.userId;
      if (!row.provider_type || !row.protocol || !row.name) {
        return errorResponse(400, 'provider_type, protocol, name required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }
      const { data, error } = await db
        .from('sso_provider_configs')
        .insert(row)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to create provider', error);
      return jsonResponse(redactProvider(data), 201, req, requestId);
    }

    // POST /providers/import — SAML metadata XML upload (parse → fill form)
    if (method === 'POST' && p0 === 'providers' && p1 === 'import') {
      return errorResponse(501, 'SAML metadata import not yet ported', req, {
        code: 'NOT_IMPLEMENTED',
        details: {
          stub: true,
          reason:
            'Parsing third-party IdP XML requires @xmldom/xmldom + careful attribute mapping. Deferred to follow-up/sso-saml-signing.md.',
        },
        requestId,
      });
    }

    // POST /providers/:id/test — config probe
    if (method === 'POST' && p0 === 'providers' && p1 && p2 === 'test') {
      return await testProvider(req, p1, auth, db, requestId);
    }

    // GET /providers
    if (method === 'GET' && p0 === 'providers' && !p1) {
      const { data, error } = await db
        .from('sso_provider_configs')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false });
      if (error) return dbErr(req, requestId, 'Failed to fetch providers', error);
      return jsonResponse(
        (data ?? []).map((r: Record<string, unknown>) => redactProvider(r)),
        200,
        req,
        requestId,
      );
    }

    // GET /providers/:id
    if (method === 'GET' && p0 === 'providers' && p1 && !p2) {
      const { data, error } = await db
        .from('sso_provider_configs')
        .select('*')
        .eq('id', p1)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to fetch provider', error);
      if (!data)
        return errorResponse(404, 'Provider not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(redactProvider(data), 200, req, requestId);
    }

    // PATCH /providers/:id
    if ((method === 'PATCH' || method === 'PUT') && p0 === 'providers' && p1 && !p2) {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
      const row = mapProvider(body);
      row.updated_by = auth.userId;
      row.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('sso_provider_configs')
        .update(row)
        .eq('id', p1)
        .eq('tenant_id', auth.tenantId)
        .select()
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to update provider', error);
      if (!data)
        return errorResponse(404, 'Provider not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(redactProvider(data), 200, req, requestId);
    }

    // DELETE /providers/:id
    if (method === 'DELETE' && p0 === 'providers' && p1 && !p2) {
      const { error } = await db
        .from('sso_provider_configs')
        .delete()
        .eq('id', p1)
        .eq('tenant_id', auth.tenantId);
      if (error) return dbErr(req, requestId, 'Failed to delete provider', error);
      return jsonResponse({ success: true }, 200, req, requestId);
    }

    // POST /auth/initiate — returns the URL to redirect the user to for SSO
    if (method === 'POST' && p0 === 'auth' && p1 === 'initiate') {
      return await initiateAuth(req, auth, db, requestId);
    }

    // POST /logout — local session clear
    if (method === 'POST' && p0 === 'logout' && !p1) {
      await db.from('sso_sessions').delete().eq('user_id', auth.userId);
      return jsonResponse({ loggedOut: true }, 200, req, requestId);
    }

    // POST /logout/saml/:providerId — SAML SLO (stub)
    if (method === 'POST' && p0 === 'logout' && p1 === 'saml' && p2) {
      return errorResponse(501, 'SAML SLO not yet ported', req, {
        code: 'NOT_IMPLEMENTED',
        details: {
          stub: true,
          reason:
            'Single-logout requires signed logout request generation. Local session is cleared via /sso/logout — follow-up.',
        },
        requestId,
      });
    }

    // GET /session/validate
    if (method === 'GET' && p0 === 'session' && p1 === 'validate') {
      const { data } = await db
        .from('sso_sessions')
        .select('*')
        .eq('user_id', auth.userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return jsonResponse({ valid: !!data, session: data ?? null }, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path: url.pathname, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, { code: 'INTERNAL', requestId });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}

// ─── SAML callback — STUB ────────────────────────────────────────────────────

async function samlCallback(
  req: Request,
  providerId: string,
  requestId: string,
): Promise<Response> {
  // Intentional stub. Real port:
  //   1. Parse SAMLResponse from form body (base64 decode → XML)
  //   2. Verify XML signature against provider's saml_certificate
  //   3. Check assertion freshness, audience, destination
  //   4. Extract NameID + attributes; JIT-provision user if missing
  //   5. Mint Supabase GoTrue session via admin API
  //   6. Redirect to frontend with session tokens
  log.warn({ requestId, providerId }, 'saml_callback_stub');
  return errorResponse(501, 'SAML callback not yet ported', req, {
    code: 'NOT_IMPLEMENTED',
    details: {
      stub: true,
      reason: 'XML signature verification in Deno is deferred. See follow-up/sso-saml-signing.md.',
      recommendation:
        'Use Supabase Enterprise SSO if available on self-hosted, otherwise keep Express auth container alive for SAML customers until Deno XML-signing is validated.',
    },
    requestId,
  });
}

// ─── OIDC callback ───────────────────────────────────────────────────────────

async function oidcCallback(
  req: Request,
  providerId: string,
  url: URL,
  requestId: string,
): Promise<Response> {
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  if (!code) {
    return errorResponse(400, 'code parameter required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const db = getDb();
  const { data: provider } = await db
    .from('sso_provider_configs')
    .select('*')
    .eq('id', providerId)
    .maybeSingle();
  if (!provider || provider.protocol !== 'oidc') {
    return errorResponse(404, 'OIDC provider not found', req, { code: 'NOT_FOUND', requestId });
  }

  // Exchange code for tokens
  const tokenRes = await fetch(String(provider.oidc_token_url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: String(provider.oidc_client_id ?? ''),
      client_secret: String(provider.oidc_client_secret ?? ''),
      redirect_uri: redirectUri(url, providerId),
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return errorResponse(502, 'OIDC token exchange failed', req, {
      code: 'OIDC_TOKEN_ERROR',
      details: err.slice(0, 500),
      requestId,
    });
  }
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  // Fetch userinfo
  let userinfo: Record<string, unknown> | null = null;
  if (provider.oidc_userinfo_url && tokens.access_token) {
    const uiRes = await fetch(String(provider.oidc_userinfo_url), {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (uiRes.ok) {
      userinfo = (await uiRes.json()) as Record<string, unknown>;
    }
  }

  // JIT provisioning + Supabase session minting is a follow-up. For now we
  // persist a session record so the frontend can complete the flow.
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  await db.from('sso_sessions').insert({
    tenant_id: provider.tenant_id,
    provider_id: providerId,
    user_identifier: userinfo?.sub ?? userinfo?.email ?? null,
    access_token_hash: tokens.access_token ? await sha256Hex(String(tokens.access_token)) : null,
    expires_at: expiresAt,
    metadata: { userinfo, stateHint: stateRaw },
  });

  return jsonResponse(
    {
      success: true,
      providerId,
      userinfo,
      tokenType: 'bearer',
      expiresAt,
      note: 'Session stored. JIT user provisioning + Supabase session mint is a follow-up; frontend should complete via supabase-js auth flow for now.',
    },
    200,
    req,
    requestId,
  );
}

// ─── Metadata XML (SP metadata for IdP config) ───────────────────────────────

async function metadataXml(
  req: Request,
  providerId: string,
  url: URL,
  requestId: string,
): Promise<Response> {
  const db = getDb();
  const { data: provider } = await db
    .from('sso_provider_configs')
    .select('tenant_id, saml_entity_id')
    .eq('id', providerId)
    .maybeSingle();
  if (!provider) {
    return errorResponse(404, 'Provider not found', req, { code: 'NOT_FOUND', requestId });
  }

  const entityId = String(provider.saml_entity_id ?? `printyx:${providerId}`);
  const acsUrl = `${url.origin}/sso/callback/saml/${providerId}`;
  const sloUrl = `${url.origin}/sso/logout/saml/${providerId}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${sloUrl}"/>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
  </SPSSODescriptor>
</EntityDescriptor>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/samlmetadata+xml',
      'X-Request-ID': requestId,
    },
  });
}

// ─── Test probe ──────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function testProvider(
  req: Request,
  id: string,
  auth: any,
  db: any,
  requestId: string,
): Promise<Response> {
  const { data: provider } = await db
    .from('sso_provider_configs')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!provider)
    return errorResponse(404, 'Provider not found', req, { code: 'NOT_FOUND', requestId });

  const now = new Date().toISOString();
  let success = false;
  let errMsg: string | null = null;

  try {
    if (provider.protocol === 'oidc' && provider.oidc_issuer) {
      // GET the issuer's well-known config — cheap probe.
      const wk = `${String(provider.oidc_issuer).replace(/\/$/, '')}/.well-known/openid-configuration`;
      const r = await fetch(wk);
      success = r.ok;
      if (!r.ok) errMsg = `OIDC discovery HTTP ${r.status}`;
    } else if (provider.protocol === 'saml2' && provider.saml_sso_url) {
      const r = await fetch(String(provider.saml_sso_url), { method: 'HEAD' });
      success = r.status < 500; // IdP HEAD sometimes returns 405; anything < 500 means reachable
      if (r.status >= 500) errMsg = `SAML endpoint HTTP ${r.status}`;
    } else {
      errMsg = 'Provider has no probe endpoint configured';
    }
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }

  await db
    .from('sso_provider_configs')
    .update({
      last_tested_at: now,
      last_test_success: success,
      last_test_error: errMsg,
      updated_at: now,
    })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId);

  return jsonResponse({ success, error: errMsg }, success ? 200 : 502, req, requestId);
}

// ─── Initiate ────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function initiateAuth(
  req: Request,
  auth: any,
  db: any,
  requestId: string,
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { providerId?: string };
  if (!body.providerId) {
    return errorResponse(400, 'providerId required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  const { data: provider } = await db
    .from('sso_provider_configs')
    .select('*')
    .eq('id', body.providerId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (!provider)
    return errorResponse(404, 'Provider not found', req, { code: 'NOT_FOUND', requestId });

  const url = new URL(req.url);
  if (provider.protocol === 'oidc') {
    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      client_id: String(provider.oidc_client_id ?? ''),
      response_type: 'code',
      scope: String(provider.oidc_scopes ?? 'openid profile email'),
      redirect_uri: redirectUri(url, provider.id),
      state,
    });
    return jsonResponse(
      {
        redirectUrl: `${provider.oidc_authorization_url}?${params}`,
        state,
      },
      200,
      req,
      requestId,
    );
  }

  if (provider.protocol === 'saml2') {
    // Real SAML AuthnRequest construction is a stub until signature work lands.
    return jsonResponse(
      {
        redirectUrl: String(provider.saml_sso_url ?? ''),
        stub: true,
        note: 'SAML AuthnRequest is not signed yet — IdPs requiring signed requests will reject this.',
      },
      200,
      req,
      requestId,
    );
  }

  return errorResponse(400, 'Unknown protocol', req, { code: 'UNSUPPORTED_PROTOCOL', requestId });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function redirectUri(url: URL, providerId: string): string {
  return `${url.origin}/sso/callback/oidc/${providerId}`;
}

function mapProvider(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('provider_type', 'providerType', 'provider_type');
  if (body.protocol !== undefined) r.protocol = body.protocol;
  if (body.name !== undefined) r.name = body.name;
  set('display_name', 'displayName', 'display_name');
  if (body.description !== undefined) r.description = body.description;
  if (body.status !== undefined) r.status = body.status;
  set('is_enabled', 'isEnabled', 'is_enabled');
  set('is_primary', 'isPrimary', 'is_primary');
  // SAML
  set('saml_entity_id', 'samlEntityId', 'saml_entity_id');
  set('saml_sso_url', 'samlSsoUrl', 'saml_sso_url');
  set('saml_slo_url', 'samlSloUrl', 'saml_slo_url');
  set('saml_certificate', 'samlCertificate', 'saml_certificate');
  set('saml_signing_algorithm', 'samlSigningAlgorithm', 'saml_signing_algorithm');
  set('saml_digest_algorithm', 'samlDigestAlgorithm', 'saml_digest_algorithm');
  set('saml_request_signature', 'samlRequestSignature', 'saml_request_signature');
  set('saml_want_assertions_signed', 'samlWantAssertionsSigned', 'saml_want_assertions_signed');
  // OIDC
  set('oidc_client_id', 'oidcClientId', 'oidc_client_id');
  set('oidc_client_secret', 'oidcClientSecret', 'oidc_client_secret');
  set('oidc_issuer', 'oidcIssuer', 'oidc_issuer');
  set('oidc_authorization_url', 'oidcAuthorizationUrl', 'oidc_authorization_url');
  set('oidc_token_url', 'oidcTokenUrl', 'oidc_token_url');
  set('oidc_userinfo_url', 'oidcUserinfoUrl', 'oidc_userinfo_url');
  set('oidc_jwks_url', 'oidcJwksUrl', 'oidc_jwks_url');
  set('oidc_scopes', 'oidcScopes', 'oidc_scopes');
  // Mappings
  set('attribute_mapping', 'attributeMapping', 'attribute_mapping');
  set('group_role_mapping', 'groupRoleMapping', 'group_role_mapping');
  set('allowed_domains', 'allowedDomains', 'allowed_domains');
  set('allowed_email_domains', 'allowedEmailDomains', 'allowed_email_domains');
  set('auto_provision_users', 'autoProvisionUsers', 'auto_provision_users');
  set('auto_update_user_attributes', 'autoUpdateUserAttributes', 'auto_update_user_attributes');
  set('auto_deactivate_users', 'autoDeactivateUsers', 'auto_deactivate_users');
  set('default_role', 'defaultRole', 'default_role');
  set('default_location_id', 'defaultLocationId', 'default_location_id');
  set('jit_provisioning', 'jitProvisioning', 'jit_provisioning');
  set('jit_provisioning_rules', 'jitProvisioningRules', 'jit_provisioning_rules');
  return r;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
function dbErr(req: Request, requestId: string, msg: string, err: any): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}
