// Monitoring Clients edge function — admin endpoints for the platform UI.
//
// Replaces /api/client-metrics/* (which routed to a deprecated edge function
// that authenticated via x-api-key — meant for the agent itself, not the UI).
// Every endpoint here authenticates via the user's Supabase JWT and enforces
// tenant scoping + a permission gate (service.equipment.view for reads,
// service.equipment.configure for mutations). Platform admins bypass the
// permission check.
//
// Routes (paths are relative to /monitoring-clients in production; the
// dispatcher in supabase/functions/server.ts strips the function name):
//
//   GET    /                                   list clients
//   POST   /                                   register a new client
//   GET    /:id                                client detail (+ activity)
//   DELETE /:id                                delete client
//   POST   /:id/regenerate-key                 rotate API key
//   POST   /:id/enrollment-token               issue one-time install token
//   GET    /:id/installer.zip                  download bundled installer
//   POST   /:id/commands                       enqueue a remote command
//   GET    /:id/commands                       list recent commands
//
// Client lookup by either UUID primary key or human-readable client_id slug.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const READ_PERMS = ['service.equipment.view', 'service.equipment.configure'];
const WRITE_PERMS = ['service.equipment.configure'];

const SUPPORTED_COMMANDS = new Set(['rescan', 'reload-config', 'force-submit', 'rotate-key']);
const DEFAULT_COMMAND_TTL_MS = 30 * 60 * 1000; // 30 min
const DEFAULT_ENROLL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

const README_FOR_BUNDLE = `Printyx Monitoring Client — install bundle
================================================

This zip contains everything needed to install the monitoring client on a
Windows Server. Run from an elevated PowerShell:

    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\\install-windows.ps1 -ConfigBundle .\\bootstrap-config.json

The bundled config includes a one-time enrollment token (NOT an API key).
The installer redeems the token at install time over HTTPS/443 to receive
its permanent API key. The token expires per the timestamp inside
bootstrap-config.json — generate a new bundle if the deadline passes.
`;

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function newApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'pk_' + base64UrlEncode(bytes);
}

function newEnrollmentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'et_' + base64UrlEncode(bytes);
}

// Base URL handed to installers (enrollment command, bootstrap-config.json)
// and agents. CRITICAL: this MUST resolve to the host that serves /install/*
// and /api/client-metrics/* — i.e. the Express server (api/app host), NOT the
// edge-function host. In production the request host here is
// functions.printyx.net, which serves NEITHER, so the request-host fallback
// below produces installers/agents that point at a dead host.
//   => PUBLIC_API_BASE_URL MUST be set in this edge function's environment.
// Tracked by EDGE-015. See printyx-client/AUDIT.md (Distribution topology).
function platformBaseUrl(req: Request): string {
  const configured = Deno.env.get('PUBLIC_API_BASE_URL');
  if (configured) return configured.replace(/\/$/, '');
  // Fallback only safe in dev/single-host setups. Logs so a misconfigured
  // prod deploy is visible rather than silently shipping broken installers.
  console.warn(
    '[monitoring-clients] PUBLIC_API_BASE_URL is not set — falling back to the request host. ' +
      'Installer/agent URLs will point at this edge host, which does not serve /install or /api/client-metrics. ' +
      'Set PUBLIC_API_BASE_URL to the Express host (see EDGE-015).',
  );
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || url.host;
  return `${proto}://${host}`;
}

// Permission gate. JWT claims are the fast path; on a miss we fall back to a
// DB lookup of the user's role (mirrors _shared/rbac.ts loadPermissions).
// Many tenants' JWTs do not yet carry app_metadata.permissions — the comment
// in blog-agents/index.ts notes the same — so JWT-only checks return false 403
// for legitimately authorized admins. Monitoring clients is a tenant-admin
// feature, so Company Admin (level 7) and above can manage them.
function flattenRolePerms(obj: unknown): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const out: string[] = [];
  const walk = (node: unknown, prefix: string[]): void => {
    if (Array.isArray(node)) {
      for (const v of node) if (typeof v === 'string') out.push([...prefix, v].join('.'));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (v === true) out.push([...prefix, k].join('.'));
        else walk(v, [...prefix, k]);
      }
    }
  };
  walk(obj, []);
  return out;
}

// Result type makes the rejection reason visible to the caller so we can log
// useful diagnostics on a 403 instead of just "missing permission".
type PermissionResult =
  | {
      allowed: true;
      via: 'jwt-platform-admin' | 'jwt-level' | 'jwt-perm' | 'db-cat' | 'db-level' | 'db-perm';
    }
  | { allowed: false; reason: string; details: Record<string, unknown> };

