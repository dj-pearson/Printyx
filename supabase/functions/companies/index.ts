// Supabase Edge Function for Companies - Single Source of Truth
// Updated Jan 13, 2026 - Companies-based architecture
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Edge functions receive paths without the function name prefix
  // e.g., /companies/123/activities becomes /123/activities
  const companyId = pathParts[0]; // The UUID
  const subResource = pathParts[1]; // contacts, leads, customers, activities, etc.

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Check if using service role key (for admin operations like dedup)
    // Method 1: Direct comparison with env var
    // Method 2: Decode JWT and check for "service_role" role claim
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let isServiceRoleAuth = jwt && serviceRoleKey && jwt.trim() === serviceRoleKey.trim();

    // Also check by decoding the JWT payload for role: "service_role"
    if (!isServiceRoleAuth && jwt) {
      try {
        const payloadBase64 = jwt.split('.')[1];
        if (payloadBase64) {
          const payload = JSON.parse(atob(payloadBase64));
          if (payload.role === 'service_role') {
            isServiceRoleAuth = true;
            console.log('[COMPANIES] Detected service_role from JWT payload');
          }
        }
      } catch (e) {
        // Not a valid JWT, ignore
      }
    }

    let tenantId: string | null = null;
    let user: any = null;

    if (isServiceRoleAuth) {
      // Service role key auth - get tenant ID from query param or header
      tenantId =
        url.searchParams.get('tenant_id') ||
        url.searchParams.get('tenantId') ||
        req.headers.get('x-tenant-id');

      if (!tenantId) {
        return createCorsResponse(
          {
            error: 'tenant_id query parameter or x-tenant-id header required for service role auth',
          },
          400,
          req,
        );
      }
      console.log(`[COMPANIES] Service role auth for tenant: ${tenantId}`);
    } else {
      // Normal user JWT auth
      const supabase = createSupabaseClient(req);
      const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

      if (userError || !userData.user) {
        console.error('Auth error:', userError);
        return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
      }

      user = userData.user;

      // Extract tenant ID from user metadata
      tenantId =
        (user.app_metadata?.tenantId as string) ||
        (user.app_metadata?.tenant_id as string) ||
        (user.user_metadata?.tenantId as string) ||
        (user.user_metadata?.tenant_id as string);

      if (!tenantId) {
        console.error('No tenant ID in metadata for user:', user.id);
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }
    }

    const admin = createSupabaseServiceClient();

    // GET /companies - List all companies with pagination
    if (req.method === 'GET' && !companyId) {
      const search = url.searchParams.get('search');
      const includeLeads = url.searchParams.get('includeLeads') === 'true';
      const includeCustomers = url.searchParams.get('includeCustomers') === 'true';
      const includeContacts = url.searchParams.get('includeContacts') !== 'false'; // Default true
      const industry = url.searchParams.get('industry');
      const status = url.searchParams.get('status');
      const recordType =
        url.searchParams.get('recordType') || url.searchParams.get('business_record_type');

      // Pagination parameters
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let selectQuery = '*';
      if (includeContacts) selectQuery += ', company_contacts(*)';
      if (includeLeads) selectQuery += ', leads(*)';
      if (includeCustomers) selectQuery += ', customers(*)';

      let query = admin
        .from('companies')
        .select(selectQuery, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (search) {
        // Search across multiple fields for comprehensive results
        query = query.or(
          `business_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,customer_number.ilike.%${search}%,industry.ilike.%${search}%,billing_city.ilike.%${search}%,billing_state.ilike.%${search}%`,
        );
      }

      if (industry) {
        query = query.eq('industry', industry);
      }

      if (status) {
        query = query.eq('activity', status);
      }

      if (recordType) {
        query = query.eq('business_record_type', recordType);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: companies, error, count } = await query;

      if (error) {
        console.error('Error fetching companies:', error);
        return createCorsResponse({ error: 'Failed to fetch companies' }, 500, req);
      }

      console.log(
        `[COMPANIES] Query returned ${companies?.length || 0} companies for tenant ${tenantId}`,
      );

      // Map companies to a format compatible with the customers page
      const records = (companies || []).map((company: any) => ({
        ...company,
        // Map company fields to expected frontend format
        companyName: company.business_name,
        primaryContactName: company.company_contacts?.[0]?.first_name
          ? `${company.company_contacts[0].first_name} ${company.company_contacts[0].last_name || ''}`.trim()
          : null,
        primaryContactEmail: company.company_contacts?.[0]?.email || company.email,
        primaryContactPhone: company.company_contacts?.[0]?.phone || company.phone,
        city: company.billing_city,
        state: company.billing_state,
        status: company.activity || 'active',
        recordType: company.business_record_type?.toLowerCase() || 'customer',
        lead_status: company.activity,
      }));

      return createCorsResponse(
        {
          records,
          pagination: {
            total: count || 0,
            limit,
            offset,
            hasMore: offset + (companies?.length || 0) < (count || 0),
          },
        },
        200,
        req,
      );
    }

    // GET /companies/:id - Get single company with all relationships
    if (req.method === 'GET' && companyId && !subResource) {
      const { data: company, error } = await admin
        .from('companies')
        .select(
          `
          *,
          company_contacts(*),
          leads(*),
          customers(*),
          equipment(*),
          service_tickets(*),
          quotes(*),
          invoices(*)
        `,
        )
        .eq('id', companyId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching company:', error);
        return createCorsResponse({ error: 'Company not found' }, 404, req);
      }

      return createCorsResponse(company, 200, req);
    }

    // GET /companies/:id/contacts - Get company contacts
    if (req.method === 'GET' && companyId && subResource === 'contacts') {
      console.log(
        `[COMPANIES] Fetching contacts for company_id: ${companyId}, tenant: ${tenantId}`,
      );

      const { data: contacts, error } = await admin
        .from('company_contacts')
        .select('*')
        .eq('company_id', companyId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false });

      if (error) {
        console.error('[COMPANIES] Error fetching contacts:', error);
        return createCorsResponse(
          { error: 'Failed to fetch contacts', details: error.message },
          500,
          req,
        );
      }

      console.log(`[COMPANIES] Found ${contacts?.length || 0} contacts for company ${companyId}`);
      return createCorsResponse(contacts || [], 200, req);
    }

    // GET /companies/:id/leads - Get company leads
    if (req.method === 'GET' && companyId && subResource === 'leads') {
      const { data: leads, error } = await admin
        .from('leads')
        .select('*, company_contacts(*)')
        .eq('company_id', companyId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
        return createCorsResponse({ error: 'Failed to fetch leads' }, 500, req);
      }

      return createCorsResponse(leads || [], 200, req);
    }

    // GET /companies/:id/customers - Get company customer records
    if (req.method === 'GET' && companyId && subResource === 'customers') {
      const { data: customers, error } = await admin
        .from('customers')
        .select('*, company_contacts(*)')
        .eq('company_id', companyId)
        .eq('tenant_id', tenantId)
        .order('customer_since', { ascending: false });

      if (error) {
        console.error('Error fetching customers:', error);
        return createCorsResponse({ error: 'Failed to fetch customers' }, 500, req);
      }

      return createCorsResponse(customers || [], 200, req);
    }

    // POST /companies - Create new company (with optional contacts and lead)
    if (req.method === 'POST' && !companyId) {
      const body = await req.json();

      // Check for duplicate company (by name + city + state)
      if (body.business_name) {
        const normalizedName = body.business_name.toLowerCase().trim();
        const normalizedCity = (body.billing_city || '').toLowerCase().trim();
        const normalizedState = (body.billing_state || '').toLowerCase().trim();

        // Search for companies with matching name
        const { data: existingCompanies } = await admin
          .from('companies')
          .select('id, business_name, billing_city, billing_state')
          .eq('tenant_id', tenantId)
          .ilike('business_name', body.business_name)
          .limit(10);

        if (existingCompanies && existingCompanies.length > 0) {
          // Check for exact match on name + city + state
          const duplicate = existingCompanies.find((c: any) => {
            const candidateName = (c.business_name || '').toLowerCase().trim();
            const candidateCity = (c.billing_city || '').toLowerCase().trim();
            const candidateState = (c.billing_state || '').toLowerCase().trim();

            return (
              candidateName === normalizedName &&
              candidateCity === normalizedCity &&
              candidateState === normalizedState
            );
          });

          if (duplicate) {
            console.log(
              `[COMPANIES] Duplicate detected: ${body.business_name} (${body.billing_city}, ${body.billing_state})`,
            );
            return createCorsResponse(
              {
                error: 'Company already exists',
                existingId: duplicate.id,
                existingName: duplicate.business_name,
                existingCity: duplicate.billing_city,
                existingState: duplicate.billing_state,
                suggestion: 'Add contacts to the existing company instead of creating a new one',
              },
              409,
              req,
            );
          }
        }
      }

      // 1. Create company
      const companyData = {
        tenant_id: tenantId,
        business_name: body.business_name,
        customer_number: body.customer_number,
        phone: body.phone,
        email: body.email,
        fax: body.fax,
        website: body.website,
        billing_address: body.billing_address,
        billing_city: body.billing_city,
        billing_state: body.billing_state,
        billing_zip: body.billing_zip,
        shipping_address: body.shipping_address,
        shipping_city: body.shipping_city,
        shipping_state: body.shipping_state,
        shipping_zip: body.shipping_zip,
        industry: body.industry,
        activity: body.activity,
        description: body.description,
        business_record_type: body.business_record_type || 'Customer',
        customer_since: body.customer_since,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: company, error: companyError } = await admin
        .from('companies')
        .insert(companyData)
        .select()
        .single();

      if (companyError) {
        console.error('Error creating company:', companyError);
        return createCorsResponse(
          { error: 'Failed to create company', details: companyError },
          500,
          req,
        );
      }

      // 2. Create contacts (if provided)
      if (body.contacts && Array.isArray(body.contacts) && body.contacts.length > 0) {
        const contactsData = body.contacts.map((contact: any, index: number) => ({
          tenant_id: tenantId,
          company_id: company.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          department: contact.department,
          is_primary: contact.is_primary !== undefined ? contact.is_primary : index === 0,
          created_at: new Date().toISOString(),
        }));

        const { data: contacts, error: contactsError } = await admin
          .from('company_contacts')
          .insert(contactsData)
          .select();

        if (contactsError) {
          console.error('Error creating contacts:', contactsError);
          // Rollback: delete company
          await admin.from('companies').delete().eq('id', company.id);
          return createCorsResponse(
            { error: 'Failed to create contacts', details: contactsError },
            500,
            req,
          );
        }

        company.company_contacts = contacts;
      }

      // 3. Optionally create lead
      if (body.create_lead && body.lead) {
        const primaryContact = company.company_contacts?.[0];
        const leadData = {
          tenant_id: tenantId,
          company_id: company.id,
          contact_id: primaryContact?.id,
          status: body.lead.status || 'new',
          lead_status: body.lead.status || 'new',
          source: body.lead.source || 'website',
          lead_source: body.lead.source || 'website',
          estimated_value: body.lead.estimated_value,
          estimated_amount: body.lead.estimated_value,
          probability: body.lead.probability || 50,
          close_date: body.lead.close_date,
          priority: body.lead.priority || 'medium',
          owner_id: body.lead.owner_id || user.id,
          assigned_sales_rep_id: body.lead.assigned_sales_rep_id || user.id,
          notes: body.lead.notes,
          created_by: user.id,
          created_at: new Date().toISOString(),
        };

        const { data: lead, error: leadError } = await admin
          .from('leads')
          .insert(leadData)
          .select()
          .single();

        if (!leadError) {
          company.leads = [lead];
        }
      }

      return createCorsResponse(company, 201, req);
    }

    // POST /companies/:id/activities - Add activity to company
    if (req.method === 'POST' && companyId && subResource === 'activities') {
      const body = await req.json();

      // Verify company exists
      const { data: companyExists } = await admin
        .from('companies')
        .select('id, business_name')
        .eq('id', companyId)
        .eq('tenant_id', tenantId)
        .single();

      if (!companyExists) {
        return createCorsResponse({ error: 'Company not found' }, 404, req);
      }

      // Create activity in business_record_activities table with company_id
      const activityData = {
        tenant_id: tenantId,
        company_id: companyId,
        activity_type: body.activity_type,
        subject: body.activity_subject || body.subject || `${body.activity_type} activity`,
        description: body.notes || body.description,
        direction: body.direction,
        email_from: body.email_from,
        email_to: body.email_to,
        email_cc: body.email_cc,
        call_duration: body.activity_duration || body.call_duration,
        call_outcome: body.activity_outcome || body.call_outcome,
        scheduled_date: body.activity_date || body.scheduled_date,
        completed_date: body.completed_date,
        due_date: body.due_date,
        outcome: body.outcome,
        next_action: body.next_action,
        follow_up_date: body.follow_up_date,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: activity, error } = await admin
        .from('business_record_activities')
        .insert(activityData)
        .select()
        .single();

      if (error) {
        console.error('Error creating activity:', error);
        return createCorsResponse({ error: 'Failed to create activity', details: error }, 500, req);
      }

      return createCorsResponse(activity, 201, req);
    }

    // GET /companies/:id/activities - Get company activities
    if (req.method === 'GET' && companyId && subResource === 'activities') {
      // Query both company_id (new) and business_record_id (legacy) for migration support
      // This allows us to fetch activities created before and after the company_id migration
      const { data: activities, error } = await admin
        .from('business_record_activities')
        .select('*')
        .or(`company_id.eq.${companyId},business_record_id.eq.${companyId}`)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching activities:', error);
        return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
      }

      return createCorsResponse(activities || [], 200, req);
    }

    // POST /companies/:id/contacts - Add contact to existing company
    if (req.method === 'POST' && companyId && subResource === 'contacts') {
      const body = await req.json();

      // Verify company exists
      const { data: companyExists } = await admin
        .from('companies')
        .select('id')
        .eq('id', companyId)
        .eq('tenant_id', tenantId)
        .single();

      if (!companyExists) {
        return createCorsResponse({ error: 'Company not found' }, 404, req);
      }

      const contactData = {
        tenant_id: tenantId,
        company_id: companyId,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        phone: body.phone,
        title: body.title,
        department: body.department,
        is_primary: body.is_primary || false,
        created_at: new Date().toISOString(),
      };

      const { data: contact, error } = await admin
        .from('company_contacts')
        .insert(contactData)
        .select()
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        return createCorsResponse({ error: 'Failed to create contact' }, 500, req);
      }

      return createCorsResponse(contact, 201, req);
    }

    // PATCH /companies/:id - Update company
    if (req.method === 'PATCH' && companyId) {
      const body = await req.json();

      const updateData = {
        ...body,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.tenant_id;
      delete updateData.created_by;
      delete updateData.created_at;

      const { data: company, error } = await admin
        .from('companies')
        .update(updateData)
        .eq('id', companyId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating company:', error);
        return createCorsResponse({ error: 'Failed to update company' }, 500, req);
      }

      return createCorsResponse(company, 200, req);
    }

    // DELETE /companies/:id - Delete company (and all related records)
    if (req.method === 'DELETE' && companyId) {
      // Note: This should cascade delete contacts, leads, customers, etc.
      // Make sure foreign keys are set up with ON DELETE CASCADE
      const { error } = await admin
        .from('companies')
        .delete()
        .eq('id', companyId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting company:', error);
        return createCorsResponse({ error: 'Failed to delete company' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Company deleted' }, 200, req);
    }

    // ============================================
    // DEDUPLICATION ENDPOINTS
    // ============================================

    // GET /companies/duplicates/scan - Scan for duplicate companies
    if (req.method === 'GET' && companyId === 'duplicates' && subResource === 'scan') {
      console.log(`[COMPANIES] Scanning for duplicates in tenant ${tenantId}`);

      // Fetch all companies
      const { data: allCompanies, error: fetchError } = await admin
        .from('companies')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching companies:', fetchError);
        return createCorsResponse({ error: 'Failed to fetch companies' }, 500, req);
      }

      // Helper functions
      const normalizeString = (str: string | null | undefined): string => {
        if (!str) return '';
        return str.toLowerCase().trim().replace(/\s+/g, ' ');
      };

      const createGroupKey = (company: any): string => {
        const name = normalizeString(company.business_name);
        const city = normalizeString(company.billing_city);
        const state = normalizeString(company.billing_state);
        return `${name}|${city}|${state}`;
      };

      const selectSurvivor = (companies: any[]): any => {
        return companies.reduce((oldest, current) => {
          if (!oldest.created_at) return current;
          if (!current.created_at) return oldest;
          return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
        });
      };

      // Group by normalized key
      const groupMap = new Map<string, any[]>();
      for (const company of allCompanies || []) {
        const key = createGroupKey(company);
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(company);
      }

      // Find duplicate groups (count > 1)
      const duplicateGroups: any[] = [];
      for (const [key, companies] of groupMap) {
        if (companies.length > 1) {
          const survivor = selectSurvivor(companies);
          duplicateGroups.push({
            key,
            name: key.split('|')[0],
            location: key.split('|').slice(1).join(', ') || 'No location',
            count: companies.length,
            survivorId: survivor.id,
            duplicateIds: companies.filter((c) => c.id !== survivor.id).map((c) => c.id),
            companies: companies.map((c) => ({
              id: c.id,
              business_name: c.business_name,
              billing_city: c.billing_city,
              billing_state: c.billing_state,
              phone: c.phone,
              created_at: c.created_at,
            })),
          });
        }
      }

      console.log(
        `[COMPANIES] Found ${duplicateGroups.length} duplicate groups out of ${allCompanies?.length || 0} companies`,
      );

      return createCorsResponse(
        {
          totalCompanies: allCompanies?.length || 0,
          duplicateGroups: duplicateGroups.length,
          totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.duplicateIds.length, 0),
          groups: duplicateGroups,
        },
        200,
        req,
      );
    }

    // POST /companies/merge - Merge duplicate companies
    if (req.method === 'POST' && companyId === 'merge') {
      const body = await req.json();
      const { survivorId, duplicateIds } = body;

      if (!survivorId) {
        return createCorsResponse({ error: 'survivorId is required' }, 400, req);
      }

      if (!duplicateIds || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return createCorsResponse({ error: 'duplicateIds array is required' }, 400, req);
      }

      if (duplicateIds.includes(survivorId)) {
        return createCorsResponse({ error: 'survivorId cannot be in duplicateIds' }, 400, req);
      }

      console.log(`[COMPANIES] Merging ${duplicateIds.length} companies into ${survivorId}`);

      try {
        // 1. Move contacts to survivor
        const { data: movedContacts, error: contactError } = await admin
          .from('company_contacts')
          .update({ company_id: survivorId, updated_at: new Date().toISOString() })
          .in('company_id', duplicateIds)
          .eq('tenant_id', tenantId)
          .select('id');

        if (contactError) {
          console.error('Error moving contacts:', contactError);
        }

        // 2. Move activities to survivor
        const { data: movedActivities, error: activityError } = await admin
          .from('business_record_activities')
          .update({ company_id: survivorId, updated_at: new Date().toISOString() })
          .in('company_id', duplicateIds)
          .eq('tenant_id', tenantId)
          .select('id');

        if (activityError) {
          console.error('Error moving activities:', activityError);
        }

        // 3. Delete duplicate companies
        const { error: deleteError } = await admin
          .from('companies')
          .delete()
          .in('id', duplicateIds)
          .eq('tenant_id', tenantId);

        if (deleteError) {
          console.error('Error deleting duplicates:', deleteError);
          return createCorsResponse(
            { error: 'Failed to delete duplicates', details: deleteError.message },
            500,
            req,
          );
        }

        console.log(
          `[COMPANIES] Merged successfully: ${movedContacts?.length || 0} contacts, ${movedActivities?.length || 0} activities`,
        );

        return createCorsResponse(
          {
            success: true,
            survivorId,
            mergedCount: duplicateIds.length,
            contactsMoved: movedContacts?.length || 0,
            activitiesMoved: movedActivities?.length || 0,
          },
          200,
          req,
        );
      } catch (err: any) {
        console.error('Merge error:', err);
        return createCorsResponse({ error: err.message }, 500, req);
      }
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Companies function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
