// Enrichment Edge Function
// Alias for data-enrichment endpoints
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
    const resource = pathParts[1];
    const resourceId = pathParts[2];
    const subResource = pathParts[3];

    // GET /enrichment/contacts - List enriched contacts
    if (req.method === 'GET' && resource === 'contacts') {
      const source = url.searchParams.get('source');

      let query = admin
        .from('enriched_contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (source) query = query.eq('source', source);

      const { data: contacts, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch enriched contacts' }, 500, req);
      }

      return createCorsResponse(contacts || [], 200, req);
    }

    // PUT /enrichment/contacts/:id - Update enriched contact
    if (req.method === 'PUT' && resource === 'contacts' && resourceId) {
      const body = await req.json();

      const { data: contact, error } = await admin
        .from('enriched_contacts')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update enriched contact' }, 500, req);
      }

      return createCorsResponse(contact, 200, req);
    }

    // GET /enrichment/companies - List enriched companies
    if (req.method === 'GET' && resource === 'companies' && !resourceId) {
      const { data: companies, error } = await admin
        .from('enriched_companies')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch enriched companies' }, 500, req);
      }

      return createCorsResponse(companies || [], 200, req);
    }

    // GET /enrichment/companies/:id
    if (req.method === 'GET' && resource === 'companies' && resourceId) {
      const { data: company, error } = await admin
        .from('enriched_companies')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Company not found' }, 404, req);
      }

      return createCorsResponse(company, 200, req);
    }

    // POST /enrichment/companies
    if (req.method === 'POST' && resource === 'companies') {
      const body = await req.json();

      const { data: company, error } = await admin
        .from('enriched_companies')
        .insert({
          tenant_id: tenantId,
          ...body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create company' }, 500, req);
      }

      return createCorsResponse(company, 201, req);
    }

    // GET /enrichment/intent - Intent signals
    if (req.method === 'GET' && resource === 'intent') {
      const { data: signals, error } = await admin
        .from('intent_signals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('detected_at', { ascending: false })
        .limit(100);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch intent signals' }, 500, req);
      }

      return createCorsResponse(signals || [], 200, req);
    }

    // GET /enrichment/campaigns
    if (req.method === 'GET' && resource === 'campaigns') {
      const { data: campaigns, error } = await admin
        .from('enrichment_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch campaigns' }, 500, req);
      }

      return createCorsResponse(campaigns || [], 200, req);
    }

    // POST /enrichment/campaigns
    if (req.method === 'POST' && resource === 'campaigns') {
      const body = await req.json();

      const { data: campaign, error } = await admin
        .from('enrichment_campaigns')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          source: body.source,
          criteria: body.criteria || {},
          status: 'pending',
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create campaign' }, 500, req);
      }

      return createCorsResponse(campaign, 201, req);
    }

    // GET /enrichment/analytics
    if (req.method === 'GET' && resource === 'analytics') {
      const { data: contacts } = await admin
        .from('enriched_contacts')
        .select('source, status')
        .eq('tenant_id', tenantId);

      const bySource: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      (contacts || []).forEach((c: any) => {
        bySource[c.source] = (bySource[c.source] || 0) + 1;
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      });

      return createCorsResponse(
        {
          totalContacts: contacts?.length || 0,
          bySource,
          byStatus,
        },
        200,
        req,
      );
    }

    // POST /enrichment/import/zoominfo/contacts
    if (
      req.method === 'POST' &&
      resource === 'import' &&
      resourceId === 'zoominfo' &&
      subResource === 'contacts'
    ) {
      const body = await req.json();
      const contacts = body.contacts || [];
      const imported: any[] = [];

      for (const contact of contacts) {
        const { data } = await admin
          .from('enriched_contacts')
          .insert({
            tenant_id: tenantId,
            source: 'zoominfo',
            external_id: contact.id,
            first_name: contact.firstName,
            last_name: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            title: contact.title,
            company_name: contact.company,
            raw_data: contact,
            status: 'imported',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (data) imported.push(data);
      }

      return createCorsResponse({ imported: imported.length, total: contacts.length }, 200, req);
    }

    // POST /enrichment/import/apollo/contacts
    if (
      req.method === 'POST' &&
      resource === 'import' &&
      resourceId === 'apollo' &&
      subResource === 'contacts'
    ) {
      const body = await req.json();
      const contacts = body.contacts || [];
      const imported: any[] = [];

      for (const contact of contacts) {
        const { data } = await admin
          .from('enriched_contacts')
          .insert({
            tenant_id: tenantId,
            source: 'apollo',
            external_id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone_numbers?.[0],
            title: contact.title,
            company_name: contact.organization?.name,
            raw_data: contact,
            status: 'imported',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (data) imported.push(data);
      }

      return createCorsResponse({ imported: imported.length, total: contacts.length }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in enrichment function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
