// Company IDs Edge Function
// Manages company identifiers (display IDs, URL slugs, codes, tax IDs).
//
// Replaces server/routes-company-ids.ts + extends the previous edge fn with
// the missing endpoints frontend needs:
//   GET  /missing-ids                 — records without a companyDisplayId
//   POST /backfill                    — bulk-backfill display IDs + slugs
//   POST /generate/:recordId          — generate display ID + slug for one record
//   POST /preview-slug                — preview slug from name (no DB write)
//
// Plus the existing endpoints (kept as-is):
//   GET  /                            — list companies (id + identifiers)
//   GET  /lookup                      — lookup by code/taxId/duns/externalId
//   GET  /:id                         — single company identifiers
//   PUT  /:id                         — update company identifiers
//   POST /validate                    — uniqueness check
//   POST /generate                    — generate next company code (prefix-based)
//
// Dispatcher rule: NAMED ROUTES (lookup, missing-ids, backfill, generate,
// preview-slug, validate) MUST be matched BEFORE the generic /:id handler.
// Otherwise pathParts[0] = 'missing-ids' would be treated as an :id.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

const NAMED_ROUTES = new Set([
  'lookup',
  'missing-ids',
  'backfill',
  'generate',
  'preview-slug',
  'validate',
]);

// Generate an 8-digit unique companyDisplayId. Retries up to 10 times to
// avoid collisions; falls back to a timestamp-derived ID if exhausted.
async function generateCompanyDisplayId(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = String(Math.floor(10000000 + Math.random() * 90000000));
    const { data: existing } = await admin
      .from('business_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('company_display_id', candidate)
      .limit(1)
      .maybeSingle();
    if (!existing) return candidate;
  }
  return Date.now().toString().slice(-8).padStart(8, '0');
}