async function userHasAnyPermission(
  user: any,
  perms: string[],
  admin: ReturnType<typeof createSupabaseServiceClient>,
): Promise<PermissionResult> {
  const meta = user?.app_metadata || {};

  // Fast path: JWT claims
  if (meta.isPlatformAdmin === true) return { allowed: true, via: 'jwt-platform-admin' };
  const jwtLevel =
    typeof meta.roleLevel === 'number'
      ? meta.roleLevel
      : typeof meta.role_level === 'number'
        ? meta.role_level
        : null;
  if (jwtLevel !== null && jwtLevel >= 7) return { allowed: true, via: 'jwt-level' };
  const jwtPerms: string[] = Array.isArray(meta.permissions) ? meta.permissions : [];
  if (jwtPerms.length > 0 && perms.some((p) => jwtPerms.includes(p)))
    return { allowed: true, via: 'jwt-perm' };

  // DB fallback — JWT often doesn't carry roleLevel or permissions.
  try {
    const { data, error } = await admin
      .from('users')
      .select('role_id, roles!inner(level, can_access_all_tenants, permissions)')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      return {
        allowed: false,
        reason: 'db_lookup_error',
        details: { error: error.message, userId: user.id },
      };
    }
    if (!data) {
      return {
        allowed: false,
        reason: 'no_users_row',
        details: { userId: user.id, email: user.email },
      };
    }
    const role = (data as any)?.roles;
    if (!role || !data.role_id) {
      return {
        allowed: false,
        reason: 'no_role_assigned',
        details: { userId: user.id, email: user.email },
      };
    }
    if (role.can_access_all_tenants === true) return { allowed: true, via: 'db-cat' };
    if (typeof role.level === 'number' && role.level >= 7)
      return { allowed: true, via: 'db-level' };
    const flat = flattenRolePerms(role.permissions);
    if (perms.some((p) => flat.includes(p))) return { allowed: true, via: 'db-perm' };
    return {
      allowed: false,
      reason: 'role_below_required_level_and_no_perm',
      details: {
        userId: user.id,
        email: user.email,
        roleLevel: role.level,
        canAccessAllTenants: role.can_access_all_tenants,
        haveRolePerms: flat.slice(0, 20),
        neededAnyOf: perms,
      },
    };
  } catch (err) {
    console.error('[monitoring-clients] role lookup threw:', err);
    return {
      allowed: false,
      reason: 'db_lookup_exception',
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

function publicClient(c: Record<string, any>) {
  // Strip the api_key hash and re-emit camelCase keys the UI expects.
  return {
    id: c.id,
    clientId: c.client_id,
    clientName: c.client_name,
    clientType: c.client_type,
    status: c.status,
    location: c.location,
    description: c.description,
    customerId: c.customer_id,
    contactEmail: c.contact_email,
    hostname: c.hostname,
    ipAddress: c.ip_address,
    networkRanges: c.network_ranges,
    configuration: c.configuration,
    clientVersion: c.version,
    lastHeartbeat: c.last_heartbeat,
    lastSuccessfulCollection: c.last_successful_collection,
    isActive: c.is_active,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    apiKeyLastRotated: c.api_key_last_rotated,
  };
}

async function findClientForTenant(admin: any, idOrSlug: string, tenantId: string) {
  // Try UUID primary key first, then the human-readable client_id slug.
  // Wrap the UUID lookup in try/catch — Supabase returns 22P02 (invalid
  // input syntax) when idOrSlug is not a valid UUID, which we want to
  // fall through, not surface as a 500.
  try {
    const { data: byUuid } = await admin
      .from('monitoring_clients')
      .select('*')
      .eq('id', idOrSlug)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (byUuid) return byUuid;
  } catch {
    /* fall through to slug lookup */
  }
  const { data: bySlug } = await admin
    .from('monitoring_clients')
    .select('*')
    .eq('client_id', idOrSlug)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return bySlug;
}

// Lazy-cached installer scripts. Read once per container from the path baked
// into the edge-function image (see Dockerfile.edge-functions).
let _installerScripts: { install: string; uninstall: string } | null = null;
async function loadInstallerScripts(): Promise<typeof _installerScripts> {
  if (_installerScripts) return _installerScripts;
  const dir = Deno.env.get('PRINTYX_INSTALLER_DIR') || '/app/printyx-client/scripts';
  try {
    const install = await Deno.readTextFile(`${dir}/install-windows.ps1`);
    let uninstall = '';
    try {
      uninstall = await Deno.readTextFile(`${dir}/uninstall-windows.ps1`);
    } catch {
      /* uninstall is optional */
    }
    _installerScripts = { install, uninstall };
    return _installerScripts;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// handler
// ──────────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const { parts } = normalizePath(url.pathname, 'monitoring-clients');
  const clientId = parts[0];
  const action = parts[1];

  // ── auth ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const supabase = createSupabaseClient(req);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt);
  if (userError || !user) {
    return createCorsResponse({ message: userError?.message || 'Unauthorized' }, 401, req);
  }

  const tenantId =
    (user.app_metadata?.tenantId as string | undefined) ||
    (user.app_metadata?.tenant_id as string | undefined) ||
    (user.user_metadata?.tenantId as string | undefined) ||
    (user.user_metadata?.tenant_id as string | undefined) ||
    req.headers.get('x-tenant-id') ||
    undefined;
  if (!tenantId) {
    return createCorsResponse({ message: 'No tenant ID found for user' }, 400, req);
  }

  const admin = createSupabaseServiceClient();

  const isWrite = req.method !== 'GET' && req.method !== 'HEAD';
  const requiredPerms = isWrite ? WRITE_PERMS : READ_PERMS;
  const permResult = await userHasAnyPermission(user, requiredPerms, admin);
  if (!permResult.allowed) {
    console.warn('[monitoring-clients] 403:', permResult.reason, permResult.details);
    return createCorsResponse(
      {
        message: `Missing required permission: ${requiredPerms.join(' OR ')}`,
        reason: permResult.reason,
        details: permResult.details,
      },
      403,
      req,
    );
  }

  try {
    // ── list ──────────────────────────────────────────────────────────
    if (req.method === 'GET' && !clientId) {
      const { data: rows, error } = await admin
        .from('monitoring_clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) {
        return createCorsResponse(
          { message: 'Failed to fetch clients', detail: error.message },
          500,
          req,
        );
      }
      return createCorsResponse({ clients: (rows || []).map(publicClient) }, 200, req);
    }

    // ── register ──────────────────────────────────────────────────────
    if (req.method === 'POST' && !clientId) {
      const body = await req.json().catch(() => ({}));
      const clientName = (body.clientName ?? '').toString().trim();
      if (!clientName) {
        return createCorsResponse({ message: 'clientName is required' }, 400, req);
      }
      const clientShortId = `client-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const plain = newApiKey();
      const hash = await sha256Hex(plain);

      const { data: created, error } = await admin
        .from('monitoring_clients')
        .insert({
          tenant_id: tenantId,
          client_id: clientShortId,
          client_name: clientName,
          location: body.location || null,
          customer_id: body.customerId || null,
          api_key: hash,
          api_key_last_rotated: new Date().toISOString(),
          status: 'pending_setup',
          configuration: {
            pollingInterval: 300,
            discoveryEnabled: true,
            retryAttempts: 3,
            timeout: 10000,
            tonerThreshold: 15,
            paperThreshold: 20,
            // Off by default — opt in deliberately. When true, the alert
            // materialiser fires draft supply orders on critical alerts.
            autoOrderEnabled: body.autoOrderEnabled === true,
          },
        })
        .select()
        .single();
      if (error || !created) {
        return createCorsResponse(
          { message: 'Failed to register client', detail: error?.message },
          500,
          req,
        );
      }

      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: created.id,
        activity: 'config_update',
        status: 'success',
        message: `Client '${clientName}' registered`,
        details: { action: 'client_registered', by: user.id },
      });

      return createCorsResponse(
        {
          message: 'Client registered successfully',
          client: {
            ...publicClient(created),
            // Surfaced once on creation — never returned again.
            apiKey: plain,
            tenantId,
          },
        },
        201,
        req,
      );
    }

    // ── detail ────────────────────────────────────────────────────────
    if (req.method === 'GET' && clientId && !action) {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);

      const { data: activity } = await admin
        .from('client_activity_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', client.id)
        .order('timestamp', { ascending: false })
        .limit(100);

      // The UI expects { id, eventType, eventData, severity, message, timestamp }.
      // The DB row uses { activity, status, details, message, timestamp }.
      const activityShaped = (activity || []).map((a: any) => ({
        id: a.id,
        eventType: a.activity,
        eventData: a.details,
        severity: a.status,
        message: a.message,
        timestamp: a.timestamp,
      }));

      return createCorsResponse(
        { ...publicClient(client), activity: activityShaped, activeAlerts: [] },
        200,
        req,
      );
    }

    // ── rotate API key ────────────────────────────────────────────────
    if (req.method === 'POST' && clientId && action === 'regenerate-key') {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);

      const plain = newApiKey();
      const hash = await sha256Hex(plain);
      const { error } = await admin
        .from('monitoring_clients')
        .update({
          api_key: hash,
          api_key_last_rotated: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id);
      if (error) {
        return createCorsResponse(
          { message: 'Failed to regenerate API key', detail: error.message },
          500,
          req,
        );
      }
      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: client.id,
        activity: 'config_update',
        status: 'warning',
        message: 'API key rotated',
        details: { by: user.id },
      });
      return createCorsResponse(
        { message: 'API key regenerated successfully', apiKey: plain },
        200,
        req,
      );
    }

    // ── enrollment token (one-line installer flow) ───────────────────
    if (req.method === 'POST' && clientId && action === 'enrollment-token') {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);

      const body = await req.json().catch(() => ({}));
      const ttlSec = Number(body.ttlSeconds || 0);
      const ttlMs = Math.min(
        Math.max(ttlSec * 1000 || DEFAULT_ENROLL_TOKEN_TTL_MS, 60_000),
        7 * 24 * 60 * 60 * 1000,
      );

      const plain = newEnrollmentToken();
      const tokenHash = await sha256Hex(plain);
      const expiresAt = new Date(Date.now() + ttlMs);

      const { error } = await admin.from('client_enrollment_tokens').insert({
        tenant_id: tenantId,
        client_id: client.id,
        token_hash: tokenHash,
        created_by_user_id: user.id,
        expires_at: expiresAt.toISOString(),
      });
      if (error) {
        return createCorsResponse(
          { message: 'Failed to create enrollment token', detail: error.message },
          500,
          req,
        );
      }

      const baseUrl = platformBaseUrl(req);
      const installCommand =
        `iwr -UseBasicParsing ${baseUrl}/install/printyx-client.ps1 -OutFile $env:TEMP\\printyx-install.ps1; ` +
        `& $env:TEMP\\printyx-install.ps1 -EnrollmentToken '${plain}' -Endpoint '${baseUrl}'`;

      return createCorsResponse(
        {
          token: plain,
          expiresAt: expiresAt.toISOString(),
          endpoint: baseUrl,
          clientId: client.client_id,
          installCommand,
        },
        201,
        req,
      );
    }

    // ── installer bundle (zip) ───────────────────────────────────────
    if (req.method === 'GET' && clientId && action === 'installer.zip') {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);

      const scripts = await loadInstallerScripts();
      if (!scripts) {
        return createCorsResponse(
          {
            message:
              'Installer scripts not found inside the edge-function image. Re-deploy with printyx-client/scripts/ included (see Dockerfile.edge-functions).',
          },
          503,
          req,
        );
      }

      const ttlHours = Math.min(Math.max(Number(url.searchParams.get('ttlHours')) || 24, 1), 168);
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      const plain = newEnrollmentToken();
      const tokenHash = await sha256Hex(plain);

      const { error: insErr } = await admin.from('client_enrollment_tokens').insert({
        tenant_id: tenantId,
        client_id: client.id,
        token_hash: tokenHash,
        created_by_user_id: user.id,
        expires_at: expiresAt.toISOString(),
      });
      if (insErr) {
        return createCorsResponse(
          { message: 'Failed to issue enrollment token for bundle', detail: insErr.message },
          500,
          req,
        );
      }

      const bootstrap = {
        endpoint: platformBaseUrl(req),
        tenantId,
        clientId: client.client_id,
        clientName: client.client_name,
        customerId: client.customer_id,
        enrollmentToken: plain,
        enrollmentExpiresAt: expiresAt.toISOString(),
      };

      const zip = new JSZip();
      zip.file('install-windows.ps1', scripts.install);
      if (scripts.uninstall) zip.file('uninstall-windows.ps1', scripts.uninstall);
      zip.file('bootstrap-config.json', JSON.stringify(bootstrap, null, 2));
      zip.file('README.txt', README_FOR_BUNDLE);

      const blob: Uint8Array = await zip.generateAsync({ type: 'uint8array' });

      const headers: Record<string, string> = {
        ...getCorsHeaders(req.headers.get('origin')),
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="printyx-client-${client.client_id}.zip"`,
        'Cache-Control': 'no-store',
      };
      return new Response(blob, { status: 200, headers });
    }

    // ── enqueue command ──────────────────────────────────────────────
    if (req.method === 'POST' && clientId && action === 'commands') {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);

      const body = await req.json().catch(() => ({}));
      const command = body.command;
      if (!command || !SUPPORTED_COMMANDS.has(command)) {
        return createCorsResponse(
          {
            message: `Unsupported command. Use one of: ${[...SUPPORTED_COMMANDS].join(', ')}`,
          },
          400,
          req,
        );
      }

      const ttlSec = Number(body.ttlSeconds || 0);
      const ttlMs = Math.min(
        Math.max(ttlSec * 1000 || DEFAULT_COMMAND_TTL_MS, 60_000),
        24 * 60 * 60 * 1000,
      );

      const { data: created, error } = await admin
        .from('client_commands')
        .insert({
          tenant_id: tenantId,
          client_id: client.id,
          command,
          payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
          status: 'queued',
          issued_by_user_id: user.id,
          expires_at: new Date(Date.now() + ttlMs).toISOString(),
        })
        .select()
        .single();
      if (error || !created) {
        return createCorsResponse(
          { message: 'Failed to queue command', detail: error?.message },
          500,
          req,
        );
      }

      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: client.id,
        activity: 'config_update',
        status: 'success',
        message: `Command '${command}' queued`,
        details: { commandId: created.id, by: user.id },
      });

      return createCorsResponse(
        {
          command: {
            id: created.id,
            command: created.command,
            status: created.status,
          },
        },
        201,
        req,
      );
    }

    // ── list commands ────────────────────────────────────────────────
    if (req.method === 'GET' && clientId && action === 'commands') {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);

      const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 500);
      const { data: rows, error } = await admin
        .from('client_commands')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        return createCorsResponse(
          { message: 'Failed to list commands', detail: error.message },
          500,
          req,
        );
      }
      const commands = (rows || []).map((r: any) => ({
        id: r.id,
        command: r.command,
        status: r.status,
        result: r.result,
        errorMessage: r.error_message,
        createdAt: r.created_at,
        dispatchedAt: r.dispatched_at,
        completedAt: r.completed_at,
        expiresAt: r.expires_at,
      }));
      return createCorsResponse({ commands }, 200, req);
    }

    // ── update (partial) ─────────────────────────────────────────────
    // Toggles/edits on an existing client. autoUpdate + autoOrderEnabled live
    // in the JSON config blob (read-modify-write); customerId/location/
    // clientName are top-level columns.
    if ((req.method === 'PATCH' || req.method === 'PUT') && clientId && !action) {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);

      const body = await req.json().catch(() => ({}));
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };

      if (typeof body.customerId === 'string' || body.customerId === null) {
        updates.customer_id = body.customerId || null;
      }
      if (typeof body.location === 'string') updates.location = body.location;
      if (typeof body.clientName === 'string' && body.clientName.trim()) {
        updates.client_name = body.clientName.trim();
      }

      const cfg = (client.configuration as Record<string, any>) || {};
      const nextCfg = { ...cfg };
      let cfgChanged = false;
      if (typeof body.autoUpdate === 'boolean') {
        nextCfg.autoUpdate = body.autoUpdate;
        cfgChanged = true;
      }
      if (typeof body.autoOrderEnabled === 'boolean') {
        nextCfg.autoOrderEnabled = body.autoOrderEnabled;
        cfgChanged = true;
      }
      if (cfgChanged) updates.configuration = nextCfg;

      const { data: updated, error } = await admin
        .from('monitoring_clients')
        .update(updates)
        .eq('id', client.id)
        .select()
        .single();
      if (error) {
        return createCorsResponse(
          { message: 'Failed to update client', detail: error.message },
          500,
          req,
        );
      }

      if (typeof body.autoUpdate === 'boolean') {
        await admin.from('client_activity_logs').insert({
          tenant_id: tenantId,
          client_id: client.id,
          activity: 'config_update',
          status: 'success',
          message: `Auto-update ${body.autoUpdate ? 'enabled' : 'disabled'}`,
          details: { by: user.id, autoUpdate: body.autoUpdate },
        });
      }

      return createCorsResponse({ client: publicClient(updated) }, 200, req);
    }

    // ── delete ───────────────────────────────────────────────────────
    if (req.method === 'DELETE' && clientId && !action) {
      const client = await findClientForTenant(admin, clientId, tenantId);
      if (!client) return createCorsResponse({ message: 'Client not found' }, 404, req);
      const { error } = await admin.from('monitoring_clients').delete().eq('id', client.id);
      if (error) {
        return createCorsResponse(
          { message: 'Failed to delete client', detail: error.message },
          500,
          req,
        );
      }
      return createCorsResponse({ message: 'Client deleted' }, 200, req);
    }

    return createCorsResponse({ message: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('Unexpected error in monitoring-clients:', err);
    return createCorsResponse(
      { message: err instanceof Error ? err.message : 'Internal server error' },
      500,
      req,
    );
  }
}
