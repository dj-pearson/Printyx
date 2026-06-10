// Branding Profiles Edge Function (PROP-002)
//
// CRUD for `company_branding_profiles` — the logo / colors / fonts / contact info
// that proposal templates and rendered proposals draw from. The logo file lives in
// the public Supabase Storage bucket `branding-assets` at `<tenant_id>/<profile_id>/logo-<uuid>.<ext>`.
//
// Tenant isolation: every query filters by tenant_id; every storage path is
// tenant-scoped. Reads require a valid tenant; mutations require branding-manage
// (platform admin / company admin / branding permission).
//
// Routes (function name `branding-profiles`):
//   GET    /branding-profiles            list (auto-seeds a default profile if the tenant has none)
//   GET    /branding-profiles/:id        fetch one
//   POST   /branding-profiles            create (Zod-validated, normalizes camelCase)
//   PUT    /branding-profiles/:id        full update
//   PATCH  /branding-profiles/:id        partial update
//   DELETE /branding-profiles/:id        hard delete
//   POST   /branding-profiles/:id/set-default   make this the tenant default (clears others)
//   POST   /branding-profiles/:id/logo          multipart upload -> storage -> logo_url

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const BUCKET = 'branding-assets';
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const LOGO_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

// camelCase (what BrandManager sends) OR snake_case → real snake_case columns.
// Anything not in this map is dropped, so a caller can never write
// tenant_id / created_by / id from the body.
const FIELD_MAP: Record<string, string> = {
  name: 'name',
  isDefault: 'is_default',
  is_default: 'is_default',
  companyName: 'company_name',
  company_name: 'company_name',
  tagline: 'tagline',
  logoUrl: 'logo_url',
  logo_url: 'logo_url',
  websiteUrl: 'website_url',
  website_url: 'website_url',
  primaryColor: 'primary_color',
  primary_color: 'primary_color',
  secondaryColor: 'secondary_color',
  secondary_color: 'secondary_color',
  accentColor: 'accent_color',
  accent_color: 'accent_color',
  textColor: 'text_color',
  text_color: 'text_color',
  headingFont: 'heading_font',
  heading_font: 'heading_font',
  bodyFont: 'body_font',
  body_font: 'body_font',
  address: 'address',
  phone: 'phone',
  email: 'email',
  socialLinks: 'social_links',
  social_links: 'social_links',
  customCSS: 'custom_css',
  customCss: 'custom_css',
  custom_css: 'custom_css',
  settings: 'settings',
};

function normalizeProfile(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const col = FIELD_MAP[k];
    if (col && !(col in out)) out[col] = v;
  }
  return out;
}

const profileCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  company_name: z.string().trim().min(1, 'company_name is required'),
  is_default: z.boolean().optional(),
  tagline: z.string().max(500).nullish(),
  logo_url: z.string().max(2000).nullish(),
  website_url: z.string().max(2000).nullish(),
  primary_color: z.string().max(32).nullish(),
  secondary_color: z.string().max(32).nullish(),
  accent_color: z.string().max(32).nullish(),
  text_color: z.string().max(32).nullish(),
  heading_font: z.string().max(120).nullish(),
  body_font: z.string().max(120).nullish(),
  address: z.string().max(2000).nullish(),
  phone: z.string().max(64).nullish(),
  email: z.string().max(320).nullish(),
  social_links: z.record(z.unknown()).nullish(),
  custom_css: z.string().max(20_000).nullish(),
  settings: z.record(z.unknown()).nullish(),
});

const profileUpdateSchema = profileCreateSchema.partial();

