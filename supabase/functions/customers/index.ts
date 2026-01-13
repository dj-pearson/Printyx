// Customers Edge Function
// Handles customer-specific operations (customers are business_records with record_type='customer')
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

    // GET /customers - List all customers
    if (req.method === 'GET' && !customerId) {
      const search = url.searchParams.get('search');
      const status = url.searchParams.get('status');

      let query = admin
        .from('business_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer') // Only customers
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(
          `company_name.ilike.%${search}%,primary_contact_name.ilike.%${search}%,primary_contact_email.ilike.%${search}%`,
        );
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error('Error fetching customers:', error);
        return createCorsResponse({ error: 'Failed to fetch customers' }, 500, req);
      }

      return createCorsResponse(customers || [], 200, req);
    }

    // GET /customers/:id - Get single customer
    if (req.method === 'GET' && customerId) {
      const { data: customer, error } = await admin
        .from('business_records')
        .select('*')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer')
        .single();

      if (error) {
        console.error('Error fetching customer:', error);
        return createCorsResponse({ error: 'Customer not found' }, 404, req);
      }

      return createCorsResponse(customer, 200, req);
    }

    // POST /customers - Create new customer
    if (req.method === 'POST') {
      const body = await req.json();

      const customerData = {
        ...body,
        tenant_id: tenantId,
        record_type: 'customer', // Force record_type to customer
        status: body.status || 'active',
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      const { data: customer, error } = await admin
        .from('business_records')
        .insert(customerData)
        .select()
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        return createCorsResponse({ error: 'Failed to create customer', details: error }, 500, req);
      }

      return createCorsResponse(customer, 201, req);
    }

    // PATCH /customers/:id - Update customer
    if ((req.method === 'PATCH' || req.method === 'PUT') && customerId) {
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

      return createCorsResponse(customer, 200, req);
    }

    // DELETE /customers/:id - Delete customer
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

      return createCorsResponse({ success: true, message: 'Customer deleted' }, 200, req);
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
