// Platform CRM Edge Function
// Handles platform-level CRM operations for root admins
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { cachedRoleLookup } from '../_shared/auth-cache.ts';

type Row = Record<string, any>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// PlatformBusinessRecords.tsx and PlatformBusinessRecordDetail.tsx both read
// camelCase (record.companyName, record.recordType, record.primaryContactName).
// PostgREST returns snake_case, so rows are converted on the way out — without
// this every cell on both pages renders blank against a 200 response.
function camelRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

const camelRows = (rows: Row[] | null | undefined): Row[] => (rows || []).map(camelRow);

// Columns a caller may write on platform_business_records. Anything else is
// dropped rather than handed to PostgREST, which would answer PGRST204.
const BUSINESS_RECORD_COLUMNS = new Set([
  'record_type',
  'status',
  'company_name',
  'primary_contact_name',
  'primary_contact_email',
  'phone',
  'website',
  'industry',
  'employee_count',
  'estimated_revenue',
  'address',
  'city',
  'state',
  'postal_code',
  'country',
  'lead_score',
  'lead_grade',
  'lead_tier',
  'lead_source',
  'assigned_rep',
  'current_mrr',
  'tenant_id',
  'customer_since',
  'churn_risk',
  'last_activity_date',
  'notes',
]);

function toRecordColumns(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body || {})) {
    const column = BUSINESS_RECORD_COLUMNS.has(k) ? k : toSnake(k);
    if (BUSINESS_RECORD_COLUMNS.has(column)) out[column] = v;
  }
  return out;
}

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
    // AUDIT-005: this users->roles gate ran on EVERY request to this fn, a second
    // serialized hop after auth.getUser. Cached by user id for ROLE_CACHE_TTL_MS
    // (default 30s) — a role change takes effect within that window.
    const { data: userWithRole } = await cachedRoleLookup(user.id, () =>
      admin
        .from('users')
        .select('role_id, roles!inner(level, can_access_all_tenants)')
        .eq('id', user.id)
        .single(),
    );

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
      const recordType = url.searchParams.get('recordType');
      const leadTier = url.searchParams.get('leadTier');
      // The page sends camelCase sort keys (createdAt, companyName, leadScore).
      // Only real columns are honoured; anything else falls back to created_at
      // rather than letting PostgREST reject the whole request.
      const sortBy = toSnake(url.searchParams.get('sortBy') || 'createdAt');
      const sortColumn =
        BUSINESS_RECORD_COLUMNS.has(sortBy) || sortBy === 'created_at' ? sortBy : 'created_at';
      const ascending = url.searchParams.get('sortOrder') !== 'desc';

      let query = admin
        .from('platform_business_records')
        .select('*', { count: 'exact' })
        .order(sortColumn, { ascending })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (recordType) query = query.eq('record_type', recordType);
      if (leadTier) query = query.eq('lead_tier', leadTier);
      if (search)
        query = query.or(`company_name.ilike.%${search}%,primary_contact_email.ilike.%${search}%`);

      const { data: records, error, count } = await query;

      if (error) {
        console.error('Error fetching platform business records:', error);
        return createCorsResponse({ error: 'Failed to fetch records' }, 500, req);
      }

      return createCorsResponse(
        {
          records: camelRows(records as Row[]),
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

    // GET /platform-crm/business-records/:id - Single record (PlatformBusinessRecordDetail)
    if (req.method === 'GET' && endpoint === 'business-records' && resourceId && !parts[2]) {
      const { data: record, error } = await admin
        .from('platform_business_records')
        .select('*')
        .eq('id', resourceId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching platform business record:', error);
        return createCorsResponse({ error: 'Failed to fetch record' }, 500, req);
      }
      if (!record) {
        return createCorsResponse({ error: 'Record not found' }, 404, req);
      }
      return createCorsResponse(camelRow(record as Row), 200, req);
    }

    // GET /platform-crm/business-records/:id/contacts
    if (
      req.method === 'GET' &&
      endpoint === 'business-records' &&
      resourceId &&
      parts[2] === 'contacts'
    ) {
      const { data: contacts, error } = await admin
        .from('platform_contacts')
        .select('*')
        .eq('business_record_id', resourceId)
        // Real column is is_primary_contact, not is_primary.
        .order('is_primary_contact', { ascending: false });

      if (error) {
        console.error('Error fetching platform contacts:', error);
        return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
      }
      return createCorsResponse(camelRows(contacts as Row[]), 200, req);
    }

    // PATCH /platform-crm/business-records/:id
    if (req.method === 'PATCH' && endpoint === 'business-records' && resourceId && !parts[2]) {
      const body = (await req.json()) as Row;
      const values = toRecordColumns(body);

      const { data: record, error } = await admin
        .from('platform_business_records')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', resourceId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating platform business record:', error);
        return createCorsResponse({ error: 'Failed to update record' }, 500, req);
      }
      if (!record) {
        return createCorsResponse({ error: 'Record not found' }, 404, req);
      }
      return createCorsResponse(camelRow(record as Row), 200, req);
    }

    // DELETE /platform-crm/business-records/:id
    if (req.method === 'DELETE' && endpoint === 'business-records' && resourceId && !parts[2]) {
      const { error } = await admin.from('platform_business_records').delete().eq('id', resourceId);

      if (error) {
        console.error('Error deleting platform business record:', error);
        return createCorsResponse({ error: 'Failed to delete record' }, 500, req);
      }
      // The list page reads response.json() on success, so answer with a body.
      return createCorsResponse({ success: true, id: resourceId }, 200, req);
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
          ...toRecordColumns(body),
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

      return createCorsResponse(camelRow(record as Row), 201, req);
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