function hasBrandingManage(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('proposal.branding.edit') ||
      perms.includes('branding.manage') ||
      perms.includes('blog.brand_voice.edit'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return ['platform_admin', 'super_admin', 'company_admin', 'admin', 'owner'].includes(role);
}

function resolveTenantId(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string | null {
  return (
    (user.app_metadata?.tenantId as string) ||
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenantId as string) ||
    (user.user_metadata?.tenant_id as string) ||
    null
  );
}

// Clear is_default on every OTHER profile in this tenant so at most one default.
async function clearOtherDefaults(admin: Admin, tenantId: string, exceptId?: string) {
  let q = admin
    .from('company_branding_profiles')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('is_default', true);
  if (exceptId) q = q.neq('id', exceptId);
  await q;
}

async function ensureBucket(admin: Admin) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;
  // Ignore "already exists" races — concurrent first-uploads can both try.
  await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_LOGO_BYTES,
    allowedMimeTypes: Object.keys(LOGO_EXT_BY_MIME),
  });
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId = resolveTenantId(user) || req.headers.get('x-tenant-id');
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'branding-profiles');
    const id = parts[0];
    const action = parts[1];

    // Reads — any authenticated tenant user.
    if (!id) {
      if (req.method === 'GET') return await listProfiles(admin, tenantId, req);
      if (req.method === 'POST') {
        if (!hasBrandingManage(user)) return forbidden(req);
        return await createProfile(admin, tenantId, user.id, req);
      }
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    if (action === 'logo' && req.method === 'POST') {
      if (!hasBrandingManage(user)) return forbidden(req);
      return await uploadLogo(admin, tenantId, id, req);
    }

    if (action === 'set-default' && req.method === 'POST') {
      if (!hasBrandingManage(user)) return forbidden(req);
      return await setDefault(admin, tenantId, id, req);
    }

    if (req.method === 'GET') return await getProfile(admin, tenantId, id, req);

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!hasBrandingManage(user)) return forbidden(req);
      return await updateProfile(admin, tenantId, id, req);
    }

    if (req.method === 'DELETE') {
      if (!hasBrandingManage(user)) return forbidden(req);
      return await deleteProfile(admin, tenantId, id, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('branding-profiles handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

function forbidden(req: Request) {
  return createCorsResponse({ error: 'Forbidden: branding manage permission required' }, 403, req);
}

async function listProfiles(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('company_branding_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return createCorsResponse({ error: error.message }, 500, req);

  // Seed a sensible default on first GET so the UI always has something to edit.
  if (!data || data.length === 0) {
    const seeded = await seedDefaultProfile(admin, tenantId);
    return createCorsResponse({ profiles: seeded ? [seeded] : [] }, 200, req);
  }

  return createCorsResponse({ profiles: data }, 200, req);
}

async function seedDefaultProfile(admin: Admin, tenantId: string) {
  // Company name from the tenant record when available; harmless fallback otherwise.
  let companyName = 'Your Company';
  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenant?.name) companyName = tenant.name;

  const { data, error } = await admin
    .from('company_branding_profiles')
    .insert({
      tenant_id: tenantId,
      name: 'Default Brand',
      company_name: companyName,
      is_default: true,
      primary_color: '#0066CC',
      secondary_color: '#F8F9FA',
      accent_color: '#28A745',
      text_color: '#212529',
      heading_font: 'Inter',
      body_font: 'Inter',
      social_links: {},
      created_by: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('branding-profiles seed default failed', error.message);
    return null;
  }
  return data;
}

async function getProfile(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('company_branding_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Profile not found' }, 404, req);
  return createCorsResponse({ profile: data }, 200, req);
}

async function createProfile(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = profileCreateSchema.safeParse(normalizeProfile(body as Record<string, unknown>));
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const fields = parsed.data;

  if (fields.is_default) await clearOtherDefaults(admin, tenantId);

  const { data, error } = await admin
    .from('company_branding_profiles')
    .insert({
      ...fields,
      tenant_id: tenantId,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create profile' }, 500, req);
  }
  return createCorsResponse({ profile: data }, 201, req);
}

async function updateProfile(admin: Admin, tenantId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = profileUpdateSchema.safeParse(normalizeProfile(body as Record<string, unknown>));
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const fields = parsed.data;

  if (fields.is_default) await clearOtherDefaults(admin, tenantId, id);

  const { data, error } = await admin
    .from('company_branding_profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Profile not found' }, 404, req);
  return createCorsResponse({ profile: data }, 200, req);
}

async function deleteProfile(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data: before, error: beforeErr } = await admin
    .from('company_branding_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (beforeErr) return createCorsResponse({ error: beforeErr.message }, 500, req);
  if (!before) return createCorsResponse({ error: 'Profile not found' }, 404, req);

  const { error } = await admin
    .from('company_branding_profiles')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);

  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ deleted: true, id }, 200, req);
}

async function setDefault(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data: exists } = await admin
    .from('company_branding_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (!exists) return createCorsResponse({ error: 'Profile not found' }, 404, req);

  await clearOtherDefaults(admin, tenantId, id);

  const { data, error } = await admin
    .from('company_branding_profiles')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ profile: data }, 200, req);
}

async function uploadLogo(admin: Admin, tenantId: string, id: string, req: Request) {
  // Confirm the profile exists in this tenant before accepting an upload.
  const { data: profile, error: pErr } = await admin
    .from('company_branding_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (pErr) return createCorsResponse({ error: pErr.message }, 500, req);
  if (!profile) return createCorsResponse({ error: 'Profile not found' }, 404, req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return createCorsResponse(
      { error: 'Expected multipart/form-data with a "file" field' },
      400,
      req,
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return createCorsResponse({ error: 'Missing "file" field' }, 400, req);
  }

  const ext = LOGO_EXT_BY_MIME[file.type];
  if (!ext) {
    return createCorsResponse(
      { error: 'Unsupported type. Allowed: png, jpg, svg, webp' },
      415,
      req,
    );
  }
  if (file.size > MAX_LOGO_BYTES) {
    return createCorsResponse({ error: 'Logo exceeds 2MB limit' }, 413, req);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${tenantId}/${id}/logo-${crypto.randomUUID()}.${ext}`;

  await ensureBucket(admin);

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) {
    return createCorsResponse({ error: `Upload failed: ${upErr.message}` }, 500, req);
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const logoUrl = pub.publicUrl;

  const { data: updated, error: updErr } = await admin
    .from('company_branding_profiles')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (updErr) return createCorsResponse({ error: updErr.message }, 500, req);

  return createCorsResponse({ logoUrl, storagePath: path, profile: updated }, 200, req);
}
