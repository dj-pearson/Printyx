// Platform CRM Edge Function
// Handles platform-level CRM operations for root admins
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    // Check for root admin access
    const { data: userWithRole } = await admin
      .from('users')
      .select('role_id, roles!inner(level, can_access_all_tenants)')
      .eq('id', user.id)
      .single();

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'platform-crm');
    const endpoint = parts[0];
    const resourceId = parts[1];

    // GET /platform-crm/business-records - List all platform business records
    if (req.method === 'GET' && endpoint === 'business-records') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');

      let query = admin
        .from('platform_business_records')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (search)
        query = query.or(`company_name.ilike.%${search}%,contact_email.ilike.%${search}%`);

      const { data: records, error, count } = await query;

      if (error) {
        console.error('Error fetching platform business records:', error);
        return createCorsResponse({ error: 'Failed to fetch records' }, 500, req);
      }

      return createCorsResponse(
        {
          records: records || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
        200,
        req,
      );
    }

    // GET /platform-crm/leads - List platform leads
    if (req.method === 'GET' && endpoint === 'leads') {
      const { data: leads, error } = await admin
        .from('platform_business_records')
        .select('*')
        .eq('record_type', 'lead')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching platform leads:', error);
        return createCorsResponse({ error: 'Failed to fetch leads' }, 500, req);
      }

      return createCorsResponse(leads || [], 200, req);
    }

    // GET /platform-crm/activities - List platform activities
    if (req.method === 'GET' && endpoint === 'activities') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const businessRecordId = url.searchParams.get('businessRecordId');

      let query = admin
        .from('platform_activities')
        .select('*')
        .order('activity_date', { ascending: false })
        .limit(limit);

      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);

      const { data: activities, error } = await query;

      if (error) {
        console.error('Error fetching platform activities:', error);
        return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
      }

      return createCorsResponse(activities || [], 200, req);
    }

    // GET /platform-crm/stats - Get CRM statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const { count: totalLeads } = await admin
        .from('platform_business_records')
        .select('*', { count: 'exact', head: true })
        .eq('record_type', 'lead');

      const { count: totalCustomers } = await admin
        .from('platform_business_records')
        .select('*', { count: 'exact', head: true })
        .eq('record_type', 'customer');

      const { count: activeDeals } = await admin
        .from('platform_deals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      return createCorsResponse(
        {
          totalLeads: totalLeads || 0,
          totalCustomers: totalCustomers || 0,
          activeDeals: activeDeals || 0,
        },
        200,
        req,
      );
    }

    // POST /platform-crm/business-records - Create platform business record
    if (req.method === 'POST' && endpoint === 'business-records') {
      const body = await req.json();

      const { data: record, error } = await admin
        .from('platform_business_records')
        .insert({
          ...body,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating platform business record:', error);
        return createCorsResponse({ error: 'Failed to create record' }, 500, req);
      }

      return createCorsResponse(record, 201, req);
    }

    // POST /platform-crm/activities - Log platform activity
    if (req.method === 'POST' && endpoint === 'activities') {
      const body = await req.json();

      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert({
          ...body,
          created_by: user.id,
          activity_date: body.activityDate || new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating platform activity:', error);
        return createCorsResponse({ error: 'Failed to create activity' }, 500, req);
      }

      return createCorsResponse(activity, 201, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in platform-crm function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
