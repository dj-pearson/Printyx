// Leads Edge Function
// Handles lead management operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import geocodeLeadsHandler from '../geocode-leads/index.ts';
import { toCamel } from '../_shared/case.ts';
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

    // ORDERING IS LOAD-BEARING: this must stay ABOVE the GET /leads/:id branch.
    // It used to sit ~150 lines below it, and that branch matches on
    // `leadId && !subResource`, so a request for /leads/map-data arrived with
    // leadId = 'map-data' and was answered as a lead lookup - LeadMapViewer.tsx
    // got "Lead not found" in production. Express's copy of the same mistake is
    // gated by npm run check:route-shadowing; the edge functions dispatch
    // through an ordered if-chain with the same hazard and no gate yet.
    // GET /leads/map-data
    if (req.method === 'GET' && leadId === 'map-data') {
      const source = url.searchParams.get('source');
      const city = url.searchParams.get('city');
      const brand = url.searchParams.get('brand');
      const filterStatus = url.searchParams.get('status');
      const hasCoords = url.searchParams.get('hasCoords');

      const { data: rows, error } = await admin
        .from('business_records')
        .select(
          'id, company_name, record_type, status, primary_contact_name, primary_contact_title, ' +
            'billing_city, billing_state, billing_zip_code, address_line1, city, state, ' +
            'postal_code, latitude, longitude, lead_source, notes, owner_id, ' +
            'assigned_sales_rep, created_at',
        )
        .eq('tenant_id', tenantId)
        .eq('record_type', 'lead');

      if (error) {
        console.error('Lead map data error:', error);
        return createCorsResponse({ message: 'Failed to load map data' }, 500, req);
      }

      // Filters are applied here rather than in the query because Express does
      // the same, and two of them (brand, city) match against free text in
      // `notes` and a coalesce of two columns.
      let filtered = rows ?? [];
      if (source) filtered = filtered.filter((r: any) => r.lead_source === source);
      if (city) {
        const needle = city.toLowerCase();
        filtered = filtered.filter((r: any) =>
          String(r.billing_city || r.city || '')
            .toLowerCase()
            .includes(needle),
        );
      }
      if (brand) {
        const needle = brand.toLowerCase();
        filtered = filtered.filter((r: any) =>
          String(r.notes || '')
            .toLowerCase()
            .includes(needle),
        );
      }
      if (filterStatus) filtered = filtered.filter((r: any) => r.status === filterStatus);
      if (hasCoords === 'true') {
        filtered = filtered.filter((r: any) => r.latitude && r.longitude);
      }

      // The EDA importer packs brand, equipment and UCC detail into `notes` as
      // "Brand: X | Unit 1: ... | UCC: filed". These patterns are Express's,
      // kept exactly so the map legend counts do not change.
      const leadsWithMeta = filtered.map((row: any) => {
        const notes = String(row.notes || '');

        const brands: string[] = [];
        for (const match of notes.match(/Brand:\s*([^\s|]+)/g) ?? []) {
          const b = match.replace('Brand:', '').trim();
          if (b && !brands.includes(b)) brands.push(b);
        }

        const equipment: string[] = [];
        for (const match of notes.match(/Unit \d+:\s*([^|]+)/g) ?? []) {
          equipment.push(match.trim());
        }

        const uccStatuses: string[] = [];
        for (const match of notes.match(/UCC:\s*(\w+)/g) ?? []) {
          const st = match.replace('UCC:', '').trim();
          if (st && !uccStatuses.includes(st)) uccStatuses.push(st);
        }

        const unitMatch = notes.match(/(\d+) equipment unit/);
        const unitCount = unitMatch ? parseInt(unitMatch[1]) : equipment.length;

        return {
          id: row.id,
          companyName: row.company_name,
          recordType: row.record_type,
          status: row.status,
          primaryContactName: row.primary_contact_name,
          primaryContactTitle: row.primary_contact_title,
          billingCity: row.billing_city,
          billingState: row.billing_state,
          // The column is billing_zip_code; the page reads billingPostalCode.
          billingPostalCode: row.billing_zip_code,
          addressLine1: row.address_line1,
          city: row.city,
          state: row.state,
          postalCode: row.postal_code,
          latitude: row.latitude,
          longitude: row.longitude,
          leadSource: row.lead_source,
          notes: row.notes,
          ownerId: row.owner_id,
          assignedSalesRep: row.assigned_sales_rep,
          createdAt: row.created_at,
          lat: row.latitude ? parseFloat(String(row.latitude)) : null,
          lng: row.longitude ? parseFloat(String(row.longitude)) : null,
          brands,
          equipment,
          uccStatuses,
          unitCount,
        };
      });

      const allBrands: Record<string, number> = {};
      const allCities: Record<string, number> = {};
      const allUccStatuses: Record<string, number> = {};
      let geocodedCount = 0;

      for (const lead of leadsWithMeta) {
        if (lead.lat && lead.lng) geocodedCount++;
        const c = lead.billingCity || lead.city || 'Unknown';
        allCities[c] = (allCities[c] || 0) + 1;
        for (const b of lead.brands) allBrands[b] = (allBrands[b] || 0) + 1;
        for (const st of lead.uccStatuses) allUccStatuses[st] = (allUccStatuses[st] || 0) + 1;
      }

      return createCorsResponse(
        {
          leads: leadsWithMeta,
          stats: {
            total: leadsWithMeta.length,
            geocoded: geocodedCount,
            pending: leadsWithMeta.length - geocodedCount,
            geocodedPct: leadsWithMeta.length
              ? Math.round((geocodedCount / leadsWithMeta.length) * 100)
              : 0,
            brands: allBrands,
            cities: allCities,
            uccStatuses: allUccStatuses,
          },
        },
        200,
        req,
      );
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

    // ─── Lead map + geocoding (EDGE-002f) ───────────────────────────────────
    //
    // LeadMapViewer.tsx calls GET /leads/map-data and POST /leads/geocode, and
    // LeadDetail.tsx calls POST /leads/:id/contacts. None existed here, so all
    // three were hard 404s in production. Ported from server/routes-lead-map.ts.

    // GET/POST /leads/:id/contacts
    //
    // LeadDetail.tsx posts { firstName, lastName, email, isPrimary, ... } to
    // attach a contact. lead_contacts is its own table - note is_primary here,
    // NOT the is_primary_contact that company_contacts uses; the two lead/
    // customer contact tables and the company one do not share a spelling.
    if (leadId && subResource === 'contacts' && (req.method === 'GET' || req.method === 'POST')) {
      if (req.method === 'GET') {
        const { data: contacts, error } = await admin
          .from('lead_contacts')
          .select('*')
          .eq('lead_id', leadId)
          .eq('tenant_id', tenantId)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching lead contacts:', error);
          return createCorsResponse({ message: 'Failed to fetch contacts' }, 500, req);
        }

        return createCorsResponse(toCamel(contacts ?? []), 200, req);
      }

      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const firstName = (body.firstName ?? body.first_name) as string | undefined;
      const lastName = (body.lastName ?? body.last_name) as string | undefined;

      // Both are NOT NULL on lead_contacts, so a missing one is a 400 rather
      // than a 500 out of PostgREST.
      if (!firstName || !lastName) {
        return createCorsResponse(
          {
            message: 'firstName and lastName are required',
            code: 'CONTACT_NAME_REQUIRED',
          },
          400,
          req,
        );
      }

      const isPrimary = Boolean(body.isPrimary ?? body.is_primary ?? false);

      // One primary per lead: clear the others first, the way the company
      // contacts handler does.
      if (isPrimary) {
        await admin
          .from('lead_contacts')
          .update({ is_primary: false })
          .eq('lead_id', leadId)
          .eq('tenant_id', tenantId);
      }

      const { data: contact, error } = await admin
        .from('lead_contacts')
        .insert({
          tenant_id: tenantId,
          lead_id: leadId,
          first_name: firstName,
          last_name: lastName,
          title: (body.title ?? null) as string | null,
          department: (body.department ?? null) as string | null,
          phone: (body.phone ?? null) as string | null,
          email: (body.email ?? null) as string | null,
          is_primary: isPrimary,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating lead contact:', error);
        return createCorsResponse(
          { message: 'Failed to create contact', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(toCamel(contact), 201, req);
    }

    // POST /leads/geocode
    //
    // Express forwards this to the geocode-leads edge function over HTTP. We
    // are already inside the edge runtime, so it delegates to that handler
    // directly - same code, no second network hop, and the Google Places key
    // stays in the one function that owns it. Cross-function import is the
    // accepted idiom here (see proposals -> email-marketing/_sendgrid.ts).
    if (req.method === 'POST' && leadId === 'geocode') {
      return await geocodeLeadsHandler(req);
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
