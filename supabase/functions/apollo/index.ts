// Apollo Edge Function
// Handles Apollo.io lead enrichment and search integration
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
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
    const endpoint = pathParts[1];
    const resourceId = pathParts[2];

    // POST /apollo/search - Search for leads
    if (req.method === 'POST' && endpoint === 'search') {
      const body = await req.json();

      // Check for cached results
      const { data: cached } = await admin
        .from('apollo_search_cache')
        .select('*')
        .eq('search_hash', JSON.stringify(body))
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return createCorsResponse(
          {
            contacts: cached.results || [],
            pagination: cached.pagination,
            fromCache: true,
          },
          200,
          req,
        );
      }

      // Return placeholder - actual Apollo API integration would go here
      return createCorsResponse(
        {
          contacts: [],
          pagination: { page: 1, perPage: 25, totalEntries: 0, totalPages: 0 },
          fromCache: false,
          message: 'Apollo API integration required',
        },
        200,
        req,
      );
    }

    // POST /apollo/enrich - Enrich a contact
    if (req.method === 'POST' && endpoint === 'enrich') {
      const body = await req.json();
      const { email, linkedinUrl } = body;

      // Check cache first
      if (email) {
        const { data: cached } = await admin
          .from('apollo_contacts')
          .select('*')
          .eq('email', email)
          .single();

        if (cached) {
          return createCorsResponse({ contact: cached, fromCache: true }, 200, req);
        }
      }

      return createCorsResponse(
        {
          contact: null,
          fromCache: false,
          message: 'Apollo API enrichment required',
        },
        200,
        req,
      );
    }

    // POST /apollo/add-to-crm - Add Apollo contact to CRM
    if (req.method === 'POST' && endpoint === 'add-to-crm') {
      const body = await req.json();
      const { apolloId, contactData } = body;

      // Create business record from Apollo data
      const businessRecordData = {
        tenant_id: tenantId,
        company_name: contactData.organizationName || 'Unknown',
        primary_contact_name: contactData.name,
        primary_contact_email: contactData.email,
        primary_contact_phone: contactData.phoneNumbers?.[0],
        website: contactData.websiteUrl,
        industry: contactData.industry,
        employee_count: contactData.employeeCount,
        source: 'apollo',
        source_id: apolloId,
        status: 'lead',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: record, error } = await admin
        .from('business_records')
        .insert(businessRecordData)
        .select()
        .single();

      if (error) {
        console.error('Error adding Apollo contact to CRM:', error);
        return createCorsResponse({ error: 'Failed to add to CRM' }, 500, req);
      }

      // Update Apollo tenant lead status
      await admin.from('apollo_tenant_leads').upsert({
        tenant_id: tenantId,
        apollo_id: apolloId,
        status: 'added_to_crm',
        added_to_crm: true,
        business_record_id: record.id,
        updated_at: new Date().toISOString(),
      });

      return createCorsResponse({ success: true, businessRecord: record }, 201, req);
    }

    // GET /apollo/usage - Get API usage stats
    if (req.method === 'GET' && endpoint === 'usage') {
      const { data: usage } = await admin
        .from('apollo_api_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      const totalCredits =
        usage?.reduce((sum: number, u: any) => sum + (u.credits_used || 0), 0) || 0;

      return createCorsResponse(
        {
          usage: usage || [],
          totalCreditsUsed: totalCredits,
        },
        200,
        req,
      );
    }

    // GET /apollo/saved-searches - Get saved searches
    if (req.method === 'GET' && endpoint === 'saved-searches') {
      const { data: searches } = await admin
        .from('apollo_saved_searches')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      return createCorsResponse(searches || [], 200, req);
    }

    // POST /apollo/saved-searches - Save a search
    if (req.method === 'POST' && endpoint === 'saved-searches') {
      const body = await req.json();

      const { data: search, error } = await admin
        .from('apollo_saved_searches')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          filters: body.filters,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to save search' }, 500, req);
      }

      return createCorsResponse(search, 201, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in apollo function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
