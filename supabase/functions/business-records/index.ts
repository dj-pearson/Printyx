// Supabase Edge Function for business_records (leads/customers)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const recordId = pathParts[1]; // business-records/:id
  const subResource = pathParts[2]; // activities, contacts, etc.

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
      console.error('No tenant ID in app_metadata or database for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();

    if (req.method === 'GET') {
      // Handle sub-resources
      if (subResource === 'activities' && recordId) {
        // Fetch activities for this business record
        const { data: activities, error } = await admin
          .from('business_records')
          .select('*')
          .eq('record_type', 'activity')
          .eq('related_to', recordId)
          .eq('tenant_id', tenantId)
          .order('activity_date', { ascending: false });

        if (error) {
          console.error('Error fetching activities:', error);
          return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
        }

        return createCorsResponse(activities || [], 200, req);
      }

      if (recordId && recordId !== 'business-records') {
        // Get single business record
        const { data: record, error } = await admin
          .from('business_records')
          .select('*')
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .single();

        if (error) {
          console.error('Error fetching business record:', error);
          return createCorsResponse({ error: 'Business record not found' }, 404, req);
        }

        return createCorsResponse(record, 200, req);
      } else {
        // List business records with filters
        const recordType =
          url.searchParams.get('recordType') || url.searchParams.get('record_type');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');

        let query = admin.from('business_records').select('*').eq('tenant_id', tenantId);

        if (recordType) {
          query = query.eq('record_type', recordType);
        }
        if (status) {
          query = query.eq('status', status);
        }
        if (search) {
          query = query.or(
            `company_name.ilike.%${search}%,primary_contact_name.ilike.%${search}%,primary_contact_email.ilike.%${search}%`,
          );
        }

        query = query.order('created_at', { ascending: false });

        const { data: records, error } = await query;

        if (error) {
          console.error('Error fetching business records:', error);
          return createCorsResponse({ error: 'Failed to fetch business records' }, 500, req);
        }

        return createCorsResponse(records || [], 200, req);
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();

      // Handle POST to /business-records/:id/activities
      if (subResource === 'activities' && recordId) {
        // Verify the parent record exists
        const { data: parentRecord } = await admin
          .from('business_records')
          .select('id, company_name')
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .single();

        if (!parentRecord) {
          return createCorsResponse({ error: 'Parent record not found' }, 404, req);
        }

        // Create activity as a business_records entry with record_type='activity'
        const activityData = {
          tenant_id: tenantId,
          record_type: 'activity',
          related_to: recordId, // Link to parent record
          company_name: parentRecord.company_name, // Use parent's company name to satisfy NOT NULL constraint
          ...body, // Include all activity fields (activity_type, activity_subject, notes, etc.)
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newActivity, error } = await admin
          .from('business_records')
          .insert(activityData)
          .select('*')
          .single();

        if (error) {
          console.error('Error creating activity:', error);
          return createCorsResponse(
            { error: 'Failed to create activity', details: error },
            500,
            req,
          );
        }

        return createCorsResponse(newActivity, 201, req);
      }

      // Handle regular business record creation (lead/customer)
      const recordData = {
        tenant_id: tenantId,
        ...body,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data: newRecord, error } = await admin
        .from('business_records')
        .insert(recordData)
        .select('*')
        .single();

      if (error) {
        console.error('Error creating business record:', error);
        return createCorsResponse({ error: 'Failed to create business record' }, 500, req);
      }

      return createCorsResponse(newRecord, 201, req);
    }

    if (req.method === 'PATCH' && recordId) {
      const body = await req.json();

      const updateData = {
        ...body,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error } = await admin
        .from('business_records')
        .update(updateData)
        .eq('id', recordId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating business record:', error);
        return createCorsResponse({ error: 'Failed to update business record' }, 500, req);
      }

      return createCorsResponse(updated, 200, req);
    }

    if (req.method === 'DELETE' && recordId) {
      const { error } = await admin
        .from('business_records')
        .delete()
        .eq('id', recordId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting business record:', error);
        return createCorsResponse({ error: 'Failed to delete business record' }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Business records function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
