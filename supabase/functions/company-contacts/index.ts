// Company Contacts Edge Function
// Handles contact management for companies (customers)
// Routes:
//   GET /company-contacts?companyId=xxx - List contacts for a company
//   POST /company-contacts - Create new contact
//   PUT /company-contacts/:id - Update contact
//   DELETE /company-contacts/:id - Delete contact

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

    // Extract contact ID from path if present (e.g., /company-contacts/123)
    const contactId = pathParts.length > 1 ? pathParts[1] : null;

    // GET /company-contacts?companyId=xxx - List contacts for a company
    if (req.method === 'GET' && !contactId) {
      const companyId = url.searchParams.get('companyId');

      if (!companyId) {
        return createCorsResponse({ error: 'companyId query parameter is required' }, 400, req);
      }

      const { data: contacts, error } = await admin
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', companyId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false }) // Primary contacts first
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contacts:', error);
        return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
      }

      // Transform snake_case to camelCase for frontend compatibility
      const transformedContacts = (contacts || []).map((contact) => ({
        id: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email || '',
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        title: contact.title || '',
        department: contact.department || '',
        salutation: contact.salutation || '',
        companyId: contact.customer_id,
        companyName: '', // Will be populated by frontend if needed
        isPrimaryContact: contact.is_primary || false,
        leadStatus: 'customer', // Company contacts are always customers
        lastContactDate: contact.last_contact_date,
        nextFollowUpDate: contact.next_follow_up_date,
        ownerId: contact.owner_id || '',
        ownerName: contact.owner_name || '',
        favoriteContentType: contact.favorite_content_type,
        preferredChannels: contact.preferred_channels || [],
        reportsTo: contact.reports_to,
        contactRoles: contact.contact_roles || [],
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
      }));

      return createCorsResponse(transformedContacts, 200, req);
    }

    // POST /company-contacts - Create new contact
    if (req.method === 'POST') {
      const body = await req.json();

      const contactData = {
        tenant_id: tenantId,
        customer_id: body.companyId,
        first_name: body.firstName || body.first_name,
        last_name: body.lastName || body.last_name,
        title: body.title || null,
        department: body.department || null,
        phone: body.phone || null,
        mobile: body.mobile || null,
        email: body.email || null,
        salutation: body.salutation || null,
        is_primary: body.isPrimaryContact || body.is_primary || false,
        last_contact_date: body.lastContactDate || body.last_contact_date || null,
        next_follow_up_date: body.nextFollowUpDate || body.next_follow_up_date || null,
        owner_id: body.ownerId || body.owner_id || null,
        owner_name: body.ownerName || body.owner_name || null,
        favorite_content_type: body.favoriteContentType || body.favorite_content_type || null,
        preferred_channels: body.preferredChannels || body.preferred_channels || [],
        reports_to: body.reportsTo || body.reports_to || null,
        contact_roles: body.contactRoles || body.contact_roles || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // If this contact is being marked as primary, unmark others
      if (contactData.is_primary) {
        await admin
          .from('customer_contacts')
          .update({ is_primary: false })
          .eq('customer_id', body.companyId)
          .eq('tenant_id', tenantId);
      }

      const { data: contact, error } = await admin
        .from('customer_contacts')
        .insert(contactData)
        .select()
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        return createCorsResponse({ error: 'Failed to create contact', details: error }, 500, req);
      }

      return createCorsResponse(contact, 201, req);
    }

    // PUT /company-contacts/:id - Update contact
    if ((req.method === 'PUT' || req.method === 'PATCH') && contactId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.firstName || body.first_name)
        updateData.first_name = body.firstName || body.first_name;
      if (body.lastName || body.last_name) updateData.last_name = body.lastName || body.last_name;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.mobile !== undefined) updateData.mobile = body.mobile;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.salutation !== undefined) updateData.salutation = body.salutation;
      if (body.isPrimaryContact !== undefined || body.is_primary !== undefined) {
        updateData.is_primary = body.isPrimaryContact || body.is_primary;
      }
      if (body.lastContactDate !== undefined) updateData.last_contact_date = body.lastContactDate;
      if (body.nextFollowUpDate !== undefined)
        updateData.next_follow_up_date = body.nextFollowUpDate;
      if (body.ownerId !== undefined) updateData.owner_id = body.ownerId;
      if (body.ownerName !== undefined) updateData.owner_name = body.ownerName;
      if (body.favoriteContentType !== undefined)
        updateData.favorite_content_type = body.favoriteContentType;
      if (body.preferredChannels !== undefined)
        updateData.preferred_channels = body.preferredChannels;
      if (body.reportsTo !== undefined) updateData.reports_to = body.reportsTo;
      if (body.contactRoles !== undefined) updateData.contact_roles = body.contactRoles;

      // If this contact is being marked as primary, unmark others
      if (updateData.is_primary) {
        // First get the contact to find the company ID
        const { data: existingContact } = await admin
          .from('customer_contacts')
          .select('customer_id')
          .eq('id', contactId)
          .eq('tenant_id', tenantId)
          .single();

        if (existingContact) {
          await admin
            .from('customer_contacts')
            .update({ is_primary: false })
            .eq('customer_id', existingContact.customer_id)
            .eq('tenant_id', tenantId)
            .neq('id', contactId);
        }
      }

      const { data: contact, error } = await admin
        .from('customer_contacts')
        .update(updateData)
        .eq('id', contactId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating contact:', error);
        return createCorsResponse({ error: 'Failed to update contact' }, 500, req);
      }

      return createCorsResponse(contact, 200, req);
    }

    // DELETE /company-contacts/:id - Delete contact
    if (req.method === 'DELETE' && contactId) {
      const { error } = await admin
        .from('customer_contacts')
        .delete()
        .eq('id', contactId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting contact:', error);
        return createCorsResponse({ error: 'Failed to delete contact' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Contact deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in company-contacts function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
