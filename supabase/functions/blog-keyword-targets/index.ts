// Blog Keyword Targets Edge Function (US-BLOG-013)
//
// CRUD over `blog_distribution_targets` rows where platform is a keyword
// research adapter (dataforseo). Reuses the existing table since the shape
// matches: tenant_id + platform + encrypted_config + is_active + last health
// check fields. Same encryption + audit pattern as US-BLOG-006.
//
// Routes (gated to platform admin OR users holding blog.refresh.manage):
//   GET    /blog-keyword-targets              list keyword targets
//   POST   /blog-keyword-targets              create new target
//   GET    /blog-keyword-targets/:id          fetch one (creds redacted)
//   PATCH  /blog-keyword-targets/:id          update
//   DELETE /blog-keyword-targets/:id          soft delete
//   POST   /blog-keyword-targets/:id/test     run healthCheck against the adapter

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import {
  encryptCredential,
  decryptCredential,
  type EncryptedCredential,
} from '../_shared/credential-vault.ts';
import {
  KEYWORD_PLATFORMS,
  getKeywordAdapter,
  type KeywordPlatform,
} from '../_shared/blog/keyword/index.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const targetCreateSchema = z.object({
  platform: z.enum(KEYWORD_PLATFORMS),
  account_handle: z.string().min(1).max(255),
  display_name: z.string().max(255).nullable().optional(),
  base_url: z.string().url().max(1000).nullable().optional(),
  api_key: z.string().min(1).max(2000),
  api_secret: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
});

const targetPatchSchema = z.object({
  account_handle: z.string().min(1).max(255).optional(),
  display_name: z.string().max(255).nullable().optional(),
  base_url: z.string().url().max(1000).nullable().optional(),
  api_key: z.string().min(1).max(2000).optional(),
  api_secret: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
});

interface EncryptedKeywordConfig {
  base_url?: string | null;
  api_key: EncryptedCredential;
  api_secret?: EncryptedCredential | null;
}

function hasBlogRefreshManage(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.refresh.manage')) return true;
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

    if (!hasBlogRefreshManage(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.refresh.manage required' }, 403, req);
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
    const { parts } = normalizePath(url.pathname, 'blog-keyword-targets');
    const id = parts[0];
    const action = parts[1];

    if (!id) {
      if (req.method === 'GET') return await listTargets(admin, tenantId, req);
      if (req.method === 'POST') return await createTarget(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    if (id && action === 'test' && req.method === 'POST') {
      return await testTarget(admin, tenantId, user.id, id, req);
    }

    if (req.method === 'GET') return await getTarget(admin, tenantId, id, req);
    if (req.method === 'PATCH') return await updateTarget(admin, tenantId, user.id, id, req);
    if (req.method === 'DELETE') return await deleteTarget(admin, tenantId, user.id, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-keyword-targets handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

function redactTargetForResponse(target: Record<string, unknown>): Record<string, unknown> {
  const config = (target.encrypted_config ?? {}) as Partial<EncryptedKeywordConfig>;
  return {
    ...target,
    encrypted_config: undefined,
    base_url: config.base_url ?? null,
    api_key_set: !!config.api_key,
    api_secret_set: !!config.api_secret,
  };
}

async function listTargets(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('platform', KEYWORD_PLATFORMS as unknown as string[])
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }

  return createCorsResponse({ targets: (data ?? []).map(redactTargetForResponse) }, 200, req);
}

async function getTarget(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }
  if (!data) {
    return createCorsResponse({ error: 'Keyword target not found' }, 404, req);
  }
  if (!KEYWORD_PLATFORMS.includes(data.platform as KeywordPlatform)) {
    return createCorsResponse({ error: 'Target is not a keyword adapter' }, 400, req);
  }

  return createCorsResponse({ target: redactTargetForResponse(data) }, 200, req);
}

async function createTarget(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = targetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const config: EncryptedKeywordConfig = {
    base_url: parsed.data.base_url ?? null,
    api_key: await encryptCredential(parsed.data.api_key),
    api_secret: parsed.data.api_secret ? await encryptCredential(parsed.data.api_secret) : null,
  };

  const { data: created, error } = await admin
    .from('blog_distribution_targets')
    .insert({
      tenant_id: tenantId,
      platform: parsed.data.platform,
      account_handle: parsed.data.account_handle,
      display_name: parsed.data.display_name ?? parsed.data.account_handle,
      encrypted_config: config as unknown as Record<string, unknown>,
      is_active: parsed.data.is_active ?? true,
      created_by_user_id: userId,
    })
    .select('*')
    .single();

  if (error || !created) {
    return createCorsResponse(
      { error: error?.message ?? 'Failed to create keyword target' },
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
      action: 'blog_keyword_target.create',
      targetType: 'blog_distribution_target',
      targetId: created.id,
      beforeState: null,
      afterState: redactTargetForResponse(created),
      summary: `Created ${parsed.data.platform} keyword target "${parsed.data.account_handle}"`,
    }),
  );

  return createCorsResponse({ target: redactTargetForResponse(created) }, 201, req);
}

async function updateTarget(
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

  const parsed = targetPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: existing, error: readError } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!existing) {
    return createCorsResponse({ error: 'Keyword target not found' }, 404, req);
  }
  if (!KEYWORD_PLATFORMS.includes(existing.platform as KeywordPlatform)) {
    return createCorsResponse({ error: 'Target is not a keyword adapter' }, 400, req);
  }

  const existingConfig = (existing.encrypted_config ?? {}) as Partial<EncryptedKeywordConfig>;
  const newConfig: EncryptedKeywordConfig = {
    base_url:
      parsed.data.base_url !== undefined ? parsed.data.base_url : (existingConfig.base_url ?? null),
    api_key: parsed.data.api_key
      ? await encryptCredential(parsed.data.api_key)
      : (existingConfig.api_key as EncryptedCredential),
    api_secret:
      parsed.data.api_secret !== undefined
        ? parsed.data.api_secret
          ? await encryptCredential(parsed.data.api_secret)
          : null
        : (existingConfig.api_secret ?? null),
  };

  if (!newConfig.api_key) {
    return createCorsResponse({ error: 'api_key is required' }, 400, req);
  }

  const updates: Record<string, unknown> = {
    encrypted_config: newConfig as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.account_handle !== undefined) updates.account_handle = parsed.data.account_handle;
  if (parsed.data.display_name !== undefined) updates.display_name = parsed.data.display_name;
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

  const { data: updated, error: updateError } = await admin
    .from('blog_distribution_targets')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return createCorsResponse(
      { error: updateError?.message ?? 'Failed to update keyword target' },
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
      action: 'blog_keyword_target.update',
      targetType: 'blog_distribution_target',
      targetId: updated.id,
      beforeState: redactTargetForResponse(existing),
      afterState: redactTargetForResponse(updated),
      summary: `Updated ${updated.platform} keyword target "${updated.account_handle}"`,
    }),
  );

  return createCorsResponse({ target: redactTargetForResponse(updated) }, 200, req);
}

