// Company IDs Edge Function
// Handles company identifier management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const companyIdParam = pathParts[1];

    // GET /company-ids - List all company IDs/identifiers
    if (req.method === 'GET' && !companyIdParam) {
      const { data: companies, error } = await admin
        .from('companies')
        .select('id, company_code, company_name, tax_id, duns_number, external_id')
        .eq('tenant_id', tenantId)
        .order('company_name', { ascending: true });

      if (error) {
        console.error('Error fetching company IDs:', error);
        return createCorsResponse({ error: 'Failed to fetch company IDs' }, 500, req);
      }

      return createCorsResponse(companies || [], 200, req);
    }

    // GET /company-ids/lookup - Lookup by various identifiers
    if (req.method === 'GET' && companyIdParam === 'lookup') {
      const code = url.searchParams.get('code');
      const taxId = url.searchParams.get('taxId');
      const duns = url.searchParams.get('duns');
      const externalId = url.searchParams.get('externalId');

      let query = admin.from('companies').select('*').eq('tenant_id', tenantId);

      if (code) query = query.eq('company_code', code);
      if (taxId) query = query.eq('tax_id', taxId);
      if (duns) query = query.eq('duns_number', duns);
      if (externalId) query = query.eq('external_id', externalId);

      const { data: companies } = await query;

      return createCorsResponse(companies || [], 200, req);
    }

    // GET /company-ids/:id - Get company identifiers
    if (req.method === 'GET' && companyIdParam) {
      const { data: company, error } = await admin
        .from('companies')
        .select('id, company_code, company_name, tax_id, duns_number, external_id, metadata')
        .eq('id', companyIdParam)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Company not found' }, 404, req);
      }

      return createCorsResponse(company, 200, req);
    }

    // PUT /company-ids/:id - Update company identifiers
    if (req.method === 'PUT' && companyIdParam) {
      const body = await req.json();

      const updateData: any = { updated_at: new Date().toISOString() };

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

      const { data: company, error } = await admin
        .from('companies')
        .update(updateData)
        .eq('id', companyIdParam)
        .eq('tenant_id', tenantId)
        .select('id, company_code, company_name, tax_id, duns_number, external_id')
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update company identifiers' }, 500, req);
      }

      return createCorsResponse(company, 200, req);
    }

    // POST /company-ids/validate - Validate identifier uniqueness
    if (req.method === 'POST' && companyIdParam === 'validate') {
      const body = await req.json();
      const results: Record<string, { isUnique: boolean; existingId?: string }> = {};

      if (body.companyCode || body.company_code) {
        const code = body.companyCode || body.company_code;
        const { data: existing } = await admin
          .from('companies')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('company_code', code)
          .neq('id', body.excludeId || '')
          .single();
        results.companyCode = { isUnique: !existing, existingId: existing?.id };
      }

      if (body.taxId || body.tax_id) {
        const taxId = body.taxId || body.tax_id;
        const { data: existing } = await admin
          .from('companies')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('tax_id', taxId)
          .neq('id', body.excludeId || '')
          .single();
        results.taxId = { isUnique: !existing, existingId: existing?.id };
      }

      if (body.externalId || body.external_id) {
        const externalId = body.externalId || body.external_id;
        const { data: existing } = await admin
          .from('companies')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('external_id', externalId)
          .neq('id', body.excludeId || '')
          .single();
        results.externalId = { isUnique: !existing, existingId: existing?.id };
      }

      return createCorsResponse(results, 200, req);
    }

    // POST /company-ids/generate - Generate next company code
    if (req.method === 'POST' && companyIdParam === 'generate') {
      const body = await req.json();
      const prefix = body.prefix || 'CO';

      // Find highest existing code with this prefix
      const { data: companies } = await admin
        .from('companies')
        .select('company_code')
        .eq('tenant_id', tenantId)
        .ilike('company_code', `${prefix}-%`)
        .order('company_code', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (companies && companies.length > 0) {
        const lastCode = companies[0].company_code;
        const match = lastCode.match(/-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const generatedCode = `${prefix}-${nextNumber.toString().padStart(5, '0')}`;

      return createCorsResponse(
        {
          generatedCode,
          prefix,
          sequence: nextNumber,
        },
        200,
        req,
      );
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
