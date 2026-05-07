// Blog Brand Voices Edge Function (US-BLOG-004)
//
// CRUD for blog_brand_voices. Brand voice profiles are reusable tone/persona
// configs that get serialized into AI system prompts (draft generation,
// rewrite toolbar, fact-checker, auto-refresh agent — every AI step).
//
// Routes (gated to platform admin OR users holding blog.brand_voice.edit):
//   GET    /blog-brand-voices                  list voices for tenant
//   POST   /blog-brand-voices                  create new voice
//   GET    /blog-brand-voices/:id              fetch one
//   PATCH  /blog-brand-voices/:id              update
//   DELETE /blog-brand-voices/:id              soft delete (sets deleted_at)
//   POST   /blog-brand-voices/:id/set-default  flip is_default to this voice;
//                                              clears it from any other voice
//                                              in the same tenant
//
// Audit log: every mutating action writes a row via writeAuditLog().

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const POVS = ['first', 'second', 'third'] as const;
const READING_LEVELS = ['grade-6', 'grade-8', 'grade-10', 'grade-12', 'grade-14'] as const;

const voiceAttributesSchema = z
  .object({
    humor: z.number().int().min(1).max(5).optional(),
    formality: z.number().int().min(1).max(5).optional(),
    technicality: z.number().int().min(1).max(5).optional(),
  })
  .partial()
  .strict();

const voiceCreateSchema = z.object({
  name: z.string().min(1).max(200),
  tone: z.string().max(2000).nullable().optional(),
  banned_phrases: z.array(z.string().min(1)).max(100).nullable().optional(),
  preferred_phrases: z.array(z.string().min(1)).max(100).nullable().optional(),
  reading_level_target: z.enum(READING_LEVELS).nullable().optional(),
  persona_description: z.string().max(4000).nullable().optional(),
  sample_corpus: z.string().max(10000).nullable().optional(),
  pov: z.enum(POVS).nullable().optional(),
  voice_attributes: voiceAttributesSchema.nullable().optional(),
  is_default: z.boolean().optional(),
});

const voicePatchSchema = voiceCreateSchema.partial();

function hasBlogVoiceEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.brand_voice.edit')) return true;
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

    if (!hasBlogVoiceEdit(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.brand_voice.edit required' }, 403, req);
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
    const { parts } = normalizePath(url.pathname, 'blog-brand-voices');
    const id = parts[0];
    const action = parts[1];

    if (!id) {
      if (req.method === 'GET') return await listVoices(admin, tenantId, req);
      if (req.method === 'POST') return await createVoice(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    if (id && action === 'set-default' && req.method === 'POST') {
      return await setDefaultVoice(admin, tenantId, user.id, id, req);
    }

    if (req.method === 'GET') return await getVoice(admin, tenantId, id, req);
    if (req.method === 'PATCH') return await updateVoice(admin, tenantId, user.id, id, req);
    if (req.method === 'DELETE') return await deleteVoice(admin, tenantId, user.id, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-brand-voices handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listVoices(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_brand_voices')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }

  return createCorsResponse({ voices: data ?? [] }, 200, req);
}

async function getVoice(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_brand_voices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }
  if (!data) {
    return createCorsResponse({ error: 'Brand voice not found' }, 404, req);
  }

  return createCorsResponse({ voice: data }, 200, req);
}

async function createVoice(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = voiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const isDefault = parsed.data.is_default === true;

  // If creating as default, clear is_default on every existing voice in the tenant first
  if (isDefault) {
    await admin
      .from('blog_brand_voices')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('is_default', true);
  }

  const { data: created, error } = await admin
    .from('blog_brand_voices')
    .insert({
      tenant_id: tenantId,
      created_by_user_id: userId,
      ...parsed.data,
    })
    .select('*')
    .single();

  if (error || !created) {
    return createCorsResponse(
      { error: error?.message ?? 'Failed to create brand voice' },
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
      action: 'blog_brand_voice.create',
      targetType: 'blog_brand_voice',
      targetId: created.id,
      beforeState: null,
      afterState: created,
      summary: `Created brand voice "${created.name}"${isDefault ? ' (set as default)' : ''}`,
    }),
  );

  return createCorsResponse({ voice: created }, 201, req);
}

async function updateVoice(
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

  const parsed = voicePatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Fetch current row for audit + tenant guard
  const { data: existing, error: readError } = await admin
    .from('blog_brand_voices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!existing) {
    return createCorsResponse({ error: 'Brand voice not found' }, 404, req);
  }

  // If setting as default, clear other defaults
  if (parsed.data.is_default === true && !existing.is_default) {
    await admin
      .from('blog_brand_voices')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .neq('id', id);
  }

  const { data: updated, error: updateError } = await admin
    .from('blog_brand_voices')
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
      { error: updateError?.message ?? 'Failed to update brand voice' },
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
      action: 'blog_brand_voice.update',
      targetType: 'blog_brand_voice',
      targetId: updated.id,
      beforeState: existing,
      afterState: updated,
      summary: `Updated brand voice "${updated.name}"`,
    }),
  );

  return createCorsResponse({ voice: updated }, 200, req);
}

async function deleteVoice(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: existing, error: readError } = await admin
    .from('blog_brand_voices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!existing) {
    return createCorsResponse({ error: 'Brand voice not found' }, 404, req);
  }

  const nowIso = new Date().toISOString();
  const { data: deleted, error } = await admin
    .from('blog_brand_voices')
    .update({ deleted_at: nowIso, is_default: false, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !deleted) {
    return createCorsResponse(
      { error: error?.message ?? 'Failed to delete brand voice' },
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
      action: 'blog_brand_voice.delete',
      targetType: 'blog_brand_voice',
      targetId: id,
      beforeState: existing,
      afterState: deleted,
      summary: `Deleted brand voice "${existing.name}"`,
    }),
  );

  return createCorsResponse({ voice: deleted }, 200, req);
}

async function setDefaultVoice(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: target, error: readError } = await admin
    .from('blog_brand_voices')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!target) {
    return createCorsResponse({ error: 'Brand voice not found' }, 404, req);
  }

  if (target.is_default) {
    return createCorsResponse({ voice: target, alreadyDefault: true }, 200, req);
  }

  const nowIso = new Date().toISOString();
  // Clear existing defaults
  await admin
    .from('blog_brand_voices')
    .update({ is_default: false, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('is_default', true);

  // Set new default
  const { data: updated, error: updateError } = await admin
    .from('blog_brand_voices')
    .update({ is_default: true, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse(
      { error: updateError?.message ?? 'Failed to set default brand voice' },
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
      action: 'blog_brand_voice.set_default',
      targetType: 'blog_brand_voice',
      targetId: updated.id,
      beforeState: target,
      afterState: updated,
      summary: `Set "${updated.name}" as the default brand voice`,
    }),
  );

  return createCorsResponse({ voice: updated }, 200, req);
}
