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
    // Handle both path formats:
    // - If pathname includes function name: /customers/:id → pathParts[1]
    // - If pathname is just the ID (Supabase strips function name): /:id → pathParts[0]
    const customerId = pathParts[0] === 'customers' ? pathParts[1] : pathParts[0];

    // GET /customers - List all companies from companies table
    if (req.method === 'GET' && !customerId) {
      const search = url.searchParams.get('search');
      const status = url.searchParams.get('status');
      const recordType =
        url.searchParams.get('recordType') || url.searchParams.get('business_record_type');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Query companies table (single source of truth)
      let query = admin
        .from('companies')
        .select('*, company_contacts(*)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('activity', status);
      }

      if (recordType) {
        query = query.eq('business_record_type', recordType);
      }

      if (search) {
        query = query.or(
          `business_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,customer_number.ilike.%${search}%`,
        );
      }

      const { data: companies, error, count } = await query;

      if (error) {
        console.error('[CUSTOMERS] Error fetching customers:', error);
        return createCorsResponse({ error: 'Failed to fetch customers' }, 500, req);
      }

      console.log(
        `[CUSTOMERS] Query returned ${companies?.length || 0} companies for tenant ${tenantId}`,
      );

      // Map to expected frontend format
      const records = (companies || []).map((company: any) => {
        const contactData = company.company_contacts?.[0] || {};
        return {
          ...company,
          companyName: company.business_name,
          primaryContactName: contactData.first_name
            ? `${contactData.first_name} ${contactData.last_name || ''}`.trim()
            : null,
          primaryContactEmail: contactData.email || company.email,
          primaryContactPhone: contactData.phone || company.phone,
          city: company.billing_city,
          state: company.billing_state,
          status: company.activity || 'active',
          recordType: company.business_record_type?.toLowerCase() || 'customer',
        };
      });

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

    // GET /customers/:id - Get single company/customer by ID
    if (req.method === 'GET' && customerId) {
      // Query from companies table (single source of truth)
      const { data: company, error } = await admin
        .from('companies')
        .select(
          `
          *,
          company_contacts(*),
          leads(*),
          customers(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .or(`id.eq.${customerId},customer_number.eq.${customerId}`)
        .limit(1)
        .single();

      if (error || !company) {
        console.error('Error fetching customer:', error);
        return createCorsResponse({ error: 'Customer not found' }, 404, req);
      }

      // Get recent activities (check both company_id and business_record_id for migration support)
      const { data: activities } = await admin
        .from('business_record_activities')
        .select('*')
        .or(`company_id.eq.${company.id},business_record_id.eq.${company.id}`)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Map company fields to expected frontend format
      const contactData = company.company_contacts?.[0] || {};
      const response = {
        ...company,
        // Map to expected field names
        companyName: company.business_name,
        primaryContactName: contactData.first_name
          ? `${contactData.first_name} ${contactData.last_name || ''}`.trim()
          : null,
        primaryContactEmail: contactData.email || company.email,
        primaryContactPhone: contactData.phone || company.phone,
        city: company.billing_city,
        state: company.billing_state,
        status: company.activity || 'active',
        recordType: company.business_record_type?.toLowerCase() || 'customer',
        activities: activities || [],
      };

      return createCorsResponse(response, 200, req);
    }

    // POST /customers - Create new customer in business_records
    if (req.method === 'POST') {
      const body = await req.json();

      // Generate unique identifiers
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 100000000);
      const companyDisplayId = `${randomNum}`;
      const companyNameSlug = (body.companyName || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const urlSlug = `${companyNameSlug}-${companyDisplayId}`;
      const customerNumber = `CUST-${timestamp}-${randomNum}`;

      const customerData = {
        tenant_id: tenantId,
        record_type: 'customer',
        status: body.status || 'active',

        // Company information
        company_name: body.companyName,
        company_display_id: companyDisplayId,
        url_slug: urlSlug,
        customer_number: customerNumber,
        website: body.website,
        industry: body.industry,
        company_size: body.companySize,

        // Primary contact
        primary_contact_name: body.primaryContactName,
        primary_contact_email: body.primaryContactEmail,
        primary_contact_phone: body.primaryContactPhone,
        primary_contact_title: body.primaryContactTitle,

        // Address
        address_line1: body.addressLine1,
        address_line2: body.addressLine2,
        city: body.city,
        state: body.state,
        postal_code: body.postalCode,
        country: body.country || 'US',

        // Customer management
        priority: body.priority || 'medium',
        customer_tier: body.customerTier,
        assigned_sales_rep: body.assignedSalesRep,
        lead_source: body.leadSource || 'website',
        estimated_amount: body.estimatedDealValue ? parseFloat(body.estimatedDealValue) : null,
        probability: body.probability ? parseInt(body.probability) : 100,

        // Notes and metadata
        notes: body.notes,
        tags: body.tags,
        customer_since: new Date().toISOString(),
        created_by: user.id,
        owner_id: body.ownerId || user.id,
        created_at: new Date().toISOString(),
      };

      const { data: customer, error } = await admin
        .from('business_records')
        .insert(customerData)
        .select()
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        return createCorsResponse(
          { error: 'Failed to create customer', details: error.message },
          500,
          req,
        );
      }

      // Log activity
      await admin.from('business_record_activities').insert({
        business_record_id: customer.id,
        tenant_id: tenantId,
        activity_type: 'record_created',
        description: `Customer created: ${body.companyName}`,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(customer, 201, req);
    }

    // PATCH /customers/:id - Update customer record in business_records
    if ((req.method === 'PATCH' || req.method === 'PUT') && customerId) {
      const body = await req.json();

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Map frontend field names to database column names
      if (body.companyName) updateData.company_name = body.companyName;
      if (body.status) updateData.status = body.status;
      if (body.website) updateData.website = body.website;
      if (body.industry) updateData.industry = body.industry;
      if (body.companySize) updateData.company_size = body.companySize;
      if (body.primaryContactName) updateData.primary_contact_name = body.primaryContactName;
      if (body.primaryContactEmail) updateData.primary_contact_email = body.primaryContactEmail;
      if (body.primaryContactPhone) updateData.primary_contact_phone = body.primaryContactPhone;
      if (body.primaryContactTitle) updateData.primary_contact_title = body.primaryContactTitle;
      if (body.addressLine1) updateData.address_line1 = body.addressLine1;
      if (body.addressLine2) updateData.address_line2 = body.addressLine2;
      if (body.city) updateData.city = body.city;
      if (body.state) updateData.state = body.state;
      if (body.postalCode) updateData.postal_code = body.postalCode;
      if (body.country) updateData.country = body.country;
      if (body.priority) updateData.priority = body.priority;
      if (body.customerTier) updateData.customer_tier = body.customerTier;
      if (body.assignedSalesRep) updateData.assigned_sales_rep = body.assignedSalesRep;
      if (body.leadSource) updateData.lead_source = body.leadSource;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.tags !== undefined) updateData.tags = body.tags;

      const { data: customer, error } = await admin
        .from('business_records')
        .update(updateData)
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer')
        .select()
        .single();

      if (error) {
        console.error('Error updating customer:', error);
        return createCorsResponse({ error: 'Failed to update customer' }, 500, req);
      }

      // Log activity
      await admin.from('business_record_activities').insert({
        business_record_id: customer.id,
        tenant_id: tenantId,
        activity_type: 'record_updated',
        description: `Customer updated: ${customer.company_name}`,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(customer, 200, req);
    }

    // DELETE /customers/:id - Delete customer record from business_records
    if (req.method === 'DELETE' && customerId) {
      const { error } = await admin
        .from('business_records')
        .delete()
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer');

      if (error) {
        console.error('Error deleting customer:', error);
        return createCorsResponse({ error: 'Failed to delete customer' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Customer deleted successfully' },
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
