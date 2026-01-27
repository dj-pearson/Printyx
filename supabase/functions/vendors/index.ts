// Vendors Edge Function
// Handles vendor/supplier CRUD operations
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
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const vendorId = pathParts[1]; // /vendors/:id

    // GET /vendors - List all vendors with filters
    if (req.method === 'GET' && !vendorId) {
      const search = url.searchParams.get('search');
      const isActive = url.searchParams.get('isActive') || url.searchParams.get('is_active');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('vendors')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('vendor_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (isActive !== null && isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      if (search) {
        query = query.or(
          `vendor_name.ilike.%${search}%,primary_contact_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
        );
      }

      const { data: vendors, error, count } = await query;

      if (error) {
        console.error('Error fetching vendors:', error);
        return createCorsResponse({ error: 'Failed to fetch vendors' }, 500, req);
      }

      return createCorsResponse({ data: vendors || [], total: count || 0 }, 200, req);
    }

    // GET /vendors/:id - Get single vendor
    if (req.method === 'GET' && vendorId) {
      const { data: vendor, error } = await admin
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching vendor:', error);
        return createCorsResponse({ error: 'Vendor not found' }, 404, req);
      }

      return createCorsResponse(vendor, 200, req);
    }

    // POST /vendors - Create new vendor
    if (req.method === 'POST' && !vendorId) {
      const body = await req.json();

      const vendorData = {
        tenant_id: tenantId,
        // E-Automate Compatibility
        external_vendor_id: body.externalVendorId || body.external_vendor_id || null,
        last_sync_date: body.lastSyncDate || body.last_sync_date || null,
        // Vendor Information
        vendor_name: body.vendorName || body.vendor_name,
        primary_contact_name: body.primaryContactName || body.primary_contact_name || null,
        // Address Information
        address_line_1: body.addressLine1 || body.address_line_1 || null,
        address_line_2: body.addressLine2 || body.address_line_2 || null,
        city: body.city || null,
        state: body.state || null,
        zip_code: body.zipCode || body.zip_code || null,
        // Contact Information
        phone: body.phone || null,
        fax: body.fax || null,
        email: body.email || null,
        website: body.website || null,
        // Financial Information
        payment_terms: body.paymentTerms || body.payment_terms || null,
        tax_id: body.taxId || body.tax_id || null,
        account_number: body.accountNumber || body.account_number || null,
        // Status
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        // Notes
        notes: body.notes || null,
        // Timestamps
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Validate required fields
      if (!vendorData.vendor_name) {
        return createCorsResponse({ error: 'Vendor name is required' }, 400, req);
      }

      const { data: vendor, error } = await admin
        .from('vendors')
        .insert(vendorData)
        .select()
        .single();

      if (error) {
        console.error('Error creating vendor:', error);
        return createCorsResponse({ error: 'Failed to create vendor', details: error }, 500, req);
      }

      return createCorsResponse(vendor, 201, req);
    }

    // PATCH/PUT /vendors/:id - Update vendor
    if ((req.method === 'PATCH' || req.method === 'PUT') && vendorId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map camelCase to snake_case
      const fieldMap: Record<string, string> = {
        externalVendorId: 'external_vendor_id',
        lastSyncDate: 'last_sync_date',
        vendorName: 'vendor_name',
        primaryContactName: 'primary_contact_name',
        addressLine1: 'address_line_1',
        addressLine2: 'address_line_2',
        city: 'city',
        state: 'state',
        zipCode: 'zip_code',
        phone: 'phone',
        fax: 'fax',
        email: 'email',
        website: 'website',
        paymentTerms: 'payment_terms',
        taxId: 'tax_id',
        accountNumber: 'account_number',
        isActive: 'is_active',
        notes: 'notes',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: vendor, error } = await admin
        .from('vendors')
        .update(updateData)
        .eq('id', vendorId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating vendor:', error);
        return createCorsResponse({ error: 'Failed to update vendor' }, 500, req);
      }

      if (!vendor) {
        return createCorsResponse({ error: 'Vendor not found' }, 404, req);
      }

      return createCorsResponse(vendor, 200, req);
    }

    // DELETE /vendors/:id - Delete vendor
    if (req.method === 'DELETE' && vendorId) {
      // Check if vendor exists and belongs to tenant
      const { data: existingVendor, error: checkError } = await admin
        .from('vendors')
        .select('id')
        .eq('id', vendorId)
        .eq('tenant_id', tenantId)
        .single();

      if (checkError || !existingVendor) {
        return createCorsResponse({ error: 'Vendor not found' }, 404, req);
      }

      const { error } = await admin
        .from('vendors')
        .delete()
        .eq('id', vendorId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting vendor:', error);
        return createCorsResponse({ error: 'Failed to delete vendor' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Vendor deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in vendors function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
