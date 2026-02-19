// Leads Edge Function
// Handles lead management operations
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

    // Resolve tenant ID: x-tenant-id header → app_metadata → user_metadata → DB lookup
    let tenantId =
      req.headers.get('x-tenant-id') ||
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2.from('users').select('tenant_id').eq('id', user.id).limit(1).maybeSingle();
      if (dbUser?.tenant_id) {
        tenantId = dbUser.tenant_id;
      } else if (user.email) {
        const { data: emailUser } = await admin2.from('users').select('tenant_id').ilike('email', user.email).limit(1).maybeSingle();
        tenantId = emailUser?.tenant_id;
      }
    }

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const rawParts = url.pathname.split('/').filter(Boolean);
    // Normalize: strip function name from path if the relay preserved it
    const pathParts = rawParts[0] === 'leads' ? rawParts.slice(1) : rawParts;
    const leadId = pathParts[0];
    const subResource = pathParts[1];

    // GET /leads - List leads
    if (req.method === 'GET' && !leadId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      const status = url.searchParams.get('status');
      const source = url.searchParams.get('source');
      const assignedTo = url.searchParams.get('assignedTo');

      let query = admin
        .from('business_records')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'lead')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('lead_status', status);
      if (source) query = query.eq('source', source);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);

      const { data: leads, error, count } = await query;

      if (error) {
        console.error('Error fetching leads:', error);
        return createCorsResponse({ error: 'Failed to fetch leads' }, 500, req);
      }

      // Return plain array — iOS JSONDecoder expects [BusinessRecord] directly
      return createCorsResponse(leads || [], 200, req);
    }

    // GET /leads/:id - Get single lead
    if (req.method === 'GET' && leadId && !subResource) {
      const { data: lead, error } = await admin
        .from('business_records')
        .select('*')
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Lead not found' }, 404, req);
      }

      return createCorsResponse(lead, 200, req);
    }

    // POST /leads - Create lead
    if (req.method === 'POST' && !leadId) {
      const body = await req.json();

      const leadData = {
        tenant_id: tenantId,
        company_name: body.companyName || body.company_name,
        primary_contact_name: body.contactName || body.primary_contact_name,
        primary_contact_email: body.email || body.primary_contact_email,
        primary_contact_phone: body.phone || body.primary_contact_phone,
        website: body.website,
        industry: body.industry,
        source: body.source || 'manual',
        status: 'lead',
        lead_status: body.leadStatus || body.lead_status || 'new',
        assigned_to: body.assignedTo || body.assigned_to,
        notes: body.notes,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: lead, error } = await admin
        .from('business_records')
        .insert(leadData)
        .select()
        .single();

      if (error) {
        console.error('Error creating lead:', error);
        return createCorsResponse({ error: 'Failed to create lead' }, 500, req);
      }

      return createCorsResponse(lead, 201, req);
    }

    // PUT /leads/:id - Update lead
    if (req.method === 'PUT' && leadId && !subResource) {
      const body = await req.json();

      const { data: lead, error } = await admin
        .from('business_records')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update lead' }, 500, req);
      }

      return createCorsResponse(lead, 200, req);
    }

    // POST /leads/:id/convert - Convert lead to customer
    if (req.method === 'POST' && leadId && subResource === 'convert') {
      const { data: lead, error } = await admin
        .from('business_records')
        .update({
          status: 'customer',
          lead_status: 'converted',
          converted_at: new Date().toISOString(),
          converted_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to convert lead' }, 500, req);
      }

      return createCorsResponse({ success: true, customer: lead }, 200, req);
    }

    // POST /leads/:id/qualify - Qualify lead
    if (req.method === 'POST' && leadId && subResource === 'qualify') {
      const body = await req.json();

      const { data: lead, error } = await admin
        .from('business_records')
        .update({
          lead_status: 'qualified',
          qualification_score: body.score,
          qualification_notes: body.notes,
          qualified_at: new Date().toISOString(),
          qualified_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to qualify lead' }, 500, req);
      }

      return createCorsResponse(lead, 200, req);
    }

    // DELETE /leads/:id - Delete lead
    if (req.method === 'DELETE' && leadId) {
      const { error } = await admin
        .from('business_records')
        .delete()
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .eq('status', 'lead');

      if (error) {
        return createCorsResponse({ error: 'Failed to delete lead' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Lead deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in leads function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
