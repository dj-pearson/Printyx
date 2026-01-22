// ⚠️ DEPRECATED: This endpoint is deprecated as of Jan 13, 2026
// Use /companies, /leads, and /customers endpoints instead
// This function now redirects to the companies-based architecture
// business_records table is being phased out in favor of companies + relationships
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Add deprecation warning header
  const deprecationMessage =
    'This endpoint is deprecated. Use /companies, /leads, or /customers instead. Will be removed in 30 days.';

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Edge functions receive paths without the function name prefix
  // e.g., /business-records/123/activities becomes /123/activities
  const recordId = pathParts[0]; // The UUID
  const subResource = pathParts[1]; // activities, contacts, etc.

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
      // Warn about deprecation
      console.warn('[DEPRECATED] business-records endpoint called. Use /companies instead.');

      // Handle sub-resources
      if (subResource === 'activities' && recordId) {
        // Query activities by either business_record_id OR company_id
        const { data: activities, error } = await admin
          .from('business_record_activities')
          .select('*')
          .or(`business_record_id.eq.${recordId},company_id.eq.${recordId}`)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching activities:', error);
          return createCorsResponse(
            { error: 'Failed to fetch activities' },
            500,
            req,
            deprecationMessage,
          );
        }

        return createCorsResponse(activities || [], 200, req, deprecationMessage);
      }

      if (recordId && !subResource) {
        // Getting a single record by ID
        // Try to find in business_records first (legacy), then check companies
        let { data: record, error } = await admin
          .from('business_records')
          .select('*')
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .single();

        // If not found in business_records, try companies
        if (error || !record) {
          const { data: company } = await admin
            .from('companies')
            .select(
              `
              *,
              company_contacts(*),
              leads(*),
              customers(*)
            `,
            )
            .eq('id', recordId)
            .eq('tenant_id', tenantId)
            .single();

          if (company) {
            return createCorsResponse(
              {
                ...company,
                _migrated: true,
                _message: 'This record has been migrated to companies table',
              },
              200,
              req,
              deprecationMessage,
            );
          }
        }

        if (error) {
          console.error('Error fetching record:', error);
          return createCorsResponse({ error: 'Record not found' }, 404, req, deprecationMessage);
        }

        return createCorsResponse({ ...record, _deprecated: true }, 200, req, deprecationMessage);
      } else {
        // List records - combine from both tables for transition period
        const recordType =
          url.searchParams.get('recordType') || url.searchParams.get('record_type');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');

        // Check if they want leads or customers specifically
        if (recordType === 'lead' || recordType === 'customer') {
          const table = recordType === 'lead' ? 'leads' : 'customers';
          const { data: records, error } = await admin
            .from(table)
            .select(
              `
              *,
              companies!inner(*),
              company_contacts(*)
            `,
            )
            .eq('tenant_id', tenantId);

          if (!error) {
            return createCorsResponse(
              {
                data: records,
                _message: `Use /${table} endpoint instead of /business-records`,
                _migrated: true,
              },
              200,
              req,
              deprecationMessage,
            );
          }
        }

        // Fall back to business_records for backwards compatibility
        // Handle pagination parameters
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = admin
          .from('business_records')
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenantId);

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

        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data: records, error, count } = await query;

        if (error) {
          console.error('Error fetching business records:', error);
          return createCorsResponse(
            { error: 'Failed to fetch records' },
            500,
            req,
            deprecationMessage,
          );
        }

        // Return in the format expected by frontend: { records: [...], pagination: {...} }
        return createCorsResponse(
          {
            records: records || [],
            pagination: {
              total: count || 0,
              limit,
              offset,
              hasMore: offset + (records?.length || 0) < (count || 0),
            },
            _deprecated: true,
          },
          200,
          req,
          deprecationMessage,
        );
      }
    }

    if (req.method === 'POST') {
      console.warn('[DEPRECATED] POST to business-records. Use /companies POST instead.');
      const body = await req.json();

      // Handle POST to /business-records/:id/activities - CORRECT: use separate activities table
      if (subResource === 'activities' && recordId) {
        // Verify the parent record exists (check both business_records and companies for backwards compatibility)
        let { data: parentRecord } = await admin
          .from('business_records')
          .select('id, company_name')
          .eq('id', recordId)
          .eq('tenant_id', tenantId)
          .single();

        // If not found in business_records, check companies table (migration support)
        if (!parentRecord) {
          const { data: companyRecord } = await admin
            .from('companies')
            .select('id, business_name')
            .eq('id', recordId)
            .eq('tenant_id', tenantId)
            .single();

          if (companyRecord) {
            parentRecord = { id: companyRecord.id, company_name: companyRecord.business_name };
          }
        }

        if (!parentRecord) {
          return createCorsResponse({ error: 'Parent record not found' }, 404, req);
        }

        // Create activity in the SEPARATE business_record_activities table (CORRECT ARCHITECTURE)
        // Support both business_records (legacy) and companies (new) architectures
        const activityData = {
          tenant_id: tenantId,
          // If parent is from companies table, use company_id; otherwise use business_record_id
          ...(parentRecord.business_name
            ? { company_id: recordId }
            : { business_record_id: recordId }),
          activity_type: body.activity_type,
          subject: body.activity_subject || `${body.activity_type} activity`,
          description: body.notes || body.description,
          direction: body.direction,
          email_from: body.email_from,
          email_to: body.email_to,
          email_cc: body.email_cc,
          call_duration: body.activity_duration,
          call_outcome: body.activity_outcome,
          scheduled_date: body.activity_date,
          completed_date: body.completed_date,
          due_date: body.due_date,
          outcome: body.outcome,
          next_action: body.next_action,
          follow_up_date: body.follow_up_date,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newActivity, error } = await admin
          .from('business_record_activities')
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

    return createCorsResponse({ error: 'Method not allowed' }, 405, req, deprecationMessage);
  } catch (error) {
    console.error('Business records function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
