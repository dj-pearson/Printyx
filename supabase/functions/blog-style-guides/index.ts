// Blog Style Guides Edge Function (US-BLOG-005)
//
// CRUD for blog_style_guides. Each guide is a tenant-scoped collection of
// prose-level rules (regex / substring patterns with severity), plus a set
// of built-in rule pack toggles (AP, Chicago, MLA, plain-language, inclusive).
//
// v1 scope: CRUD only. The in-editor real-time linter and server-side
// publish-gating land in US-BLOG-008 (editor) and US-BLOG-040 (pre-publish QA).
//
// Routes (gated to platform admin OR users holding blog.style_guide.edit):
//   GET    /blog-style-guides                  list guides for tenant
//   POST   /blog-style-guides                  create new guide
//   GET    /blog-style-guides/:id              fetch one
//   PATCH  /blog-style-guides/:id              update
//   DELETE /blog-style-guides/:id              soft delete (sets deleted_at)
//   POST   /blog-style-guides/:id/set-default  flip is_default to this guide
//
// Audit log: every mutating action writes a row via writeAuditLog().

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const SEVERITIES = ['error', 'warn', 'info'] as const;
const MATCH_TYPES = ['regex', 'substring'] as const;
const RULE_PACKS = ['ap', 'chicago', 'mla', 'plain-language', 'inclusive'] as const;

const ruleSchema = z.object({
  pattern: z.string().min(1).max(2000),
  match_type: z.enum(MATCH_TYPES),
  severity: z.enum(SEVERITIES),
  message: z.string().min(1).max(500),
  replacement: z.string().max(2000).nullable().optional(),
});

const guideCreateSchema = z.object({
  name: z.string().min(1).max(200),
  rules: z.array(ruleSchema).max(500).nullable().optional(),
  rule_packs: z.array(z.enum(RULE_PACKS)).max(RULE_PACKS.length).nullable().optional(),
  is_default: z.boolean().optional(),
});

const guidePatchSchema = guideCreateSchema.partial();

function hasBlogStyleGuideEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.style_guide.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
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

    if (!hasBlogStyleGuideEdit(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.style_guide.edit required' }, 403, req);
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
    const { parts } = normalizePath(url.pathname, 'blog-style-guides');
    const id = parts[0];
    const action = parts[1];

    if (!id) {
      if (req.method === 'GET') return await listGuides(admin, tenantId, req);
      if (req.method === 'POST') return await createGuide(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    if (id && action === 'set-default' && req.method === 'POST') {
      return await setDefaultGuide(admin, tenantId, user.id, id, req);
    }

    if (req.method === 'GET') return await getGuide(admin, tenantId, id, req);
    if (req.method === 'PATCH') return await updateGuide(admin, tenantId, user.id, id, req);
    if (req.method === 'DELETE') return await deleteGuide(admin, tenantId, user.id, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-style-guides handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listGuides(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_style_guides')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }

  return createCorsResponse({ guides: data ?? [] }, 200, req);
}

async function getGuide(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_style_guides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }
  if (!data) {
    return createCorsResponse({ error: 'Style guide not found' }, 404, req);
  }

  return createCorsResponse({ guide: data }, 200, req);
}

async function createGuide(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = guideCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const isDefault = parsed.data.is_default === true;

  if (isDefault) {
    await admin
      .from('blog_style_guides')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('is_default', true);
  }

  const { data: created, error } = await admin
    .from('blog_style_guides')
    .insert({
      tenant_id: tenantId,
      created_by_user_id: userId,
      ...parsed.data,
    })
    .select('*')
    .single();

  if (error || !created) {
    return createCorsResponse(
      { error: error?.message ?? 'Failed to create style guide' },
      500,
      req,
    );
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_style_guide.create',
      targetType: 'blog_style_guide',
      targetId: created.id,
      beforeState: null,
      afterState: created,
      summary: `Created style guide "${created.name}"${isDefault ? ' (set as default)' : ''}`,
    }),
  );

  return createCorsResponse({ guide: created }, 201, req);
}

async function updateGuide(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = guidePatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: existing, error: readError } = await admin
    .from('blog_style_guides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!existing) {
    return createCorsResponse({ error: 'Style guide not found' }, 404, req);
  }

  if (parsed.data.is_default === true && !existing.is_default) {
    await admin
      .from('blog_style_guides')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .neq('id', id);
  }

  const { data: updated, error: updateError } = await admin
    .from('blog_style_guides')
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse(
      { error: updateError?.message ?? 'Failed to update style guide' },
      500,
      req,
    );
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_style_guide.update',
      targetType: 'blog_style_guide',
      targetId: updated.id,
      beforeState: existing,
      afterState: updated,
      summary: `Updated style guide "${updated.name}"`,
    }),
  );

  return createCorsResponse({ guide: updated }, 200, req);
}

async function deleteGuide(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: existing, error: readError } = await admin
    .from('blog_style_guides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!existing) {
    return createCorsResponse({ error: 'Style guide not found' }, 404, req);
  }

  const nowIso = new Date().toISOString();
  const { data: deleted, error } = await admin
    .from('blog_style_guides')
    .update({ deleted_at: nowIso, is_default: false, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !deleted) {
    return createCorsResponse(
      { error: error?.message ?? 'Failed to delete style guide' },
      500,
      req,
    );
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_style_guide.delete',
      targetType: 'blog_style_guide',
      targetId: id,
      beforeState: existing,
      afterState: deleted,
      summary: `Deleted style guide "${existing.name}"`,
    }),
  );

  return createCorsResponse({ guide: deleted }, 200, req);
}

async function setDefaultGuide(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: target, error: readError } = await admin
    .from('blog_style_guides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!target) {
    return createCorsResponse({ error: 'Style guide not found' }, 404, req);
  }

  if (target.is_default) {
    return createCorsResponse({ guide: target, alreadyDefault: true }, 200, req);
  }

  const nowIso = new Date().toISOString();
  await admin
    .from('blog_style_guides')
    .update({ is_default: false, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('is_default', true);

  const { data: updated, error: updateError } = await admin
    .from('blog_style_guides')
    .update({ is_default: true, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse(
      { error: updateError?.message ?? 'Failed to set default style guide' },
      500,
      req,
    );
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_style_guide.set_default',
      targetType: 'blog_style_guide',
      targetId: updated.id,
      beforeState: target,
      afterState: updated,
      summary: `Set "${updated.name}" as the default style guide`,
    }),
  );

  return createCorsResponse({ guide: updated }, 200, req);
}
