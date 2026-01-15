// Customers Edge Function - Companies Architecture
// Handles customer relationship operations (customers table links to companies)
// Updated Jan 13, 2026 - Now uses companies as single source of truth
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

    // Extract tenant ID from JWT metadata
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const customerId = pathParts[1]; // /customers/:id

    // GET /customers - List all customers with company information
    if (req.method === 'GET' && !customerId) {
      const search = url.searchParams.get('search');
      const status = url.searchParams.get('status');

      let query = admin
        .from('customers')
        .select(
          `
          *,
          companies!inner(
            id,
            business_name,
            customer_number,
            phone,
            email,
            website,
            billing_address,
            billing_city,
            billing_state,
            billing_zip,
            industry
          ),
          company_contacts!inner(
            id,
            first_name,
            last_name,
            email,
            phone,
            title,
            is_primary
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('customer_since', { ascending: false });

      if (status) {
        query = query.eq('lead_status', status);
      }

      if (search) {
        query = query.or(
          `companies.business_name.ilike.%${search}%,companies.customer_number.ilike.%${search}%,company_contacts.email.ilike.%${search}%`,
        );
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error('Error fetching customers:', error);
        return createCorsResponse({ error: 'Failed to fetch customers' }, 500, req);
      }

      return createCorsResponse(customers || [], 200, req);
    }

    // GET /customers/:id - Get single customer with full company info
    if (req.method === 'GET' && customerId) {
      const { data: customer, error } = await admin
        .from('customers')
        .select(
          `
          *,
          companies!inner(*),
          company_contacts(*),
          equipment(*),
          service_tickets(*),
          invoices(*)
        `,
        )
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching customer:', error);
        return createCorsResponse({ error: 'Customer not found' }, 404, req);
      }

      return createCorsResponse(customer, 200, req);
    }

    // POST /customers - Create new customer
    // Supports two formats:
    // 1. With existing company_id and contact_id
    // 2. With inline company and contact data (will create them first)
    if (req.method === 'POST') {
      const body = await req.json();

      let companyId = body.company_id;
      let contactId = body.contact_id;

      // If company_id not provided, try to create company from inline data
      if (!companyId && body.companyName) {
        const companyData = {
          tenant_id: tenantId,
          business_name: body.companyName,
          customer_number: body.customerNumber,
          phone: body.primaryContactPhone || body.phone,
          email: body.primaryContactEmail || body.email,
          website: body.website,
          billing_address: body.addressLine1
            ? `${body.addressLine1}${body.addressLine2 ? ', ' + body.addressLine2 : ''}`
            : undefined,
          billing_city: body.city,
          billing_state: body.state,
          billing_zip: body.postalCode,
          industry: body.industry,
          business_record_type: 'Customer',
          customer_since: body.customer_since || new Date().toISOString(),
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
            { error: 'Failed to create company', details: companyError.message },
            500,
            req,
          );
        }

        companyId = company.id;

        // Create primary contact if provided
        if (body.primaryContactName || body.primaryContactEmail) {
          const [firstName, ...lastNameParts] = (body.primaryContactName || '').split(' ');
          const lastName = lastNameParts.join(' ');

          const contactData = {
            tenant_id: tenantId,
            company_id: companyId,
            first_name: firstName || 'Primary',
            last_name: lastName || 'Contact',
            email: body.primaryContactEmail,
            phone: body.primaryContactPhone,
            title: body.primaryContactTitle,
            is_primary: true,
            created_at: new Date().toISOString(),
          };

          const { data: contact, error: contactError } = await admin
            .from('company_contacts')
            .insert(contactData)
            .select()
            .single();

          if (contactError) {
            console.error('Error creating contact:', contactError);
            // Don't fail the whole request, just log the error
          } else {
            contactId = contact.id;
          }
        }
      } else if (!companyId) {
        return createCorsResponse(
          { error: 'Either company_id or companyName is required' },
          400,
          req,
        );
      } else {
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
      }

      const customerData = {
        tenant_id: tenantId,
        company_id: companyId,
        contact_id: contactId,
        converted_from_lead_id: body.converted_from_lead_id,
        lead_source: body.leadSource || body.lead_source || 'website',
        lead_status: body.lead_status || 'active',
        customer_since: body.customer_since || new Date().toISOString(),
        estimated_amount: body.estimatedDealValue
          ? parseFloat(body.estimatedDealValue)
          : body.estimated_amount,
        probability: body.probability ? parseInt(body.probability) : 100,
        close_date: body.expectedCloseDate || body.close_date,
        owner_id: body.assignedSalesRep || body.owner_id || user.id,
        priority: body.priority || 'medium',
        notes: body.notes,
        preferred_technician: body.preferred_technician,
        current_balance: body.current_balance || 0,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      const { data: customer, error } = await admin
        .from('customers')
        .insert(customerData)
        .select(
          `
          *,
          companies(*),
          company_contacts(*)
        `,
        )
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        return createCorsResponse(
          { error: 'Failed to create customer', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(customer, 201, req);
    }

    // PATCH /customers/:id - Update customer record
    if ((req.method === 'PATCH' || req.method === 'PUT') && customerId) {
      const body = await req.json();

      const updateData = {
        ...body,
        updated_at: new Date().toISOString(),
      };

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.tenant_id;
      delete updateData.created_by;
      delete updateData.created_at;
      delete updateData.company_id; // Don't allow changing company link

      const { data: customer, error } = await admin
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          companies(*),
          company_contacts(*)
        `,
        )
        .single();

      if (error) {
        console.error('Error updating customer:', error);
        return createCorsResponse({ error: 'Failed to update customer' }, 500, req);
      }

      return createCorsResponse(customer, 200, req);
    }

    // DELETE /customers/:id - Delete customer relationship (company remains)
    if (req.method === 'DELETE' && customerId) {
      // Note: This only deletes the customer relationship, not the company
      const { error } = await admin
        .from('customers')
        .delete()
        .eq('id', customerId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting customer:', error);
        return createCorsResponse({ error: 'Failed to delete customer' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Customer relationship deleted (company preserved)' },
        200,
        req,
      );
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in customers function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
