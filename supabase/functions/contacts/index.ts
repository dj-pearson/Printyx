// Contacts Edge Function
// Handles contacts for business records (leads and customers)
// Routes: /api/leads/:id/contacts and /api/companies/:id/contacts
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

    // Determine if this is /leads/:id/contacts or /companies/:id/contacts
    const entityType = pathParts[0]; // 'leads' or 'companies'
    const entityId = pathParts[1];
    const contactId = pathParts[3]; // If accessing specific contact

    // Map entity type to table name
    const tableName = entityType === 'leads' ? 'lead_contacts' : 'customer_contacts';
    const foreignKeyColumn = entityType === 'leads' ? 'lead_id' : 'customer_id';

    if (!entityId) {
      return createCorsResponse({ error: 'Entity ID is required' }, 400, req);
    }

    // GET /leads/:id/contacts or /companies/:id/contacts - List contacts
    if (req.method === 'GET' && !contactId) {
      const { data: contacts, error } = await admin
        .from(tableName)
        .select('*')
        .eq(foreignKeyColumn, entityId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false }) // Primary contacts first
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`Error fetching contacts for ${entityType}:`, error);
        return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
      }

      return createCorsResponse(contacts || [], 200, req);
    }

    // GET /leads/:id/contacts/:contactId - Get single contact
    if (req.method === 'GET' && contactId) {
      const { data: contact, error } = await admin
        .from(tableName)
        .select('*')
        .eq('id', contactId)
        .eq(foreignKeyColumn, entityId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching contact:', error);
        return createCorsResponse({ error: 'Contact not found' }, 404, req);
      }

      return createCorsResponse(contact, 200, req);
    }

    // POST /leads/:id/contacts or /companies/:id/contacts - Create contact
    if (req.method === 'POST') {
      const body = await req.json();

      const contactData = {
        tenant_id: tenantId,
        [foreignKeyColumn]: entityId,
        first_name: body.firstName || body.first_name,
        last_name: body.lastName || body.last_name,
        title: body.title || null,
        department: body.department || null,
        phone: body.phone || null,
        email: body.email || null,
        is_primary: body.isPrimary || body.is_primary || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // If this contact is being marked as primary, unmark others
      if (contactData.is_primary) {
        await admin
          .from(tableName)
          .update({ is_primary: false })
          .eq(foreignKeyColumn, entityId)
          .eq('tenant_id', tenantId);
      }

      const { data: contact, error } = await admin
        .from(tableName)
        .insert(contactData)
        .select()
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        return createCorsResponse({ error: 'Failed to create contact', details: error }, 500, req);
      }

      return createCorsResponse(contact, 201, req);
    }

    // PATCH /leads/:id/contacts/:contactId - Update contact
    if ((req.method === 'PATCH' || req.method === 'PUT') && contactId) {
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
      if (body.email !== undefined) updateData.email = body.email;
      if (body.isPrimary !== undefined || body.is_primary !== undefined) {
        updateData.is_primary = body.isPrimary || body.is_primary;
      }

      // If this contact is being marked as primary, unmark others
      if (updateData.is_primary) {
        await admin
          .from(tableName)
          .update({ is_primary: false })
          .eq(foreignKeyColumn, entityId)
          .eq('tenant_id', tenantId)
          .neq('id', contactId);
      }

      const { data: contact, error } = await admin
        .from(tableName)
        .update(updateData)
        .eq('id', contactId)
        .eq(foreignKeyColumn, entityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating contact:', error);
        return createCorsResponse({ error: 'Failed to update contact' }, 500, req);
      }

      return createCorsResponse(contact, 200, req);
    }

    // DELETE /leads/:id/contacts/:contactId - Delete contact
    if (req.method === 'DELETE' && contactId) {
      const { error } = await admin
        .from(tableName)
        .delete()
        .eq('id', contactId)
        .eq(foreignKeyColumn, entityId)
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
    console.error('Unexpected error in contacts function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
