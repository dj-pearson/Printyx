// Web Forms admin Edge Function (CRMX-011).
//
// Prod parity for server/routes-web-forms.ts. Tenant-scoped CRUD over
// web_forms plus a read view of web_form_submissions.
//
// WHY THIS EXISTS: the frontend (client/src/hooks/useWebForms.ts, used by
// pages/marketing/WebFormBuilder.tsx) calls /api/web-forms, which Express
// served in dev only — there was no edge function, so every one of these
// endpoints 404'd in PRODUCTION where the frontend hits
// functions.printyx.net directly. Found by npm run check:routes.
//
// URL layout (all under /web-forms):
//   GET    /                  — list forms for the tenant
//   POST   /                  — create a form (slug + publicToken generated)
//   GET    /:id               — one form
//   PUT    /:id               — update a form
//   PATCH  /:id               — update a form
//   DELETE /:id               — delete a form
//   GET    /:id/submissions   — submissions for a form (?limit=, default 100)
//
// The PUBLIC capture endpoint (unauthenticated) is a different function,
// `public-forms`; submissions become leads via web-form-processor.ts.
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';

const VALID_STATUS = new Set(['draft', 'published', 'archived']);
const DEFAULT_SUBMISSION_LIMIT = 100;
const MAX_SUBMISSION_LIMIT = 500;

// Rows carry jsonb columns whose CONTENTS must not be traversed: web_forms
// .fields/.settings are already camelCase, and web_form_submissions.payload/
// .utm hold arbitrary submitted keys — a deep toCamel would silently rewrite
// a respondent's `first_name` answer key to `firstName`. Shallow only.
// deno-lint-ignore no-explicit-any
const camel = (row: any) => (row ? toCamelShallow(row) : row);

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'form'
  );
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
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

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'web-forms');
    const id = parts[0];
    const sub = parts[1];
    const method = req.method;

    // ─── SUBMISSIONS (before the bare /:id branches) ─────────────────
    if (method === 'GET' && id && sub === 'submissions') {
      const raw = url.searchParams.get('limit');
      let limit = DEFAULT_SUBMISSION_LIMIT;
      if (raw !== null) {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_SUBMISSION_LIMIT) {
          return createCorsResponse({ error: 'Invalid limit parameter' }, 400, req);
        }
        limit = parsed;
      }

      const { data, error } = await admin
        .from('web_form_submissions')
        .select('*')
        .eq('form_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return createCorsResponse({ error: error.message }, 500, req);
      return createCorsResponse((data ?? []).map(camel), 200, req);
    }

    // ─── LIST ────────────────────────────────────────────────────────
    if (method === 'GET' && !id) {
      const { data, error } = await admin
        .from('web_forms')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });

      if (error) return createCorsResponse({ error: error.message }, 500, req);
      return createCorsResponse((data ?? []).map(camel), 200, req);
    }

    // ─── CREATE ──────────────────────────────────────────────────────
    if (method === 'POST' && !id) {
      const body = await req.json().catch(() => ({}));
      const err = validateForm(body, true);
      if (err) return createCorsResponse({ error: err }, 400, req);

      const row = {
        tenant_id: tenantId,
        name: body.name,
        slug: `${slugify(body.name)}-${randomHex(3)}`,
        description: body.description ?? null,
        status: body.status ?? 'draft',
        fields: body.fields ?? [],
        settings: body.settings ?? null,
        public_token: randomHex(24),
        is_active: body.isActive ?? true,
        created_by: user.id,
      };

      const { data, error } = await admin.from('web_forms').insert(row).select().single();
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          return createCorsResponse({ error: 'A form with this slug already exists' }, 409, req);
        }
        return createCorsResponse({ error: error.message }, 500, req);
      }
      return createCorsResponse(camel(data), 201, req);
    }

    // ─── READ ONE ────────────────────────────────────────────────────
    if (method === 'GET' && id && !sub) {
      const { data, error } = await admin
        .from('web_forms')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) return createCorsResponse({ error: error.message }, 500, req);
      if (!data) return createCorsResponse({ error: 'Form not found' }, 404, req);
      return createCorsResponse(camel(data), 200, req);
    }

    // ─── UPDATE ──────────────────────────────────────────────────────
    if ((method === 'PUT' || method === 'PATCH') && id && !sub) {
      const body = await req.json().catch(() => ({}));
      const err = validateForm(body, false);
      if (err) return createCorsResponse({ error: err }, 400, req);

      // Only fields the admin UI owns. slug/public_token/tenant_id/
      // submission_count are deliberately NOT patchable from the client.
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) patch.name = body.name;
      if (body.description !== undefined) patch.description = body.description;
      if (body.status !== undefined) patch.status = body.status;
      if (body.fields !== undefined) patch.fields = body.fields;
      if (body.settings !== undefined) patch.settings = body.settings;
      if (body.isActive !== undefined) patch.is_active = body.isActive;

      const { data, error } = await admin
        .from('web_forms')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) return createCorsResponse({ error: error.message }, 500, req);
      if (!data) return createCorsResponse({ error: 'Form not found' }, 404, req);
      return createCorsResponse(camel(data), 200, req);
    }

    // ─── DELETE ──────────────────────────────────────────────────────
    if (method === 'DELETE' && id && !sub) {
      const { data, error } = await admin
        .from('web_forms')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select('id')
        .maybeSingle();

      if (error) return createCorsResponse({ error: error.message }, 500, req);
      if (!data) return createCorsResponse({ error: 'Form not found' }, 404, req);
      return createCorsResponse({ success: true }, 200, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal error' },
      500,
      req,
    );
  }
}

// deno-lint-ignore no-explicit-any
function validateForm(body: any, isCreate: boolean): string | null {
  if (isCreate && (typeof body.name !== 'string' || body.name.trim() === '')) {
    return 'name is required';
  }
  if (
    !isCreate &&
    body.name !== undefined &&
    (typeof body.name !== 'string' || !body.name.trim())
  ) {
    return 'name must be a non-empty string';
  }
  if (body.status !== undefined && !VALID_STATUS.has(body.status)) {
    return 'status must be one of draft, published, archived';
  }
  if (body.fields !== undefined && !Array.isArray(body.fields)) {
    return 'fields must be an array';
  }
  return null;
}
