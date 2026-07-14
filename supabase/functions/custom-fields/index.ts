// Custom Fields Edge Function (CRMX-003)
//
// Prod parity for server/routes-custom-fields.ts. CRUD over custom_field_definitions.
// Values themselves live on each object's `custom_fields` jsonb column, keyed by `key`.
//
// URL layout (all under /custom-fields):
//   GET    /?objectType=deals[&includeInactive=true]  — list definitions
//   POST   /                                           — create definition
//   PUT    /:id                                        — update definition
//   PATCH  /:id                                        — update definition
//   DELETE /:id[?hard=true]                            — soft delete (is_active=false) or hard
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

const VALID_OBJECT_TYPES = new Set(['deals', 'leads', 'contacts', 'companies']);
const VALID_FIELD_TYPES = new Set([
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multiselect',
  'url',
  'email',
]);
const KEY_RE = /^[a-z][a-z0-9_]*$/;

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
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'custom-fields');
    const id = parts[0]; // ':id' for item routes
    const method = req.method;

    // ─── LIST ───────────────────────────────────────────────────────
    if (method === 'GET' && !id) {
      const objectType = url.searchParams.get('objectType') ?? undefined;
      const includeInactive = url.searchParams.get('includeInactive') === 'true';

      let query = admin
        .from('custom_field_definitions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (objectType) {
        if (!VALID_OBJECT_TYPES.has(objectType)) {
          return createCorsResponse({ error: 'Invalid objectType' }, 400, req);
        }
        query = query.eq('object_type', objectType);
      }
      if (!includeInactive) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) return createCorsResponse({ error: error.message }, 500, req);
      return createCorsResponse({ data: data ?? [], total: (data ?? []).length }, 200, req);
    }

    // ─── CREATE ─────────────────────────────────────────────────────
    if (method === 'POST' && !id) {
      const body = await req.json().catch(() => ({}));
      const err = validateDefinition(body, true);
      if (err) return createCorsResponse({ error: err }, 400, req);

      const row = {
        tenant_id: tenantId,
        object_type: body.objectType,
        key: body.key,
        label: body.label,
        field_type: body.fieldType,
        options: body.options ?? null,
        required: body.required ?? false,
        default_value: body.defaultValue ?? null,
        description: body.description ?? null,
        is_active: body.isActive ?? true,
        sort_order: body.sortOrder ?? 0,
        created_by: user.id,
      };

      const { data, error } = await admin
        .from('custom_field_definitions')
        .insert(row)
        .select()
        .single();

      if (error) {
        if ((error as { code?: string }).code === '23505') {
          return createCorsResponse(
            { error: 'A field with this key already exists for this object type' },
            409,
            req,
          );
        }
        return createCorsResponse({ error: error.message }, 500, req);
      }
      return createCorsResponse(data, 201, req);
    }

    // ─── UPDATE ─────────────────────────────────────────────────────
    if ((method === 'PUT' || method === 'PATCH') && id) {
      const body = await req.json().catch(() => ({}));
      const err = validateDefinition(body, false);
      if (err) return createCorsResponse({ error: err }, 400, req);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.label !== undefined) patch.label = body.label;
      if (body.fieldType !== undefined) patch.field_type = body.fieldType;
      if (body.options !== undefined) patch.options = body.options;
      if (body.required !== undefined) patch.required = body.required;
      if (body.defaultValue !== undefined) patch.default_value = body.defaultValue;
      if (body.description !== undefined) patch.description = body.description;
      if (body.isActive !== undefined) patch.is_active = body.isActive;
      if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;

      const { data, error } = await admin
        .from('custom_field_definitions')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) return createCorsResponse({ error: error.message }, 500, req);
      if (!data) return createCorsResponse({ error: 'Custom field not found' }, 404, req);
      return createCorsResponse(data, 200, req);
    }

    // ─── DELETE (soft by default) ───────────────────────────────────
    if (method === 'DELETE' && id) {
      const hard = url.searchParams.get('hard') === 'true';
      if (hard) {
        const { data, error } = await admin
          .from('custom_field_definitions')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Custom field not found' }, 404, req);
        return createCorsResponse({ success: true, hardDeleted: true }, 200, req);
      }

      const { data, error } = await admin
        .from('custom_field_definitions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();
      if (error) return createCorsResponse({ error: error.message }, 500, req);
      if (!data) return createCorsResponse({ error: 'Custom field not found' }, 404, req);
      return createCorsResponse({ success: true, hardDeleted: false }, 200, req);
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
function validateDefinition(body: any, isCreate: boolean): string | null {
  if (isCreate) {
    if (!body.objectType || !VALID_OBJECT_TYPES.has(body.objectType))
      return 'objectType must be one of deals, leads, contacts, companies';
    if (!body.key || !KEY_RE.test(body.key))
      return 'key must be lower_snake_case and start with a letter';
    if (!body.label) return 'label is required';
    if (!body.fieldType || !VALID_FIELD_TYPES.has(body.fieldType)) return 'invalid fieldType';
  } else {
    if (body.fieldType !== undefined && !VALID_FIELD_TYPES.has(body.fieldType))
      return 'invalid fieldType';
  }
  const ft = body.fieldType;
  if (
    (ft === 'select' || ft === 'multiselect') &&
    (!Array.isArray(body.options) || body.options.length === 0)
  ) {
    return 'select/multiselect fields require at least one option';
  }
  return null;
}
