// Blog Agents Edge Function (US-BLOG-086)
//
// Global agent kill switch for the Platform Admin Blog System. Lets a
// platform admin pause and resume every agent (auto-refresh, draft pipeline,
// distribution scheduler, outreach agent) for their tenant in one click.
//
// Routes (platform admin only):
//   GET   /blog-agents/settings        fetch current agent_settings row
//   POST  /blog-agents/pause           body: { reason: string } — engages kill switch
//   POST  /blog-agents/resume          body: { note?: string } — disengages
//   PATCH /blog-agents/settings        body: { auto_refresh_requires_review?: boolean }
//
// Every action writes a row to blog_audit_log so we have a forensic trail
// of who paused, when, and why.
//
// Source PRD: blog-system-prd.json US-BLOG-086 (added beyond original 85
// stories because production-safe full autonomy needs a panic button — see
// scope decision 5D in progress.txt).

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { getAgentSettings } from '../_shared/blog/safety/kill-switch.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const pauseSchema = z.object({
  reason: z.string().min(1).max(2000),
});

const resumeSchema = z.object({
  note: z.string().max(2000).optional(),
});

const settingsPatchSchema = z.object({
  auto_refresh_requires_review: z.boolean().optional(),
});

function isPlatformAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin';
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    if (!isPlatformAdmin(user)) {
      return createCorsResponse({ error: 'Forbidden: platform admin access required' }, 403, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-agents');
    const action = parts[0];

    if (req.method === 'GET' && action === 'settings') {
      return await getSettings(admin, tenantId, req);
    }

    if (req.method === 'PATCH' && action === 'settings') {
      return await patchSettings(admin, tenantId, user.id, req);
    }

    if (req.method === 'POST' && action === 'pause') {
      return await pauseAgents(admin, tenantId, user.id, req);
    }

    if (req.method === 'POST' && action === 'resume') {
      return await resumeAgents(admin, tenantId, user.id, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-agents handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function getSettings(admin: Admin, tenantId: string, req: Request) {
  const settings = await getAgentSettings(admin, tenantId);
  return createCorsResponse({ settings }, 200, req);
}

async function patchSettings(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const before = await getAgentSettings(admin, tenantId);

  const { data: updated, error: updateError } = await admin
    .from('blog_agent_settings')
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse(
      { error: updateError?.message ?? 'Failed to update settings' },
      500,
      req,
    );
  }

  await admin.from('blog_audit_log').insert({
    tenant_id: tenantId,
    actor_user_id: userId,
    actor_type: 'user',
    action: 'blog_agent_settings.update',
    target_type: 'blog_agent_settings',
    target_id: updated.id,
    before_state: before,
    after_state: updated,
    summary: 'Updated blog agent settings',
  });

  return createCorsResponse({ settings: updated }, 200, req);
}

async function pauseAgents(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = pauseSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Ensure the row exists
  const before = await getAgentSettings(admin, tenantId);

  if (before.agents_paused) {
    return createCorsResponse(
      {
        error: 'Agents are already paused',
        settings: before,
      },
      409,
      req,
    );
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from('blog_agent_settings')
    .update({
      agents_paused: true,
      paused_at: nowIso,
      paused_by_user_id: userId,
      paused_reason: parsed.data.reason,
      updated_at: nowIso,
    })
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse(
      { error: updateError?.message ?? 'Failed to pause agents' },
      500,
      req,
    );
  }

  await admin.from('blog_audit_log').insert({
    tenant_id: tenantId,
    actor_user_id: userId,
    actor_type: 'user',
    action: 'blog_agent_settings.kill_switch_engaged',
    target_type: 'blog_agent_settings',
    target_id: updated.id,
    before_state: before,
    after_state: updated,
    summary: `Kill switch ENGAGED. Reason: ${parsed.data.reason}`,
  });

  return createCorsResponse({ settings: updated }, 200, req);
}

async function resumeAgents(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      // Body is optional for resume — empty is fine
      body = {};
    }
  }

  const parsed = resumeSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const before = await getAgentSettings(admin, tenantId);

  if (!before.agents_paused) {
    return createCorsResponse(
      {
        error: 'Agents are not paused',
        settings: before,
      },
      409,
      req,
    );
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from('blog_agent_settings')
    .update({
      agents_paused: false,
      paused_at: null,
      paused_by_user_id: null,
      paused_reason: null,
      updated_at: nowIso,
    })
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse(
      { error: updateError?.message ?? 'Failed to resume agents' },
      500,
      req,
    );
  }

  await admin.from('blog_audit_log').insert({
    tenant_id: tenantId,
    actor_user_id: userId,
    actor_type: 'user',
    action: 'blog_agent_settings.kill_switch_disengaged',
    target_type: 'blog_agent_settings',
    target_id: updated.id,
    before_state: before,
    after_state: updated,
    summary: parsed.data.note
      ? `Kill switch DISENGAGED. Note: ${parsed.data.note}`
      : 'Kill switch DISENGAGED.',
  });

  return createCorsResponse({ settings: updated }, 200, req);
}
