// Contract Tiered Rates Edge Function (PROD-013)
//
// Production counterpart to the contract-tiered-rates endpoints in
// server/routes-products-crud.ts. That domain had no edge function, so the
// tiered-rate list and the create dialog on MeterBilling.tsx 404'd in
// production while working in dev.
//
// Routes (the dispatcher strips the function-name segment first):
//   GET  /   list every tiered rate for the tenant
//   POST /   create one
//
// Table is contract_tiered_rates (migration 0000). MeterBilling types the list
// as ContractTieredRate[] — the Drizzle type, so camelCase — and posts
// camelCase, hence the conversion in both directions.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Row = Record<string, any>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function camelRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

// Writable columns per the migration 0000 DDL.
const RATE_COLUMNS = new Set([
  'contract_id',
  'tier_name',
  'color_type',
  'minimum_volume',
  'maximum_volume',
  'rate',
  'minimum_charge',
  'sort_order',
]);

function toColumns(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body || {})) {
    const column = RATE_COLUMNS.has(k) ? k : toSnake(k);
    if (RATE_COLUMNS.has(column)) out[column] = v;
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
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'contract-tiered-rates');

    // This function serves a flat collection only; anything deeper is not a
    // route it has.
    if (parts.length > 0) {
      return createCorsResponse({ error: 'Not found' }, 404, req);
    }

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('contract_tiered_rates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      if (error) throw new Error(error.message);
      return createCorsResponse(((data as Row[]) || []).map(camelRow), 200, req);
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as Row;
      const values = toColumns(body);

      // contract_id, tier_name, color_type and rate are NOT NULL with no
      // default; minimum_volume and sort_order default to 0 in the DDL but the
      // form always sends them.
      const missing = ['contract_id', 'tier_name', 'color_type', 'rate'].filter(
        (c) => values[c] === undefined || values[c] === null || values[c] === '',
      );
      if (missing.length) {
        return createCorsResponse(
          { message: `Missing required field(s): ${missing.map(toCamel).join(', ')}` },
          400,
          req,
        );
      }

      const { data, error } = await admin
        .from('contract_tiered_rates')
        .insert({ ...values, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      // The Express handler answers 200 here, not 201 — kept identical so the
      // mutation's success path behaves the same on both backends.
      return createCorsResponse(camelRow(data as Row), 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('[CONTRACT-TIERED-RATES] error:', error);
    return createCorsResponse({ message: (error as Error).message || 'Request failed' }, 500, req);
  }
}
