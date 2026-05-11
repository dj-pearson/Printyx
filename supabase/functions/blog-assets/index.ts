// Blog Assets Edge Function (US-BLOG-010)
//
// Reusable asset library: images, quotes, data tables, expert contacts, files.
// Asset metadata lives in blog_assets; the underlying file (when present)
// lives in the Supabase Storage bucket `blog-assets` at the path
// `<tenant_id>/<uuid>-<filename>`. Tenant isolation is enforced both at the
// DB row level (every query filters by tenant_id) and at the storage path
// level (every signed URL is generated against a tenant-scoped path).
//
// Routes (gated to platform admin OR users holding blog.post.edit — the same
// permission used by the editor since assets are inserted into posts):
//   GET    /blog-assets?type=&search=&limit=&offset=    list (newest first; filters: type, free-text)
//   POST   /blog-assets                                  create asset metadata
//                                                          (storage_path comes from a prior signed-upload)
//   POST   /blog-assets/upload-url                       issue a signed upload URL for a new file
//                                                          body: { filename, mime_type }
//                                                          returns: { signed_url, storage_path, token }
//   GET    /blog-assets/:id                              fetch one
//   PATCH  /blog-assets/:id                              update metadata (title, description, alt, attribution, expert_metadata)
//   DELETE /blog-assets/:id                              soft delete (sets deleted_at; storage object NOT auto-removed)
//
// All mutating actions audit-log via writeAuditLog().

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const ASSET_TYPES = ['image', 'quote', 'data', 'expert_contact', 'file'] as const;
const BUCKET = 'blog-assets';

const expertMetadataSchema = z
  .object({
    name: z.string().max(200).optional(),
    title: z.string().max(200).optional(),
    org: z.string().max(200).optional(),
    contact: z.string().max(500).optional(),
    expertise: z.array(z.string().max(64)).max(20).optional(),
    bio: z.string().max(4000).optional(),
  })
  .partial()
  .strict();

const assetCreateSchema = z.object({
  asset_type: z.enum(ASSET_TYPES),
  title: z.string().max(500).nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
  storage_path: z.string().max(1000).nullable().optional(),
  mime_type: z.string().max(100).nullable().optional(),
  file_size_bytes: z
    .number()
    .int()
    .min(0)
    .max(50 * 1024 * 1024)
    .nullable()
    .optional(),
  alt_text: z.string().max(2000).nullable().optional(),
  attribution: z.string().max(2000).nullable().optional(),
  expert_metadata: expertMetadataSchema.nullable().optional(),
});

const assetPatchSchema = assetCreateSchema.partial().omit({ asset_type: true });

const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(200),
  mime_type: z.string().min(1).max(100),
});

function hasBlogAssetEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.post.edit') || perms.includes('blog.asset.edit'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

