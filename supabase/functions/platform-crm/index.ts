// Platform CRM Edge Function
// Handles platform-level CRM operations for root admins.
// Full parity with server/routes-platform-business-records.ts (Express, mounted at
// /api/platform-crm, all routes under /business-records*) plus the legacy
// GET /leads, GET /activities, GET /stats, POST /activities helpers and the
// frontend's actual /api/platform-crm/... calls.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse, getCorsHeaders } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Translate the frontend/Express camelCase filter vocabulary onto the
 * authoritative snake_case columns of platform_business_records and apply the
 * matching Supabase query operators. Mutates and returns the query builder.
 */
function applyBusinessRecordFilters(query: any, params: URLSearchParams): any {
  const get = (k: string) => params.get(k);

  if (get('recordType')) query = query.eq('record_type', get('recordType'));

  // Status can be repeated (?status=a&status=b) -> IN list
  const statuses = params.getAll('status').filter(Boolean);
  if (statuses.length === 1) query = query.eq('status', statuses[0]);
  else if (statuses.length > 1) query = query.in('status', statuses);

  if (get('leadTier')) query = query.eq('lead_tier', get('leadTier'));

  if (get('leadScoreMin') !== null && get('leadScoreMin') !== '')
    query = query.gte('lead_score', parseInt(get('leadScoreMin')!, 10));
  if (get('leadScoreMax') !== null && get('leadScoreMax') !== '')
    query = query.lte('lead_score', parseInt(get('leadScoreMax')!, 10));

  if (get('assignedSalesRep')) query = query.eq('assigned_sales_rep', get('assignedSalesRep'));
  if (get('assignedCSM')) query = query.eq('assigned_csm', get('assignedCSM'));
  if (get('leadSource')) query = query.eq('lead_source', get('leadSource'));
  if (get('industry')) query = query.eq('industry', get('industry'));
  if (get('companySize')) query = query.eq('company_size', get('companySize'));
  if (get('territory')) query = query.eq('territory', get('territory'));
  if (get('churnRisk')) query = query.eq('churn_risk', get('churnRisk'));
  if (get('trialStatus')) query = query.eq('trial_status', get('trialStatus'));

  if (get('search')) {
    const term = `%${get('search')}%`;
    query = query.or(
      `company_name.ilike.${term},primary_contact_email.ilike.${term},primary_contact_name.ilike.${term}`,
    );
  }

  if (get('createdAfter'))
    query = query.gte('created_at', new Date(get('createdAfter')!).toISOString());
  if (get('createdBefore'))
    query = query.lte('created_at', new Date(get('createdBefore')!).toISOString());

  if (get('priority')) query = query.eq('priority', get('priority'));
  if (get('isStrategic') === 'true' || get('isStrategic') === '1')
    query = query.eq('is_strategic', true);

  return query;
}

// Map the camelCase sortBy values the frontend may send onto snake_case columns.
const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  companyName: 'company_name',
  leadScore: 'lead_score',
  status: 'status',
  recordType: 'record_type',
  leadTier: 'lead_tier',
  estimatedValue: 'estimated_value',
  currentMRR: 'current_mrr',
  currentARR: 'current_arr',
  nextFollowUpDate: 'next_follow_up_date',
  customerSince: 'customer_since',
};

function resolveSortColumn(sortBy: string | null): string {
  if (!sortBy) return 'created_at';
  return SORT_COLUMN_MAP[sortBy] || sortBy; // allow already-snake_case values through
}