async function deleteTarget(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: existing, error: readError } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!existing) {
    return createCorsResponse({ error: 'Keyword target not found' }, 404, req);
  }

  const nowIso = new Date().toISOString();
  const { data: deleted, error } = await admin
    .from('blog_distribution_targets')
    .update({ deleted_at: nowIso, is_active: false, updated_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !deleted) {
    return createCorsResponse(
      { error: error?.message ?? 'Failed to delete keyword target' },
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
      action: 'blog_keyword_target.delete',
      targetType: 'blog_distribution_target',
      targetId: id,
      beforeState: redactTargetForResponse(existing),
      afterState: redactTargetForResponse(deleted),
      summary: `Deleted ${existing.platform} keyword target "${existing.account_handle}"`,
    }),
  );

  return createCorsResponse({ target: redactTargetForResponse(deleted) }, 200, req);
}

async function testTarget(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: target, error: readError } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    return createCorsResponse({ error: readError.message }, 500, req);
  }
  if (!target) {
    return createCorsResponse({ error: 'Keyword target not found' }, 404, req);
  }

  const adapter = getKeywordAdapter(target.platform);
  if (!adapter) {
    return createCorsResponse(
      { error: `No adapter registered for platform "${target.platform}"` },
      400,
      req,
    );
  }

  const config = (target.encrypted_config ?? {}) as Partial<EncryptedKeywordConfig>;
  if (!config.api_key) {
    return createCorsResponse({ error: 'Keyword target is missing api_key' }, 400, req);
  }

  let apiKey: string;
  let apiSecret: string | undefined;
  try {
    apiKey = await decryptCredential(config.api_key);
    apiSecret = config.api_secret ? await decryptCredential(config.api_secret) : undefined;
  } catch (err) {
    return createCorsResponse(
      { error: `Credential decryption failed: ${err instanceof Error ? err.message : 'unknown'}` },
      500,
      req,
    );
  }

  const result = await adapter.healthCheck({
    apiKey,
    apiSecret,
    baseUrl: config.base_url ?? undefined,
  });

  await admin
    .from('blog_distribution_targets')
    .update({
      last_health_check_at: result.checked_at,
      last_health_check_ok: result.ok,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_keyword_target.health_check',
      targetType: 'blog_distribution_target',
      targetId: id,
      summary: `Health check ${result.ok ? 'OK' : 'FAILED'} for ${target.platform} "${target.account_handle}"${result.message ? `: ${result.message}` : ''}`,
    }),
  );

  return createCorsResponse({ result }, 200, req);
}