// Strip path-traversal characters from a user-supplied filename and clamp
// length. The result is appended after a server-generated uuid so collisions
// are not possible, but we still want a readable suffix.
function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
  return cleaned || 'file';
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

    if (!hasBlogAssetEdit(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.post.edit required' }, 403, req);
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
    const { parts } = normalizePath(url.pathname, 'blog-assets');
    const id = parts[0];

    if (!id) {
      if (req.method === 'GET') return await listAssets(admin, tenantId, url, req);
      if (req.method === 'POST') return await createAsset(admin, tenantId, user.id, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    if (id === 'upload-url' && req.method === 'POST') {
      return await issueUploadUrl(admin, tenantId, req);
    }

    if (req.method === 'GET') return await getAsset(admin, tenantId, id, req);
    if (req.method === 'PATCH') return await updateAsset(admin, tenantId, user.id, id, req);
    if (req.method === 'DELETE') return await deleteAsset(admin, tenantId, user.id, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-assets handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listAssets(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;
  const type = params.get('type');
  const search = params.get('search')?.trim();
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  let query = admin
    .from('blog_assets')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type && (ASSET_TYPES as readonly string[]).includes(type)) {
    query = query.eq('asset_type', type);
  }
  if (search) {
    // ILIKE across title + description + attribution (single OR clause)
    const pattern = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(
      `title.ilike.${pattern},description.ilike.${pattern},attribution.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await query;
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  // Enrich image rows with a public URL for client display
  const enriched = (data ?? []).map((row) => {
    if (row.asset_type === 'image' && row.storage_path) {
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(row.storage_path);
      return { ...row, public_url: pub.publicUrl };
    }
    return row;
  });

  return createCorsResponse(
    {
      assets: enriched,
      pagination: { total: count ?? 0, limit, offset, has_more: (count ?? 0) > offset + limit },
    },
    200,
    req,
  );
}

async function getAsset(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Asset not found' }, 404, req);
  let publicUrl: string | null = null;
  if (data.asset_type === 'image' && data.storage_path) {
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(data.storage_path);
    publicUrl = pub.publicUrl;
  }
  return createCorsResponse({ asset: { ...data, public_url: publicUrl } }, 200, req);
}

async function createAsset(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = assetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const input = parsed.data;

  // For tenant-scoped storage paths, refuse anything that doesn't sit under
  // the calling tenant's prefix — prevents cross-tenant references.
  if (input.storage_path && !input.storage_path.startsWith(`${tenantId}/`)) {
    return createCorsResponse(
      { error: 'storage_path must start with the calling tenant_id prefix' },
      400,
      req,
    );
  }

  const { data: created, error } = await admin
    .from('blog_assets')
    .insert({
      tenant_id: tenantId,
      asset_type: input.asset_type,
      title: input.title ?? null,
      description: input.description ?? null,
      storage_path: input.storage_path ?? null,
      mime_type: input.mime_type ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      alt_text: input.alt_text ?? null,
      attribution: input.attribution ?? null,
      expert_metadata: input.expert_metadata ?? null,
      created_by_user_id: userId,
    })
    .select('*')
    .single();

  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create asset' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_asset.create',
      targetType: 'blog_asset',
      targetId: created.id,
      afterState: created,
      summary: `Created ${input.asset_type} asset${input.title ? ` "${input.title}"` : ''}`,
    }),
  );

  let publicUrl: string | null = null;
  if (created.asset_type === 'image' && created.storage_path) {
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(created.storage_path);
    publicUrl = pub.publicUrl;
  }

  return createCorsResponse({ asset: { ...created, public_url: publicUrl } }, 201, req);
}

async function updateAsset(
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

  const parsed = assetPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Confirm asset exists and belongs to tenant + capture for audit
  const { data: before, error: beforeErr } = await admin
    .from('blog_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (beforeErr) return createCorsResponse({ error: beforeErr.message }, 500, req);
  if (!before) return createCorsResponse({ error: 'Asset not found' }, 404, req);

  // Build patch object — only include provided keys
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) patch[k] = v;
  }

  const { data: updated, error } = await admin
    .from('blog_assets')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Failed to update asset' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_asset.update',
      targetType: 'blog_asset',
      targetId: updated.id,
      beforeState: before,
      afterState: updated,
      summary: `Updated ${updated.asset_type} asset`,
    }),
  );

  return createCorsResponse({ asset: updated }, 200, req);
}

async function deleteAsset(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: before, error: beforeErr } = await admin
    .from('blog_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (beforeErr) return createCorsResponse({ error: beforeErr.message }, 500, req);
  if (!before) return createCorsResponse({ error: 'Asset not found' }, 404, req);

  const { error } = await admin
    .from('blog_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id);

  if (error) return createCorsResponse({ error: error.message }, 500, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_asset.delete',
      targetType: 'blog_asset',
      targetId: id,
      beforeState: before,
      summary: `Soft-deleted ${before.asset_type} asset`,
    }),
  );

  return createCorsResponse({ deleted: true, id }, 200, req);
}

async function issueUploadUrl(admin: Admin, tenantId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = uploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Server-side uuid avoids client-side collision games. Storage path is
  // always tenant-scoped so a leaked URL cannot land in another tenant's
  // prefix.
  const uuid = crypto.randomUUID();
  const safeName = sanitizeFilename(parsed.data.filename);
  const storagePath = `${tenantId}/${uuid}-${safeName}`;

  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath);

  if (error || !data) {
    return createCorsResponse({ error: error?.message ?? 'Failed to issue upload URL' }, 500, req);
  }

  return createCorsResponse(
    {
      signed_url: data.signedUrl,
      token: data.token,
      storage_path: storagePath,
      bucket: BUCKET,
    },
    200,
    req,
  );
}
