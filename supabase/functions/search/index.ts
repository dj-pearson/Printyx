// Search Edge Function (CRMX-013)
// Global search across CRM entities, ranked by trigram relevance with typo
// tolerance. Primary path is the public.global_search() RPC (see
// drizzle/functions/global-search.sql). If that function isn't present yet
// (pre-migration), it falls back to an unranked ILIKE scan over the
// Drizzle-verified tables so search never hard-fails.
//
// Response is a FLAT, relevance-ordered array the ⌘K command palette consumes:
//   { query, totalResults, results: SearchResult[] }
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

type EntityType = 'customer' | 'contact' | 'quote' | 'deal' | 'service' | 'product' | 'invoice';

interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  subtitle?: string;
  metadata?: string;
  url: string;
  // `path` mirrors `url` so both consumers work: global-search reads `url`,
  // the navigation command-palette reads `path`.
  path: string;
  rank?: number;
}

// Deep-link path per entity type (record id appended).
const URL_BASE: Record<EntityType, string> = {
  customer: '/leads',
  contact: '/contacts',
  deal: '/deals',
  quote: '/quotes',
  service: '/service-tickets',
  product: '/products',
  invoice: '/invoices',
};

function toResult(row: {
  entity_type: string;
  entity_id: string;
  title: string | null;
  subtitle: string | null;
  metadata: string | null;
  rank: number | null;
}): SearchResult {
  const type = row.entity_type as EntityType;
  const url = `${URL_BASE[type] ?? ''}/${row.entity_id}`;
  return {
    id: row.entity_id,
    type,
    title: row.title || '(untitled)',
    subtitle: row.subtitle || undefined,
    metadata: row.metadata || undefined,
    url,
    path: url,
    rank: row.rank ?? undefined,
  };
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const query = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
    const types = url.searchParams.get('types')?.split(',').filter(Boolean) ?? [];
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    if (!query || query.length < 2) {
      return createCorsResponse({ error: 'Search query must be at least 2 characters' }, 400, req);
    }

    let results: SearchResult[] = [];

    // Primary: ranked RPC.
    const { data: rpcRows, error: rpcError } = await admin.rpc('global_search', {
      p_tenant_id: tenantId,
      p_query: query,
      p_limit: limit,
    });

    if (rpcError) {
      console.warn('global_search RPC unavailable, falling back to ILIKE:', rpcError.message);
      results = await legacyIlikeSearch(admin, tenantId, query, limit);
    } else {
      results = (rpcRows ?? []).map(toResult);
    }

    // Global relevance ordering (RPC returns per-entity-ranked blocks).
    results.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

    // Optional type filter (command palette may scope by entity).
    if (types.length > 0) {
      results = results.filter((r) => types.includes(r.type));
    }

    results = results.slice(0, limit);

    return createCorsResponse({ query, totalResults: results.length, results }, 200, req);
  } catch (error) {
    console.error('Error in search function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

/**
 * Fallback used only when the global_search RPC isn't installed yet. Unranked
 * ILIKE over the Drizzle-verified tables so the palette still returns results.
 */
async function legacyIlikeSearch(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const pattern = `%${query}%`;
  const out: SearchResult[] = [];

  const [records, contacts, deals, proposals] = await Promise.all([
    admin
      .from('business_records')
      .select('id, company_name, primary_contact_name, record_type')
      .eq('tenant_id', tenantId)
      .or(`company_name.ilike.${pattern},primary_contact_email.ilike.${pattern}`)
      .limit(limit),
    admin
      .from('company_contacts')
      .select('id, first_name, last_name, email, title')
      .eq('tenant_id', tenantId)
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit),
    admin
      .from('deals')
      .select('id, title, company_name, status')
      .eq('tenant_id', tenantId)
      .or(`title.ilike.${pattern},company_name.ilike.${pattern}`)
      .limit(limit),
    admin
      .from('proposals')
      .select('id, title, proposal_number, status')
      .eq('tenant_id', tenantId)
      .or(`title.ilike.${pattern},proposal_number.ilike.${pattern}`)
      .limit(limit),
  ]);

  // deno-lint-ignore no-explicit-any
  for (const r of (records.data ?? []) as any[]) {
    out.push(
      toResult({
        entity_type: 'customer',
        entity_id: r.id,
        title: r.company_name,
        subtitle: r.primary_contact_name,
        metadata: r.record_type,
        rank: null,
      }),
    );
  }
  // deno-lint-ignore no-explicit-any
  for (const r of (contacts.data ?? []) as any[]) {
    out.push(
      toResult({
        entity_type: 'contact',
        entity_id: r.id,
        title: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
        subtitle: r.email,
        metadata: r.title,
        rank: null,
      }),
    );
  }
  // deno-lint-ignore no-explicit-any
  for (const r of (deals.data ?? []) as any[]) {
    out.push(
      toResult({
        entity_type: 'deal',
        entity_id: r.id,
        title: r.title,
        subtitle: r.company_name,
        metadata: r.status,
        rank: null,
      }),
    );
  }
  // deno-lint-ignore no-explicit-any
  for (const r of (proposals.data ?? []) as any[]) {
    out.push(
      toResult({
        entity_type: 'quote',
        entity_id: r.id,
        title: r.title,
        subtitle: r.proposal_number,
        metadata: r.status,
        rank: null,
      }),
    );
  }

  return out;
}
