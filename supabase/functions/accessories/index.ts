// Accessories Edge Function (PROD-013)
//
// Production counterpart to the accessory/model compatibility endpoints in
// server/routes-products-crud.ts. That domain had no edge function, so the
// compatibility dialog in EnhancedProductAccessories.tsx 404'd in production
// while working in dev.
//
// Routes (the dispatcher strips the function-name segment first):
//   GET    /:accessoryId/compatibility
//   POST   /:accessoryId/compatibility
//   DELETE /:accessoryId/compatibility/:modelId
//
// Table is accessory_model_compatibility (migration 0000). The page reads
// camelCase (`comp.modelId === model.id`), so rows are converted on the way out
// and the request body is mapped to real columns on the way in.
//
// Separate from the product-accessories function, which owns the accessories
// themselves — this one is only the model-compatibility join.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Row = Record<string, any>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function camelRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

// Writable columns per the migration 0000 DDL. id, tenant_id, accessory_id and
// created_at are set by the handler, not by the caller.
const COMPATIBILITY_COLUMNS = new Set([
  'model_id',
  'is_required',
  'is_optional',
  'installation_notes',
]);

function toColumns(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body || {})) {
    const column = COMPATIBILITY_COLUMNS.has(k) ? k : toSnake(k);
    if (COMPATIBILITY_COLUMNS.has(column)) out[column] = v;
  }
  return out;
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
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'accessories');

    const accessoryId = parts[0];
    const subResource = parts[1];
    const modelId = parts[2];

    if (!accessoryId || subResource !== 'compatibility') {
      return createCorsResponse({ error: 'Not found' }, 404, req);
    }

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('accessory_model_compatibility')
        .select('*')
        .eq('accessory_id', accessoryId)
        .eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
      return createCorsResponse(((data as Row[]) || []).map(camelRow), 200, req);
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as Row;
      const values = toColumns(body);

      // model_id is NOT NULL; rejecting here gives a usable message instead of
      // a raw constraint violation.
      if (!values.model_id) {
        return createCorsResponse({ message: 'modelId is required' }, 400, req);
      }

      const { data, error } = await admin
        .from('accessory_model_compatibility')
        .insert({ ...values, accessory_id: accessoryId, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return createCorsResponse(camelRow(data as Row), 201, req);
    }

    if (req.method === 'DELETE') {
      if (!modelId) {
        return createCorsResponse({ message: 'Model ID is required' }, 400, req);
      }
      const { error } = await admin
        .from('accessory_model_compatibility')
        .delete()
        .eq('accessory_id', accessoryId)
        .eq('model_id', modelId)
        .eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
      // 204 matches the Express handler; the page only invalidates its query.
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(req.headers.get('origin')),
      });
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('[ACCESSORIES] error:', error);
    return createCorsResponse({ message: (error as Error).message || 'Request failed' }, 500, req);
  }
}
