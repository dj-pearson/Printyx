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

// Columns a caller may write on platform_lead_assignment_rules. The page used to
// be built against a shape with none of these names (name, triggerOn, leadGrades,
// targetTerritoryId...), so an unfiltered body would be a PGRST204 (PA-052).
const ASSIGNMENT_RULE_COLUMNS = new Set([
  'rule_name',
  'description',
  'priority',
  'assignment_type',
  'lead_source',
  'lead_score_min',
  'lead_score_max',
  'industries',
  'company_size',
  'deal_size_min',
  'deal_size_max',
  'geography',
  'round_robin_users',
  'skip_unavailable',
  'respect_capacity',
  'assign_to_territory_id',
  'assign_to_user_id',
  'max_leads_per_rep',
  'max_leads_per_day',
  'assign_immediately',
  'delay_minutes',
  'business_hours_only',
  'is_active',
]);

// Columns a caller may write on platform_sales_territories.
const TERRITORY_COLUMNS = new Set([
  'name',
  'code',
  'description',
  'territory_type',
  'countries',
  'states',
  'cities',
  'postal_codes',
  'industries',
  'company_size_min',
  'company_size_max',
  'revenue_min',
  'revenue_max',
  'account_tiers',
  'owner_id',
  'team_members',
  'manager_id',
  'monthly_quota',
  'quarterly_quota',
  'annual_quota',
  'is_active',
]);

// Columns a caller may write on platform_lead_scoring_rules.
const SCORING_RULE_COLUMNS = new Set([
  'rule_name',
  'category',
  'description',
  'field_name',
  'operator',
  'value',
  'points',
  'max_points',
  'priority',
  'weight',
  'is_active',
]);

// The column comments' own vocabularies. The page offered 'technographic' and
// camelCase operators (greaterThan/lessThan/between), none of which any scorer
// reads, so a rule saved with one would never fire (PA-052).
const SCORING_CATEGORIES = ['demographic', 'firmographic', 'behavioral', 'engagement', 'bant'];
const SCORING_OPERATORS = [
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'contains',
  'in_list',
];

/** Returns an error message when a rule names a category or operator no scorer reads. */
function validateScoringVocabulary(row: Row): string | null {
  if (row.category !== undefined && !SCORING_CATEGORIES.includes(String(row.category))) {
    return `category must be one of: ${SCORING_CATEGORIES.join(', ')}`;
  }
  if (row.operator !== undefined && !SCORING_OPERATORS.includes(String(row.operator))) {
    return `operator must be one of: ${SCORING_OPERATORS.join(', ')}`;
  }
  return null;
}

function scoringRuleWrite(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body)) {
    const column = toSnake(k);
    if (SCORING_RULE_COLUMNS.has(column)) out[column] = v;
  }
  return out;
}

function territoryWrite(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body)) {
    const column = toSnake(k);
    if (TERRITORY_COLUMNS.has(column)) out[column] = v;
  }
  return out;
}

