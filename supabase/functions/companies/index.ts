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

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID from user metadata
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID in metadata for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();

    // GET /companies - List all companies
    if (req.method === 'GET' && !companyId) {
      const search = url.searchParams.get('search');
      const includeLeads = url.searchParams.get('includeLeads') === 'true';
      const includeCustomers = url.searchParams.get('includeCustomers') === 'true';
      const includeContacts = url.searchParams.get('includeContacts') !== 'false'; // Default true
      const industry = url.searchParams.get('industry');

      let selectQuery = '*';
      if (includeContacts) selectQuery += ', company_contacts(*)';
      if (includeLeads) selectQuery += ', leads(*)';
      if (includeCustomers) selectQuery += ', customers(*)';

      let query = admin
        .from('companies')
        .select(selectQuery)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(
          `business_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,customer_number.ilike.%${search}%`,
        );
      }

      if (industry) {
        query = query.eq('industry', industry);
      }

      const { data: companies, error } = await query;

      if (error) {
        console.error('Error fetching companies:', error);
        return createCorsResponse({ error: 'Failed to fetch companies' }, 500, req);
      }

      return createCorsResponse(companies || [], 200, req);
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
      const { data: contacts, error } = await admin
        .from('company_contacts')
        .select('*')
        .eq('company_id', companyId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false });

      if (error) {
        console.error('Error fetching contacts:', error);
        return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
      }

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
      const { data: activities, error } = await admin
        .from('business_record_activities')
        .select('*')
        .eq('company_id', companyId)
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