function csvCell(v: unknown): string {
  return `"${v === null || v === undefined ? '' : String(v)}"`;
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    const sp = url.searchParams;
    const { parts } = normalizePath(url.pathname, 'platform-crm');
    const endpoint = parts[0];
    // For business-records sub-routing: parts[1] is id-or-keyword, parts[2] is subresource.
    const seg1 = parts[1];
    const seg2 = parts[2];

    // =====================================================================
    // BUSINESS RECORDS
    // =====================================================================
    if (endpoint === 'business-records') {
      // -----------------------------------------------------------------
      // Named (non-:id) routes MUST be matched before the :id cases.
      // -----------------------------------------------------------------

      // GET /business-records/stats
      if (req.method === 'GET' && seg1 === 'stats') {
        const recordType = sp.get('recordType');

        let rowsQuery = admin
          .from('platform_business_records')
          .select(
            'status, record_type, lead_tier, churn_risk, lead_score, estimated_value, current_mrr, current_arr',
          )
          .is('deleted_at', null);
        if (recordType) rowsQuery = rowsQuery.eq('record_type', recordType);

        const { data: rows, error } = await rowsQuery;
        if (error) {
          console.error('Error fetching stats rows:', error);
          return createCorsResponse({ error: 'Failed to fetch statistics' }, 500, req);
        }

        const list = rows || [];

        // overall aggregate
        let leadScoreSum = 0;
        let leadScoreCount = 0;
        let totalEstimatedValue = 0;
        let totalMRR = 0;
        let totalARR = 0;
        for (const r of list) {
          const ls = (r as any).lead_score;
          if (ls !== null && ls !== undefined) {
            leadScoreSum += Number(ls) || 0;
            leadScoreCount += 1;
          }
          totalEstimatedValue += Number((r as any).estimated_value) || 0;
          totalMRR += Number((r as any).current_mrr) || 0;
          totalARR += Number((r as any).current_arr) || 0;
        }

        const overall = {
          totalRecords: list.length,
          avgLeadScore: leadScoreCount > 0 ? leadScoreSum / leadScoreCount : null,
          totalEstimatedValue,
          totalMRR,
          totalARR,
        };

        // byStatus
        const statusMap = new Map<string | null, number>();
        for (const r of list) {
          const key = (r as any).status ?? null;
          statusMap.set(key, (statusMap.get(key) || 0) + 1);
        }
        const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
          status,
          count,
        }));

        // byLeadTier (prospects only)
        const tierAgg = new Map<string | null, { count: number; sum: number; n: number }>();
        for (const r of list) {
          if ((r as any).record_type !== 'prospect') continue;
          const key = (r as any).lead_tier ?? null;
          const cur = tierAgg.get(key) || { count: 0, sum: 0, n: 0 };
          cur.count += 1;
          const ls = (r as any).lead_score;
          if (ls !== null && ls !== undefined) {
            cur.sum += Number(ls) || 0;
            cur.n += 1;
          }
          tierAgg.set(key, cur);
        }
        const byLeadTier = Array.from(tierAgg.entries()).map(([leadTier, v]) => ({
          leadTier,
          count: v.count,
          avgScore: v.n > 0 ? v.sum / v.n : null,
        }));

        // byChurnRisk (tenants with non-null churn risk)
        const churnAgg = new Map<string, { count: number; totalMRR: number }>();
        for (const r of list) {
          if ((r as any).record_type !== 'tenant') continue;
          const key = (r as any).churn_risk;
          if (key === null || key === undefined) continue;
          const cur = churnAgg.get(key) || { count: 0, totalMRR: 0 };
          cur.count += 1;
          cur.totalMRR += Number((r as any).current_mrr) || 0;
          churnAgg.set(key, cur);
        }
        const byChurnRisk = Array.from(churnAgg.entries()).map(([churnRisk, v]) => ({
          churnRisk,
          count: v.count,
          totalMRR: v.totalMRR,
        }));

        return createCorsResponse({ overall, byStatus, byLeadTier, byChurnRisk }, 200, req);
      }

      // GET /business-records/export
      if (req.method === 'GET' && seg1 === 'export') {
        const format = sp.get('format') || 'csv';

        let query: any = admin
          .from('platform_business_records')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        query = applyBusinessRecordFilters(query, sp);

        const { data: records, error } = await query;
        if (error) {
          console.error('Error exporting records:', error);
          return createCorsResponse({ error: 'Failed to export records' }, 500, req);
        }

        const list = records || [];

        if (format === 'csv') {
          const headers = [
            'ID',
            'Company Name',
            'Type',
            'Status',
            'Email',
            'Contact Name',
            'Lead Score',
            'Lead Tier',
            'Industry',
            'Company Size',
            'Territory',
            'Assigned Sales Rep',
            'Created At',
            'Customer Since',
            'MRR',
            'ARR',
          ];

          const rows = list.map((r: any) => [
            r.id,
            r.company_name,
            r.record_type,
            r.status,
            r.primary_contact_email,
            r.primary_contact_name,
            r.lead_score,
            r.lead_tier,
            r.industry,
            r.company_size,
            r.territory,
            r.assigned_sales_rep,
            r.created_at,
            r.customer_since,
            r.current_mrr,
            r.current_arr,
          ]);

          const csv = [headers, ...rows]
            .map((row: unknown[]) => row.map((cell) => csvCell(cell)).join(','))
            .join('\n');

          const origin = req.headers.get('origin');
          return new Response(csv, {
            status: 200,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename=business-records-${Date.now()}.csv`,
            },
          });
        }

        // JSON export
        return createCorsResponse({ records: list }, 200, req);
      }

      // POST /business-records/bulk-update
      if (req.method === 'POST' && seg1 === 'bulk-update') {
        const body = await req.json().catch(() => ({}));
        const ids = body?.ids;
        const updates = body?.updates || {};

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return createCorsResponse({ error: 'Invalid or empty IDs array' }, 400, req);
        }

        const { data: updated, error } = await admin
          .from('platform_business_records')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .in('id', ids)
          .select();

        if (error) {
          console.error('Error bulk updating records:', error);
          return createCorsResponse({ error: 'Failed to bulk update records' }, 500, req);
        }

        return createCorsResponse(
          { updated: (updated || []).length, records: updated || [] },
          200,
          req,
        );
      }

      // POST /business-records/bulk/assign  (frontend body: { recordIds, assignedRep })
      if (req.method === 'POST' && seg1 === 'bulk' && seg2 === 'assign') {
        const body = await req.json().catch(() => ({}));
        const ids = body?.ids || body?.recordIds;
        const assignedSalesRep = body?.assignedSalesRep ?? body?.assignedRep;
        const assignedCSM = body?.assignedCSM;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return createCorsResponse({ error: 'Invalid or empty IDs array' }, 400, req);
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (assignedSalesRep !== undefined) updates.assigned_sales_rep = assignedSalesRep;
        if (assignedCSM !== undefined) updates.assigned_csm = assignedCSM;

        const { data: updated, error } = await admin
          .from('platform_business_records')
          .update(updates)
          .in('id', ids)
          .select();

        if (error) {
          console.error('Error bulk assigning records:', error);
          return createCorsResponse({ error: 'Failed to assign records' }, 500, req);
        }

        return createCorsResponse(
          { updated: (updated || []).length, records: updated || [] },
          200,
          req,
        );
      }

      // DELETE /business-records/bulk-delete  (soft delete)
      if (req.method === 'DELETE' && seg1 === 'bulk-delete') {
        const body = await req.json().catch(() => ({}));
        const ids = body?.ids;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return createCorsResponse({ error: 'Invalid or empty IDs array' }, 400, req);
        }

        const now = new Date().toISOString();
        const { data: deleted, error } = await admin
          .from('platform_business_records')
          .update({ deleted_at: now, updated_at: now })
          .in('id', ids)
          .select();

        if (error) {
          console.error('Error bulk deleting records:', error);
          return createCorsResponse({ error: 'Failed to bulk delete records' }, 500, req);
        }

        return createCorsResponse(
          { deleted: (deleted || []).length, records: deleted || [] },
          200,
          req,
        );
      }

      // GET /business-records  (list with pagination + filters)
      if (req.method === 'GET' && !seg1) {
        const page = parseInt(sp.get('page') || '1', 10);
        const limit = parseInt(sp.get('limit') || '50', 10);
        const offset = (page - 1) * limit;
        const sortColumn = resolveSortColumn(sp.get('sortBy'));
        const ascending = sp.get('sortOrder') === 'asc';

        let query: any = admin
          .from('platform_business_records')
          .select('*', { count: 'exact' })
          .is('deleted_at', null);
        query = applyBusinessRecordFilters(query, sp);
        query = query.order(sortColumn, { ascending }).range(offset, offset + limit - 1);

        const { data: records, error, count } = await query;
        if (error) {
          console.error('Error fetching business records:', error);
          return createCorsResponse({ error: 'Failed to fetch business records' }, 500, req);
        }

        const totalRecords = count || 0;
        const totalPages = Math.ceil(totalRecords / limit);

        return createCorsResponse(
          {
            records: records || [],
            pagination: {
              page,
              limit,
              totalRecords,
              totalPages,
              hasMore: page < totalPages,
            },
          },
          200,
          req,
        );
      }

      // POST /business-records  (create)
      if (req.method === 'POST' && !seg1) {
        const body = await req.json().catch(() => ({}));
        const recordType = body.record_type || body.recordType || 'prospect';

        const insert: Record<string, unknown> = { ...body };
        // Default status if not provided
        if (!insert.status) {
          insert.status = recordType === 'prospect' ? 'new' : 'active_customer';
        }
        insert.record_type = recordType;
        delete (insert as any).recordType;
        insert.created_at = new Date().toISOString();
        insert.updated_at = new Date().toISOString();

        const { data: newRecord, error } = await admin
          .from('platform_business_records')
          .insert(insert)
          .select()
          .single();

        if (error) {
          console.error('Error creating business record:', error);
          return createCorsResponse({ error: 'Failed to create business record' }, 500, req);
        }

        // Log creation activity (mirrors Express)
        await admin.from('platform_activities').insert({
          business_record_id: (newRecord as any).id,
          activity_type: 'note',
          subject: 'Business record created',
          description: `${
            (newRecord as any).record_type === 'prospect' ? 'Prospect' : 'Tenant'
          } record created`,
          activity_date: new Date().toISOString(),
          created_by: user.id,
          created_at: new Date().toISOString(),
        });

        return createCorsResponse(newRecord, 201, req);
      }

      // -----------------------------------------------------------------
      // :id routes — seg1 is the record id from here down.
      // -----------------------------------------------------------------
      const recordId = seg1;

      // GET /business-records/:id/contacts
      if (req.method === 'GET' && seg2 === 'contacts') {
        const { data: contacts, error } = await admin
          .from('platform_contacts')
          .select('*')
          .eq('business_record_id', recordId)
          .order('is_primary_contact', { ascending: false })
          .order('last_name', { ascending: true });

        if (error) {
          console.error('Error fetching contacts:', error);
          return createCorsResponse({ error: 'Failed to fetch contacts' }, 500, req);
        }

        return createCorsResponse(contacts || [], 200, req);
      }

      // GET /business-records/:id/timeline
      if (req.method === 'GET' && seg2 === 'timeline') {
        const limit = parseInt(sp.get('limit') || '50', 10);
        const offset = parseInt(sp.get('offset') || '0', 10);

        const {
          data: activities,
          error,
          count,
        } = await admin
          .from('platform_activities')
          .select('*', { count: 'exact' })
          .eq('business_record_id', recordId)
          .order('activity_date', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('Error fetching timeline:', error);
          return createCorsResponse({ error: 'Failed to fetch timeline' }, 500, req);
        }

        const totalCount = count || 0;
        const list = activities || [];
        return createCorsResponse(
          {
            activities: list,
            totalCount,
            hasMore: offset + list.length < totalCount,
          },
          200,
          req,
        );
      }

      // POST /business-records/:id/convert-to-tenant
      if (req.method === 'POST' && seg2 === 'convert-to-tenant') {
        const body = await req.json().catch(() => ({}));
        const { tenantId, conversionSource } = body;

        const { data: record, error: fetchErr } = await admin
          .from('platform_business_records')
          .select('*')
          .eq('id', recordId)
          .is('deleted_at', null)
          .maybeSingle();

        if (fetchErr) {
          console.error('Error fetching record for conversion:', fetchErr);
          return createCorsResponse({ error: 'Failed to convert to tenant' }, 500, req);
        }
        if (!record) {
          return createCorsResponse({ error: 'Business record not found' }, 404, req);
        }
        if ((record as any).record_type === 'tenant') {
          return createCorsResponse({ error: 'Record is already a tenant' }, 400, req);
        }

        const now = new Date().toISOString();
        const { data: converted, error } = await admin
          .from('platform_business_records')
          .update({
            record_type: 'tenant',
            status: 'active_customer',
            previous_status: (record as any).status,
            tenant_id: tenantId,
            customer_since: now,
            converted_from_prospect_at: now,
            converted_by: user.id,
            conversion_source: conversionSource || 'manual',
            updated_at: now,
          })
          .eq('id', recordId)
          .select()
          .single();

        if (error) {
          console.error('Error converting to tenant:', error);
          return createCorsResponse({ error: 'Failed to convert to tenant' }, 500, req);
        }

        await admin.from('platform_activities').insert({
          business_record_id: recordId,
          activity_type: 'note',
          subject: 'Converted to tenant',
          description: `Prospect converted to active customer. Tenant ID: ${tenantId}`,
          activity_date: now,
          created_by: user.id,
          outcome: 'successful',
          created_at: now,
        });

        return createCorsResponse(converted, 200, req);
      }

      // GET /business-records/:id  (single + optional related data)
      if (req.method === 'GET' && recordId && !seg2) {
        const { data: record, error } = await admin
          .from('platform_business_records')
          .select('*')
          .eq('id', recordId)
          .is('deleted_at', null)
          .maybeSingle();

        if (error) {
          console.error('Error fetching business record:', error);
          return createCorsResponse({ error: 'Failed to fetch business record' }, 500, req);
        }
        if (!record) {
          return createCorsResponse({ error: 'Business record not found' }, 404, req);
        }

        const response: Record<string, unknown> = { record };
        const includeFields = (sp.get('include') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        if (includeFields.includes('contacts')) {
          const { data } = await admin
            .from('platform_contacts')
            .select('*')
            .eq('business_record_id', recordId)
            .order('is_primary_contact', { ascending: false })
            .order('last_name', { ascending: true });
          response.contacts = data || [];
        }

        if (includeFields.includes('deals')) {
          const { data } = await admin
            .from('platform_deals')
            .select('*')
            .eq('business_record_id', recordId)
            .order('created_at', { ascending: false });
          response.deals = data || [];
        }

        if (includeFields.includes('activities')) {
          const { data } = await admin
            .from('platform_activities')
            .select('*')
            .eq('business_record_id', recordId)
            .order('activity_date', { ascending: false })
            .limit(20);
          response.activities = data || [];
        }

        if (includeFields.includes('leadScore')) {
          const { data } = await admin
            .from('platform_lead_score_calculations')
            .select('*')
            .eq('business_record_id', recordId)
            .maybeSingle();
          response.leadScore = data || null;
        }

        if (includeFields.includes('healthScore') && (record as any).record_type === 'tenant') {
          const { data } = await admin
            .from('platform_health_scores')
            .select('*')
            .eq('business_record_id', recordId)
            .maybeSingle();
          response.healthScore = data || null;
        }

        if (includeFields.includes('churnPrediction') && (record as any).record_type === 'tenant') {
          const { data } = await admin
            .from('platform_churn_predictions')
            .select('*')
            .eq('business_record_id', recordId)
            .order('predicted_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          response.churnPrediction = data || null;
        }

        return createCorsResponse(response, 200, req);
      }

      // PATCH /business-records/:id  (update + activity log)
      if (req.method === 'PATCH' && recordId && !seg2) {
        const updates = await req.json().catch(() => ({}));

        const { data: current, error: fetchErr } = await admin
          .from('platform_business_records')
          .select('*')
          .eq('id', recordId)
          .is('deleted_at', null)
          .maybeSingle();

        if (fetchErr) {
          console.error('Error fetching record for update:', fetchErr);
          return createCorsResponse({ error: 'Failed to update business record' }, 500, req);
        }
        if (!current) {
          return createCorsResponse({ error: 'Business record not found' }, 404, req);
        }

        const { data: updated, error } = await admin
          .from('platform_business_records')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', recordId)
          .select()
          .single();

        if (error) {
          console.error('Error updating business record:', error);
          return createCorsResponse({ error: 'Failed to update business record' }, 500, req);
        }

        // Log significant changes (mirror Express). Support both casings.
        const newStatus = updates.status;
        const newRep =
          updates.assigned_sales_rep !== undefined
            ? updates.assigned_sales_rep
            : updates.assignedSalesRep;
        const newLeadScore =
          updates.lead_score !== undefined ? updates.lead_score : updates.leadScore;

        const significantChanges: string[] = [];
        if (newStatus && newStatus !== (current as any).status) {
          significantChanges.push(`Status changed from ${(current as any).status} to ${newStatus}`);
        }
        if (newRep !== undefined && newRep !== (current as any).assigned_sales_rep) {
          significantChanges.push('Assigned sales rep changed');
        }
        if (newLeadScore !== undefined && newLeadScore !== (current as any).lead_score) {
          significantChanges.push(
            `Lead score changed from ${(current as any).lead_score} to ${newLeadScore}`,
          );
        }

        if (significantChanges.length > 0) {
          await admin.from('platform_activities').insert({
            business_record_id: recordId,
            activity_type: 'note',
            subject: 'Record updated',
            description: significantChanges.join('. '),
            activity_date: new Date().toISOString(),
            created_by: user.id,
            created_at: new Date().toISOString(),
          });
        }

        return createCorsResponse(updated, 200, req);
      }

      // DELETE /business-records/:id  (soft delete)
      if (req.method === 'DELETE' && recordId && !seg2) {
        const now = new Date().toISOString();
        const { data: deleted, error } = await admin
          .from('platform_business_records')
          .update({ deleted_at: now, updated_at: now })
          .eq('id', recordId)
          .is('deleted_at', null)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error deleting business record:', error);
          return createCorsResponse({ error: 'Failed to delete business record' }, 500, req);
        }
        if (!deleted) {
          return createCorsResponse({ error: 'Business record not found' }, 404, req);
        }

        return createCorsResponse(
          { message: 'Business record deleted successfully', record: deleted },
          200,
          req,
        );
      }
    }

    // =====================================================================
    // LEGACY HELPER ENDPOINTS
    // =====================================================================

    // GET /platform-crm/leads - List platform leads
    if (req.method === 'GET' && endpoint === 'leads') {
      const { data: leads, error } = await admin
        .from('platform_business_records')
        .select('*')
        .eq('record_type', 'prospect')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching platform leads:', error);
        return createCorsResponse({ error: 'Failed to fetch leads' }, 500, req);
      }

      return createCorsResponse(leads || [], 200, req);
    }

    // GET /platform-crm/activities - List platform activities
    if (req.method === 'GET' && endpoint === 'activities') {
      const limit = parseInt(sp.get('limit') || '50', 10);
      const businessRecordId = sp.get('businessRecordId');

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

    // GET /platform-crm/stats - Top-level CRM summary stats
    if (req.method === 'GET' && endpoint === 'stats') {
      const { count: totalLeads } = await admin
        .from('platform_business_records')
        .select('*', { count: 'exact', head: true })
        .eq('record_type', 'prospect')
        .is('deleted_at', null);

      const { count: totalCustomers } = await admin
        .from('platform_business_records')
        .select('*', { count: 'exact', head: true })
        .eq('record_type', 'tenant')
        .is('deleted_at', null);

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

    // POST /platform-crm/activities - Log platform activity
    if (req.method === 'POST' && endpoint === 'activities') {
      const body = await req.json().catch(() => ({}));

      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert({
          ...body,
          created_by: user.id,
          activity_date: body.activityDate || body.activity_date || new Date().toISOString(),
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