// Slugify a company name and append the display ID for uniqueness.
// Format: "{recordType}-{name-slug}-{displayId}"
function generateUrlSlug(recordType: string, companyName: string, displayId: string): string {
  const slug =
    companyName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s\-]/g, '')
      .replace(/[\s\-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
      .replace(/-+$/, '') || 'company';
  return `${recordType}-${slug}-${displayId}`;
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
    const { parts } = normalizePath(url.pathname, 'company-ids');
    const first = parts[0];
    const second = parts[1];

    // ─── Named routes (must come BEFORE the generic /:id handler) ───────────

    // GET /company-ids/lookup
    if (req.method === 'GET' && first === 'lookup') {
      const code = url.searchParams.get('code');
      const taxId = url.searchParams.get('taxId');
      const duns = url.searchParams.get('duns');
      const externalId = url.searchParams.get('externalId');

      let query = admin.from('companies').select('*').eq('tenant_id', tenantId);
      if (code) query = query.eq('company_code', code);
      if (taxId) query = query.eq('tax_id', taxId);
      if (duns) query = query.eq('duns_number', duns);
      if (externalId) query = query.eq('external_id', externalId);

      const { data, error } = await query;
      if (error) {
        return createCorsResponse({ error: 'Failed to look up company' }, 500, req);
      }
      return createCorsResponse(data || [], 200, req);
    }

    // GET /company-ids/missing-ids
    if (req.method === 'GET' && first === 'missing-ids') {
      const { data, error } = await admin
        .from('business_records')
        .select('id, company_name, record_type, status, created_at')
        .eq('tenant_id', tenantId)
        .is('company_display_id', null)
        .limit(100);

      if (error) {
        console.error('Error fetching records without IDs:', error);
        return createCorsResponse({ error: 'Failed to fetch records without IDs' }, 500, req);
      }

      return createCorsResponse({ records: data || [], count: (data || []).length }, 200, req);
    }

    // POST /company-ids/backfill
    if (req.method === 'POST' && first === 'backfill') {
      let body: { limit?: number } = {};
      try {
        body = await req.json();
      } catch {
        /* empty body OK */
      }
      const limit = Math.min(Math.max(Number(body.limit ?? 50), 1), 500);

      const { data: records } = await admin
        .from('business_records')
        .select('id, company_name, record_type')
        .eq('tenant_id', tenantId)
        .is('company_display_id', null)
        .limit(limit);

      let updated = 0;
      for (const rec of (records || []) as Array<Record<string, unknown>>) {
        const id = rec.id as string;
        const companyName = (rec.company_name as string) || 'Unnamed Company';
        const recordType = (rec.record_type as string) || 'lead';
        const displayId = await generateCompanyDisplayId(admin, tenantId);
        const urlSlug = generateUrlSlug(recordType, companyName, displayId);
        const { error: updateErr } = await admin
          .from('business_records')
          .update({
            company_display_id: displayId,
            url_slug: urlSlug,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('tenant_id', tenantId);
        if (!updateErr) updated++;
      }

      return createCorsResponse(
        {
          success: true,
          message: `Updated ${updated} records with company display IDs and URL slugs`,
          updatedCount: updated,
        },
        200,
        req,
      );
    }

    // POST /company-ids/generate/:recordId   — generate display ID + slug for one record
    if (req.method === 'POST' && first === 'generate' && second) {
      const recordId = second;
      const { data: record, error: fetchErr } = await admin
        .from('business_records')
        .select('id, company_name, record_type')
        .eq('id', recordId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchErr || !record) {
        return createCorsResponse({ error: 'Business record not found' }, 404, req);
      }
      const r = record as Record<string, unknown>;
      const companyName = (r.company_name as string) || 'Unnamed Company';
      const recordType = (r.record_type as string) || 'lead';

      const displayId = await generateCompanyDisplayId(admin, tenantId);
      const urlSlug = generateUrlSlug(recordType, companyName, displayId);

      await admin
        .from('business_records')
        .update({
          company_display_id: displayId,
          url_slug: urlSlug,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        {
          success: true,
          recordId,
          companyDisplayId: displayId,
          urlSlug,
          url: `/customer/${urlSlug}`,
        },
        200,
        req,
      );
    }

    // POST /company-ids/generate   — generate next prefixed company code (no :id)
    if (req.method === 'POST' && first === 'generate' && !second) {
      let body: { prefix?: string } = {};
      try {
        body = await req.json();
      } catch {
        /* empty body OK */
      }
      const prefix = body.prefix || 'CO';

      const { data: companies } = await admin
        .from('companies')
        .select('company_code')
        .eq('tenant_id', tenantId)
        .ilike('company_code', `${prefix}-%`)
        .order('company_code', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (companies && companies.length > 0) {
        const lastCode = (companies[0] as Record<string, string>).company_code;
        const match = lastCode?.match(/-(\d+)$/);
        if (match) nextNumber = parseInt(match[1]) + 1;
      }

      const generatedCode = `${prefix}-${String(nextNumber).padStart(5, '0')}`;
      return createCorsResponse({ generatedCode, prefix, sequence: nextNumber }, 200, req);
    }

    // POST /company-ids/preview-slug
    if (req.method === 'POST' && first === 'preview-slug') {
      const body = await req.json();
      const companyName = body.companyName ?? body.company_name;
      const recordType = body.recordType ?? body.record_type ?? 'customer';
      if (!companyName) {
        return createCorsResponse({ error: 'Company name is required' }, 400, req);
      }
      const sampleDisplayId = String(Math.floor(10000000 + Math.random() * 90000000));
      const urlSlug = generateUrlSlug(recordType, companyName, sampleDisplayId);
      return createCorsResponse(
        {
          companyName,
          sampleDisplayId,
          urlSlug,
          previewUrl: `/customer/${urlSlug}`,
          note: 'This is a preview - actual display ID will be different when created',
        },
        200,
        req,
      );
    }

    // POST /company-ids/validate
    if (req.method === 'POST' && first === 'validate') {
      const body = await req.json();
      const results: Record<string, { isUnique: boolean; existingId?: string }> = {};

      const fields: Array<['companyCode' | 'taxId' | 'externalId', string]> = [
        ['companyCode', 'company_code'],
        ['taxId', 'tax_id'],
        ['externalId', 'external_id'],
      ];

      for (const [camel, snake] of fields) {
        const value = body[camel] || body[snake];
        if (!value) continue;
        const { data: existing } = await admin
          .from('companies')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq(snake, value)
          .neq('id', body.excludeId || '00000000-0000-0000-0000-000000000000')
          .limit(1)
          .maybeSingle();
        results[camel] = { isUnique: !existing, existingId: (existing as any)?.id };
      }

      return createCorsResponse(results, 200, req);
    }

    // ─── Generic CRUD on /:id (only if first segment is NOT a named route) ──

    if (first && NAMED_ROUTES.has(first)) {
      // We already handled named routes above. If we got here, the method was
      // wrong for that named route.
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // GET /company-ids   — list all (no :id)
    if (req.method === 'GET' && !first) {
      const { data, error } = await admin
        .from('companies')
        .select('id, company_code, company_name, tax_id, duns_number, external_id')
        .eq('tenant_id', tenantId)
        .order('company_name', { ascending: true });

      if (error) {
        console.error('Error fetching company IDs:', error);
        return createCorsResponse({ error: 'Failed to fetch company IDs' }, 500, req);
      }
      return createCorsResponse(data || [], 200, req);
    }

    // GET /company-ids/:id
    if (req.method === 'GET' && first) {
      const { data, error } = await admin
        .from('companies')
        .select('id, company_code, company_name, tax_id, duns_number, external_id, metadata')
        .eq('id', first)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !data) {
        return createCorsResponse({ error: 'Company not found' }, 404, req);
      }
      return createCorsResponse(data, 200, req);
    }

    // PUT /company-ids/:id
    if (req.method === 'PUT' && first) {
      const body = await req.json();
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.companyCode || body.company_code) {
        updateData.company_code = body.companyCode || body.company_code;
      }
      if (body.taxId || body.tax_id) {
        updateData.tax_id = body.taxId || body.tax_id;
      }
      if (body.dunsNumber || body.duns_number) {
        updateData.duns_number = body.dunsNumber || body.duns_number;
      }
      if (body.externalId || body.external_id) {
        updateData.external_id = body.externalId || body.external_id;
      }

      const { data, error } = await admin
        .from('companies')
        .update(updateData)
        .eq('id', first)
        .eq('tenant_id', tenantId)
        .select('id, company_code, company_name, tax_id, duns_number, external_id')
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update company identifiers' }, 500, req);
      }
      return createCorsResponse(data, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in company-ids function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