function assignmentRuleWrite(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body)) {
    const column = toSnake(k);
    if (ASSIGNMENT_RULE_COLUMNS.has(column)) out[column] = v;
  }
  return out;
}

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
    //
    // PA-052: `!resourceId` was missing, so this matched /business-records/:id
    // and /business-records/:id/contacts too and returned the paginated LIST for
    // both. The single-record and contacts branches below have been unreachable,
    // which is why the record detail page rendered nothing off them.
    if (req.method === 'GET' && endpoint === 'business-records' && !resourceId) {
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

      // platform_business_records has no created_by column — it tracks people as
      // assigned_sales_rep / assigned_csm / converted_by — so setting one made
      // every create a 42703. The creator is reported rather than invented onto
      // one of those, which mean different things.
      const { data: record, error } = await admin
        .from('platform_business_records')
        .insert({
          ...toRecordColumns(body),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating platform business record:', error);
        return createCorsResponse({ error: 'Failed to create record' }, 500, req);
      }

      return createCorsResponse(
        {
          ...camelRow(record as Row),
          unpersisted: ['createdBy: platform_business_records has no created_by column'],
        },
        201,
        req,
      );
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
    // POST /platform-crm/business-records/:id/convert-to-tenant
    //
    // PA-052: PlatformBusinessRecordDetail.tsx has always called this and
    // nothing served it. Every column the conversion needs already exists on
    // platform_business_records - record_type ('prospect' | 'tenant'), a
    // tenant_id FK, converted_from_prospect_at, converted_by and
    // conversion_source - so this creates the tenant and records the link.
    //
    // The caller used to post { tenantId: 'new-tenant-id' } with a comment
    // saying it "would be generated". That literal is not a uuid and would have
    // failed the FK, so the id is generated HERE and a client-supplied one is
    // only honoured when it names a tenant that actually exists.
    if (
      req.method === 'POST' &&
      endpoint === 'business-records' &&
      resourceId &&
      parts[2] === 'convert-to-tenant'
    ) {
      const body = await req.json().catch(() => ({}));

      const { data: record, error: findError } = await admin
        .from('platform_business_records')
        .select('id, company_name, record_type, tenant_id, website, industry, company_size')
        .eq('id', resourceId)
        .maybeSingle();

      if (findError) {
        console.error('Error loading business record:', findError);
        return createCorsResponse({ error: 'Failed to load business record' }, 500, req);
      }
      if (!record) return createCorsResponse({ error: 'Business record not found' }, 404, req);

      // Converting twice would orphan the first tenant, so it is a 409 naming
      // the tenant this record already points at.
      if (record.record_type === 'tenant' || record.tenant_id) {
        return createCorsResponse(
          {
            error: 'This record has already been converted',
            tenantId: record.tenant_id ?? null,
          },
          409,
          req,
        );
      }

      let tenantId: string | null = null;
      const requestedTenantId = body.tenantId ?? body.tenant_id;

      // Link to an EXISTING tenant only if it really exists; otherwise create one.
      if (requestedTenantId) {
        const { data: existing } = await admin
          .from('tenants')
          .select('id')
          .eq('id', requestedTenantId)
          .maybeSingle();
        if (existing) tenantId = existing.id;
      }

      if (!tenantId) {
        // Slug is UNIQUE and NOT NULL. Derive it from the company name the same
        // way supabase/functions/signup does, then suffix on collision rather
        // than failing the conversion on a name someone else already took.
        const base =
          String(record.company_name || 'tenant')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'tenant';

        let slug = base;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: clash } = await admin
            .from('tenants')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          if (!clash) break;
          slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        }

        const newTenantId = crypto.randomUUID();
        // Columns only: tenants has no industry/website/company_size, which is
        // the insert COP-M01 found failing in signup. Those go in metadata.
        const { error: tenantError } = await admin.from('tenants').insert({
          id: newTenantId,
          name: record.company_name,
          slug,
          is_active: true,
          billing_status: 'pending',
          metadata: {
            industry: record.industry ?? null,
            companySize: record.company_size ?? null,
            website: record.website ?? null,
            source: 'platform-crm-conversion',
            convertedFromRecordId: record.id,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (tenantError) {
          console.error('Error creating tenant:', tenantError);
          return createCorsResponse(
            { error: 'Failed to create tenant', details: tenantError },
            500,
            req,
          );
        }

        tenantId = newTenantId;
      }

      const { data: updated, error: updateError } = await admin
        .from('platform_business_records')
        .update({
          record_type: 'tenant',
          tenant_id: tenantId,
          converted_from_prospect_at: new Date().toISOString(),
          converted_by: user.id,
          conversion_source: body.conversionSource ?? body.conversion_source ?? 'sales',
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (updateError) {
        // The tenant exists but the record does not point at it. Say so - a bare
        // 500 here reads as "nothing happened", and a retry would make a second.
        console.error('Error linking record to tenant:', updateError);
        return createCorsResponse(
          {
            error: 'Tenant was created but the record could not be linked to it',
            tenantId,
            details: updateError,
          },
          500,
          req,
        );
      }

      return createCorsResponse({ ...camelRow(updated), tenantId }, 200, req);
    }

    // ─── Lead scoring rules (PA-052) ────────────────────────────────────────
    //
    // PlatformLeadScoring.tsx calls this and nothing served it, while
    // platform_lead_scoring_rules has been in the schema all along. There is NO
    // scoring-models table and no branch for one - see the page for why the
    // model concept was removed rather than invented.
    if (endpoint === 'scoring-rules') {
      if (req.method === 'GET' && !resourceId) {
        const category = url.searchParams.get('category');

        let query = admin
          .from('platform_lead_scoring_rules')
          .select('*')
          .order('priority', { ascending: false })
          .order('rule_name', { ascending: true });

        if (category) query = query.eq('category', category);

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching scoring rules:', error);
          return createCorsResponse({ error: 'Failed to fetch scoring rules' }, 500, req);
        }

        return createCorsResponse(camelRows(data), 200, req);
      }

      if (req.method === 'GET' && resourceId) {
        const { data, error } = await admin
          .from('platform_lead_scoring_rules')
          .select('*')
          .eq('id', resourceId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching scoring rule:', error);
          return createCorsResponse({ error: 'Failed to fetch scoring rule' }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Scoring rule not found' }, 404, req);

        return createCorsResponse(camelRow(data), 200, req);
      }

      if (req.method === 'POST' && !resourceId) {
        const body = await req.json().catch(() => ({}));
        const row = scoringRuleWrite(body);

        // rule_name, category, field_name, operator, value and points are all
        // NOT NULL. Note points may legitimately be 0 or negative, so it is
        // tested for presence rather than truthiness.
        const missing: string[] = [];
        if (!row.rule_name) missing.push('ruleName');
        if (!row.category) missing.push('category');
        if (!row.field_name) missing.push('fieldName');
        if (!row.operator) missing.push('operator');
        if (row.value === undefined || row.value === null) missing.push('value');
        if (row.points === undefined || row.points === null) missing.push('points');
        if (missing.length) {
          return createCorsResponse(
            { error: `Missing required field(s): ${missing.join(', ')}` },
            400,
            req,
          );
        }

        const invalid = validateScoringVocabulary(row);
        if (invalid) return createCorsResponse({ error: invalid }, 400, req);

        const { data, error } = await admin
          .from('platform_lead_scoring_rules')
          .insert({ ...row, created_by: user.id })
          .select()
          .single();

        if (error) {
          console.error('Error creating scoring rule:', error);
          return createCorsResponse({ error: 'Failed to create scoring rule' }, 500, req);
        }

        return createCorsResponse(camelRow(data), 201, req);
      }

      if ((req.method === 'PUT' || req.method === 'PATCH') && resourceId) {
        const body = await req.json().catch(() => ({}));
        const row = scoringRuleWrite(body);

        const invalid = validateScoringVocabulary(row);
        if (invalid) return createCorsResponse({ error: invalid }, 400, req);

        const { data, error } = await admin
          .from('platform_lead_scoring_rules')
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq('id', resourceId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error updating scoring rule:', error);
          return createCorsResponse({ error: 'Failed to update scoring rule' }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Scoring rule not found' }, 404, req);

        return createCorsResponse(camelRow(data), 200, req);
      }

      if (req.method === 'DELETE' && resourceId) {
        const { error } = await admin
          .from('platform_lead_scoring_rules')
          .delete()
          .eq('id', resourceId);

        if (error) {
          console.error('Error deleting scoring rule:', error);
          return createCorsResponse({ error: 'Failed to delete scoring rule' }, 500, req);
        }

        return createCorsResponse({ success: true, message: 'Scoring rule deleted' }, 200, req);
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // ─── Sales territories (PA-052) ─────────────────────────────────────────
    //
    // PlatformTerritories.tsx and PlatformAssignmentRules.tsx both call this and
    // nothing served it on either host, while platform_sales_territories has
    // been in the schema all along. Platform-level table, no tenant_id; the
    // root-admin gate above is the control.
    if (endpoint === 'territories') {
      if (req.method === 'GET' && !resourceId) {
        const { data, error } = await admin
          .from('platform_sales_territories')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching territories:', error);
          return createCorsResponse({ error: 'Failed to fetch territories' }, 500, req);
        }

        return createCorsResponse(camelRows(data), 200, req);
      }

      if (req.method === 'GET' && resourceId) {
        const { data, error } = await admin
          .from('platform_sales_territories')
          .select('*')
          .eq('id', resourceId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching territory:', error);
          return createCorsResponse({ error: 'Failed to fetch territory' }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Territory not found' }, 404, req);

        return createCorsResponse(camelRow(data), 200, req);
      }

      if (req.method === 'POST' && !resourceId) {
        const body = await req.json().catch(() => ({}));
        const row = territoryWrite(body);

        // name and owner_id are NOT NULL. owner_id is the territory's primary
        // rep; the caller who creates one owns it unless they name someone else,
        // which beats a 23502 nobody can read.
        if (!row.name) return createCorsResponse({ error: 'name is required' }, 400, req);
        if (!row.owner_id) row.owner_id = user.id;

        const { data, error } = await admin
          .from('platform_sales_territories')
          .insert(row)
          .select()
          .single();

        if (error) {
          console.error('Error creating territory:', error);
          // `code` is UNIQUE, and a duplicate is the caller's mistake, not a fault.
          if ((error as any).code === '23505') {
            return createCorsResponse(
              { error: 'A territory with that code already exists' },
              409,
              req,
            );
          }
          return createCorsResponse({ error: 'Failed to create territory' }, 500, req);
        }

        return createCorsResponse(camelRow(data), 201, req);
      }

      if ((req.method === 'PUT' || req.method === 'PATCH') && resourceId) {
        const body = await req.json().catch(() => ({}));
        const row = territoryWrite(body);

        const { data, error } = await admin
          .from('platform_sales_territories')
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq('id', resourceId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error updating territory:', error);
          if ((error as any).code === '23505') {
            return createCorsResponse(
              { error: 'A territory with that code already exists' },
              409,
              req,
            );
          }
          return createCorsResponse({ error: 'Failed to update territory' }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Territory not found' }, 404, req);

        return createCorsResponse(camelRow(data), 200, req);
      }

      if (req.method === 'DELETE' && resourceId) {
        // platform_lead_assignment_rules.assign_to_territory_id references this
        // row, so a blind delete is a 23503. Say which rules hold it instead.
        const { data: referencing } = await admin
          .from('platform_lead_assignment_rules')
          .select('id, rule_name')
          .eq('assign_to_territory_id', resourceId);

        if (referencing && referencing.length) {
          return createCorsResponse(
            {
              error: 'Territory is still assigned by rules',
              rules: referencing.map((r: Row) => r.rule_name),
            },
            409,
            req,
          );
        }

        const { error } = await admin
          .from('platform_sales_territories')
          .delete()
          .eq('id', resourceId);

        if (error) {
          console.error('Error deleting territory:', error);
          return createCorsResponse({ error: 'Failed to delete territory' }, 500, req);
        }

        return createCorsResponse({ success: true, message: 'Territory deleted' }, 200, req);
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // GET /platform-crm/managers - Users a territory or rule can be assigned to
    //
    // PA-052: called by both platform CRM admin pages and served by nothing.
    // These are PLATFORM users (tenant_id null) at manager level or above -
    // level 4 in the roles table - plus anyone who can access all tenants.
    // NOTE users has first_name/last_name, NOT name (check:phantom-cols records
    // this as a repeat offender), so the display name is assembled here.
    if (req.method === 'GET' && endpoint === 'managers') {
      const { data, error } = await admin
        .from('users')
        .select(
          'id, email, first_name, last_name, roles!inner(name, level, can_access_all_tenants)',
        )
        .is('tenant_id', null)
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching platform managers:', error);
        return createCorsResponse({ error: 'Failed to fetch managers' }, 500, req);
      }

      const managers = (data || [])
        .filter((u: Row) => {
          const role = u.roles as Row | undefined;
          return (role?.level ?? 0) >= 4 || role?.can_access_all_tenants === true;
        })
        .map((u: Row) => ({
          id: u.id,
          // An account with neither name set is shown by email rather than as a
          // blank row nobody can pick.
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
          email: u.email,
          role: (u.roles as Row | undefined)?.name ?? null,
        }));

      return createCorsResponse(managers, 200, req);
    }

    // ─── Lead assignment rules (PA-052) ─────────────────────────────────────
    //
    // /platform-crm/assignment-rules and its /test and /toggle actions are
    // called by PlatformAssignmentRules.tsx, a routed page, and were served by
    // NOTHING - not this function, not Express. platform_lead_assignment_rules
    // has existed all along. The table is platform-level and carries no
    // tenant_id; the root-admin gate at the top of this function is the control.
    if (endpoint === 'assignment-rules') {
      if (req.method === 'GET' && !resourceId) {
        const { data, error } = await admin
          .from('platform_lead_assignment_rules')
          .select('*')
          .order('priority', { ascending: false })
          .order('rule_name', { ascending: true });

        if (error) {
          console.error('Error fetching assignment rules:', error);
          return createCorsResponse({ error: 'Failed to fetch assignment rules' }, 500, req);
        }

        return createCorsResponse(camelRows(data), 200, req);
      }

      if (req.method === 'GET' && resourceId && !parts[2]) {
        const { data, error } = await admin
          .from('platform_lead_assignment_rules')
          .select('*')
          .eq('id', resourceId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching assignment rule:', error);
          return createCorsResponse({ error: 'Failed to fetch assignment rule' }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Assignment rule not found' }, 404, req);

        return createCorsResponse(camelRow(data), 200, req);
      }

      if (req.method === 'POST' && !resourceId) {
        const body = await req.json().catch(() => ({}));
        const row = assignmentRuleWrite(body);

        if (!row.rule_name) {
          return createCorsResponse({ error: 'ruleName is required' }, 400, req);
        }

        const { data, error } = await admin
          .from('platform_lead_assignment_rules')
          .insert({ ...row, created_by: user.id })
          .select()
          .single();

        if (error) {
          console.error('Error creating assignment rule:', error);
          return createCorsResponse({ error: 'Failed to create assignment rule' }, 500, req);
        }

        return createCorsResponse(camelRow(data), 201, req);
      }

      if ((req.method === 'PUT' || req.method === 'PATCH') && resourceId && !parts[2]) {
        const body = await req.json().catch(() => ({}));
        const row = assignmentRuleWrite(body);

        const { data, error } = await admin
          .from('platform_lead_assignment_rules')
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq('id', resourceId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error updating assignment rule:', error);
          return createCorsResponse({ error: 'Failed to update assignment rule' }, 500, req);
        }
        if (!data) return createCorsResponse({ error: 'Assignment rule not found' }, 404, req);

        return createCorsResponse(camelRow(data), 200, req);
      }

      if (req.method === 'DELETE' && resourceId && !parts[2]) {
        const { error } = await admin
          .from('platform_lead_assignment_rules')
          .delete()
          .eq('id', resourceId);

        if (error) {
          console.error('Error deleting assignment rule:', error);
          return createCorsResponse({ error: 'Failed to delete assignment rule' }, 500, req);
        }

        return createCorsResponse({ success: true, message: 'Assignment rule deleted' }, 200, req);
      }

      // POST /assignment-rules/:id/toggle - flip is_active
      if (req.method === 'POST' && resourceId && parts[2] === 'toggle') {
        const body = await req.json().catch(() => ({}));

        const { data: existing, error: findError } = await admin
          .from('platform_lead_assignment_rules')
          .select('id, is_active')
          .eq('id', resourceId)
          .maybeSingle();

        if (findError) {
          console.error('Error loading assignment rule:', findError);
          return createCorsResponse({ error: 'Failed to load assignment rule' }, 500, req);
        }
        if (!existing) return createCorsResponse({ error: 'Assignment rule not found' }, 404, req);

        // The caller may state the target explicitly; otherwise flip what is
        // stored, so two rapid clicks cannot both send the same value.
        const isActive = body.isActive ?? body.is_active ?? !existing.is_active;

        const { data, error } = await admin
          .from('platform_lead_assignment_rules')
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', resourceId)
          .select()
          .single();

        if (error) {
          console.error('Error toggling assignment rule:', error);
          return createCorsResponse({ error: 'Failed to update rule status' }, 500, req);
        }

        return createCorsResponse(camelRow(data), 200, req);
      }

      // POST /assignment-rules/:id/test - how many records would this match?
      //
      // Counts against platform_business_records using only the criteria the
      // table actually stores. Criteria PostgREST cannot express are listed in
      // `unevaluated` rather than silently ignored, because "would match 40" is
      // a different claim if two of the five criteria were skipped.
      if (req.method === 'POST' && resourceId && parts[2] === 'test') {
        const { data: rule, error: findError } = await admin
          .from('platform_lead_assignment_rules')
          .select('*')
          .eq('id', resourceId)
          .maybeSingle();

        if (findError) {
          console.error('Error loading assignment rule:', findError);
          return createCorsResponse({ error: 'Failed to load assignment rule' }, 500, req);
        }
        if (!rule) return createCorsResponse({ error: 'Assignment rule not found' }, 404, req);

        let query = admin
          .from('platform_business_records')
          .select('id', { count: 'exact', head: true });

        const applied: string[] = [];
        const unevaluated: string[] = [];

        if (rule.lead_score_min !== null && rule.lead_score_min !== undefined) {
          query = query.gte('lead_score', rule.lead_score_min);
          applied.push(`leadScore >= ${rule.lead_score_min}`);
        }
        if (rule.lead_score_max !== null && rule.lead_score_max !== undefined) {
          query = query.lte('lead_score', rule.lead_score_max);
          applied.push(`leadScore <= ${rule.lead_score_max}`);
        }
        if (Array.isArray(rule.industries) && rule.industries.length) {
          query = query.in('industry', rule.industries);
          applied.push(`industry in (${rule.industries.join(', ')})`);
        }
        if (Array.isArray(rule.lead_source) && rule.lead_source.length) {
          query = query.in('lead_source', rule.lead_source);
          applied.push(`leadSource in (${rule.lead_source.join(', ')})`);
        }

        // company_size and geography are jsonb shapes with no single column to
        // compare against, and deal size lives on platform_deals, not here.
        if (Array.isArray(rule.company_size) && rule.company_size.length) {
          unevaluated.push('companySize (stored as jsonb with no matching column)');
        }
        if (rule.geography && Object.keys(rule.geography).length) {
          unevaluated.push('geography (stored as jsonb with no matching column)');
        }
        if (rule.deal_size_min !== null || rule.deal_size_max !== null) {
          unevaluated.push('dealSize (lives on platform_deals, not on the record)');
        }

        const { count, error } = await query;

        if (error) {
          console.error('Error testing assignment rule:', error);
          return createCorsResponse({ error: 'Failed to test assignment rule' }, 500, req);
        }

        return createCorsResponse(
          {
            matchCount: count ?? 0,
            criteriaApplied: applied,
            unevaluated,
            message:
              applied.length === 0
                ? 'This rule has no criteria this test can evaluate, so the count is every record.'
                : `Matched ${count ?? 0} record(s) on ${applied.length} criteri${applied.length === 1 ? 'on' : 'a'}.`,
          },
          200,
          req,
        );
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

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
