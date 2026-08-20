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

    // Resolve tenant ID from the verified JWT (canonical). The x-tenant-id header
    // is only a fallback and must NEVER override the JWT tenant — otherwise any
    // authenticated user can read/write another tenant by spoofing the header.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    let tenantId = jwtTenantId || headerTenantId;

    if (!tenantId) {
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      if (dbUser?.tenant_id) {
        tenantId = dbUser.tenant_id;
      } else if (user.email) {
        const { data: emailUser } = await admin2
          .from('users')
          .select('tenant_id')
          .ilike('email', user.email)
          .limit(1)
          .maybeSingle();
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

      // COP-M01: assigned_to is not a column — the rep is assigned_sales_rep.
      //
      // The `status` query param is NOT wired to a column here on purpose. This
      // list already pins .eq('status', 'lead') to select leads (CLAUDE.md:
      // "Leads and customers share business_records. Status field determines
      // state."), so a second filter on the same column contradicts it, and
      // there is no separate lead_status column to put it on. Which column
      // carries a lead's sub-state — status, sales_stage or record_type — is the
      // COP-B00 canonical-model question; guessing here would silently change
      // which rows a saved view returns.
      if (source) query = query.eq('source', source);
      if (assignedTo) query = query.eq('assigned_sales_rep', assignedTo);

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
        assigned_sales_rep: body.assignedTo || body.assigned_to,
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
        // converted_at is not a column; the date a record became a customer is
        // customer_since. converted_by IS real and stays.
        .update({
          status: 'customer',
          customer_since: new Date().toISOString(),
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

      // COP-M01: four of the five columns this wrote do not exist. lead_score is
      // real and is where a qualification score belongs; qualification_notes,
      // qualified_at and qualified_by have nowhere to go, and qualified_at is
      // approximated by updated_at. Rather than drop the other two silently —
      // which is what the previous version effectively did, since the whole
      // update failed — they come back as a stated warning.
      const unpersisted: string[] = [];
      if (body.notes) unpersisted.push('notes: business_records has no qualification_notes column');
      unpersisted.push('qualifiedBy: business_records has no qualified_by column');

      const { data: lead, error } = await admin
        .from('business_records')
        .update({
          lead_score: body.score ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error qualifying lead:', error);
        return createCorsResponse(
          { error: 'Failed to qualify lead', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse({ ...lead, unpersisted }, 200, req);
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
