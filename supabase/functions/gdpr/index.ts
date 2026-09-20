// GDPR Edge Function
// Handles GDPR compliance operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';

// The consent_type and consent_source pg enums (shared/gdpr-core-schema.ts).
// Kept here because PostgREST rejects an unlisted value with a 500, and an
// unrecorded consent is the one outcome this endpoint must never produce
// quietly.
/** snake_case row -> the camelCase keys every consuming page reads. */
function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())] = value;
  }
  return out;
}

const CONSENT_TYPES = new Set([
  'marketing_email',
  'marketing_sms',
  'marketing_phone',
  'data_processing',
  'profiling',
  'analytics',
  'third_party_sharing',
  'newsletters',
  'product_updates',
  'transactional',
  'research',
  'automated_decisions',
  'recording',
]);

const CONSENT_SOURCES = new Set([
  'web_form',
  'email',
  'phone',
  'in_person',
  'api',
  'import',
  'contract',
  'legitimate_interest',
]);

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /gdpr, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'gdpr');
    const endpoint = parts[0];
    const requestId = parts[1];

    // GET /gdpr/requests - List GDPR requests
    if (req.method === 'GET' && endpoint === 'requests' && !requestId) {
      const status = url.searchParams.get('status');
      const type = url.searchParams.get('type');

      let query = admin
        .from('gdpr_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      // `type`, not request_type.
      if (type) query = query.eq('type', type);

      const { data: requests, error } = await query;

      if (error) {
        console.error('Error fetching GDPR requests:', error);
        return createCorsResponse({ error: 'Failed to fetch requests' }, 500, req);
      }

      return createCorsResponse(requests || [], 200, req);
    }

    // GET /gdpr/requests/:id - Get single request
    if (req.method === 'GET' && endpoint === 'requests' && requestId) {
      const { data: request, error } = await admin
        .from('gdpr_requests')
        .select('*')
        .eq('id', requestId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Request not found' }, 404, req);
      }

      return createCorsResponse(request, 200, req);
    }

    // POST /gdpr/requests - Create GDPR request
    if (req.method === 'POST' && endpoint === 'requests') {
      const body = await req.json();

      // COP-M01: request_type, subject_name and submitted_by are not columns.
      // gdpr_requests uses type, requestor_id, and has no name field — the
      // subject is identified by subject_email / subject_id.
      const requestData = {
        tenant_id: tenantId,
        type: body.requestType || body.request_type, // 'access', 'deletion', 'portability', 'rectification'
        subject_email: body.subjectEmail || body.subject_email,
        subject_id: body.subjectId || body.subject_id || null,
        description: body.description,
        status: 'pending',
        requestor_id: user.id,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: request, error } = await admin
        .from('gdpr_requests')
        .insert(requestData)
        .select()
        .single();

      if (error) {
        console.error('Error creating GDPR request:', error);
        return createCorsResponse({ error: 'Failed to create request' }, 500, req);
      }

      return createCorsResponse(request, 201, req);
    }

    // PUT /gdpr/requests/:id - Update request status
    if (req.method === 'PUT' && endpoint === 'requests' && requestId) {
      const body = await req.json();

      const { data: request, error } = await admin
        .from('gdpr_requests')
        // notes / completed_at / completed_by are not columns; the real ones are
        // processing_notes, completion_date and approved_by.
        .update({
          status: body.status,
          processing_notes: body.notes ?? body.processingNotes ?? null,
          completion_date: body.status === 'completed' ? new Date().toISOString() : null,
          approved_by: body.status === 'completed' ? user.id : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update request' }, 500, req);
      }

      return createCorsResponse(request, 200, req);
    }

    // POST /gdpr/data-export - Export user data
    if (req.method === 'POST' && endpoint === 'data-export') {
      const body = await req.json();
      const subjectEmail = body.email || body.subjectEmail;

      if (!subjectEmail) {
        return createCorsResponse({ error: 'email is required' }, 400, req);
      }

      // COP-M01: the same two faults as the erasure path below — this read a
      // `contacts` table that is in no Drizzle schema (the canonical one is
      // company_contacts) and filtered business_records on an `email` column it
      // does not have (primary_contact_email). Both queries returned nothing, so
      // a subject access request exported an empty file and reported success.
      const collectionErrors: string[] = [];

      const { data: contacts, error: contactsError } = await admin
        .from('company_contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('email', subjectEmail);
      if (contactsError) collectionErrors.push(`company_contacts: ${contactsError.message}`);

      const { data: businessRecords, error: recordsError } = await admin
        .from('business_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('primary_contact_email', subjectEmail);
      if (recordsError) collectionErrors.push(`business_records: ${recordsError.message}`);

      const { data: activities, error: activitiesError } = await admin
        .from('activities')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_email', subjectEmail);
      if (activitiesError) collectionErrors.push(`activities: ${activitiesError.message}`);

      // An export that silently omits a source is a failed subject access
      // request, not a partial one.
      if (collectionErrors.length > 0) {
        console.error('GDPR export incomplete:', collectionErrors);
        return createCorsResponse(
          {
            error: 'Export did not complete; it would be missing data the subject is entitled to.',
            code: 'EXPORT_INCOMPLETE',
            failures: collectionErrors,
          },
          500,
          req,
        );
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        subjectEmail,
        contacts: contacts || [],
        businessRecords: businessRecords || [],
        activities: activities || [],
      };

      // Log the export
      await admin.from('gdpr_audit_log').insert({
        tenant_id: tenantId,
        action: 'data_export',
        subject_email: subjectEmail,
        performed_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(exportData, 200, req);
    }

    // POST /gdpr/data-deletion - Delete user data
    if (req.method === 'POST' && endpoint === 'data-deletion') {
      const body = await req.json();
      const subjectEmail = body.email || body.subjectEmail;

      if (!subjectEmail) {
        return createCorsResponse({ error: 'email is required' }, 400, req);
      }

      // COP-M01: THIS ENDPOINT REPORTED SUCCESS WITHOUT ERASING ANYTHING.
      // It wrote `email` and `contact_name` to business_records — the columns
      // are primary_contact_email and primary_contact_name — and filtered on the
      // same absent `email` column, so the update matched nothing and returned
      // 42703. Nothing checked the error, and the handler answered
      // "User data has been anonymized". It also targeted a `contacts` table
      // that is in no Drizzle schema; the canonical contact table is
      // company_contacts (docs/crm-canonical-model.md).
      //
      // A data-subject erasure that silently does nothing is worse than one that
      // fails, so every write below is checked and the response says what was
      // actually anonymized.
      const anonymizedEmail = `deleted-${Date.now()}@anonymized.local`;
      const now = new Date().toISOString();
      const failures: string[] = [];

      const { data: anonymizedContacts, error: contactsError } = await admin
        .from('company_contacts')
        .update({
          email: anonymizedEmail,
          first_name: 'DELETED',
          last_name: 'USER',
          phone: null,
          mobile: null,
          updated_at: now,
        })
        .eq('tenant_id', tenantId)
        .eq('email', subjectEmail)
        .select('id');

      if (contactsError) {
        console.error('GDPR erasure failed for company_contacts:', contactsError);
        failures.push(`company_contacts: ${contactsError.message}`);
      }

      const { data: anonymizedRecords, error: recordsError } = await admin
        .from('business_records')
        .update({
          primary_contact_email: anonymizedEmail,
          primary_contact_name: 'DELETED USER',
          primary_contact_phone: null,
          updated_at: now,
        })
        .eq('tenant_id', tenantId)
        .eq('primary_contact_email', subjectEmail)
        .select('id');

      if (recordsError) {
        console.error('GDPR erasure failed for business_records:', recordsError);
        failures.push(`business_records: ${recordsError.message}`);
      }

      if (failures.length > 0) {
        return createCorsResponse(
          {
            error: 'Erasure did not complete; no success may be reported to the data subject.',
            code: 'ERASURE_INCOMPLETE',
            failures,
          },
          500,
          req,
        );
      }

      // Log the deletion
      await admin.from('gdpr_audit_log').insert({
        tenant_id: tenantId,
        action: 'data_deletion',
        subject_email: subjectEmail,
        performed_by: user.id,
        created_at: now,
      });

      return createCorsResponse(
        {
          success: true,
          message: 'User data has been anonymized',
          affectedEmail: subjectEmail,
          anonymized: {
            companyContacts: anonymizedContacts?.length ?? 0,
            businessRecords: anonymizedRecords?.length ?? 0,
          },
        },
        200,
        req,
      );
    }

    // GET /gdpr/audit-log - Get GDPR audit log
    if (req.method === 'GET' && endpoint === 'audit-log') {
      const { data: logs } = await admin
        .from('gdpr_audit_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      return createCorsResponse(logs || [], 200, req);
    }

    // GET /gdpr/consent-records - Get consent records
    if (req.method === 'GET' && endpoint === 'consent-records') {
      const email = url.searchParams.get('email');

      let query = admin
        .from('consent_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (email) query = query.eq('subject_email', email);

      const { data: consents } = await query.limit(100);

      return createCorsResponse(consents || [], 200, req);
    }

    // POST /gdpr/consent - Record consent
    if (req.method === 'POST' && endpoint === 'consent') {
      const body = await req.json();

      // COP-M01: this wrote a `consented` boolean, which is not a column — the
      // record carries a `status` enum (given/withdrawn/expired/pending) and a
      // given_at timestamp. It also dropped subject_type, subject_id and source,
      // all NOT NULL, even though CookieConsent.tsx sends every one of them. So
      // no consent was ever recorded in production while the banner told the
      // visitor it had been.
      const subjectId = body.subjectId || body.subject_id;
      const consentType = body.consentType || body.consent_type;

      if (!consentType) {
        return createCorsResponse({ error: 'consentType is required' }, 400, req);
      }
      // consent_type is a pg ENUM. An unlisted value is a 500 from the database
      // and, worse, an unrecorded consent — so say which value is unsupported
      // instead. CookieConsent.tsx currently sends cookie_analytics /
      // cookie_preferences / cookie_marketing, and only the analytics one has an
      // equivalent here; deciding what the other two map to is a compliance
      // question for whoever owns the consent taxonomy, not something to guess.
      if (!CONSENT_TYPES.has(consentType)) {
        return createCorsResponse(
          {
            error: `Unsupported consentType '${consentType}'.`,
            code: 'UNSUPPORTED_CONSENT_TYPE',
            supported: [...CONSENT_TYPES],
          },
          400,
          req,
        );
      }
      if (!subjectId) {
        return createCorsResponse({ error: 'subjectId is required' }, 400, req);
      }

      // Same rule the Express handler enforces (server/routes-gdpr.ts): a
      // non-admin may only record consent for themselves.
      const isPlatformAdmin =
        user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
      if (subjectId !== user.id && !isPlatformAdmin) {
        return createCorsResponse(
          {
            error:
              'You can only manage your own consent. Admin privileges required for other users.',
          },
          403,
          req,
        );
      }

      const withdrawn = body.consented === false || body.status === 'withdrawn';
      const nowIso = new Date().toISOString();

      const { data: consent, error } = await admin
        .from('consent_records')
        .insert({
          tenant_id: tenantId,
          subject_type: body.subjectType || body.subject_type || 'user',
          subject_id: subjectId,
          subject_email: body.subjectEmail || body.subject_email || body.email,
          consent_type: consentType,
          status: withdrawn ? 'withdrawn' : 'given',
          legal_basis: body.legalBasis || body.legal_basis || 'consent',
          // consent_source is an enum too, but this one is safe to coerce: a
          // banner tick IS a web form. The caller's own label is preserved in
          // source_details rather than dropped.
          source: CONSENT_SOURCES.has(body.source) ? body.source : 'web_form',
          source_details: body.sourceDetails || body.source_details || body.source || null,
          consent_text: body.consentText || body.consent_text || null,
          version: body.version ? String(body.version) : null,
          ip_address: body.ipAddress || body.ip_address || null,
          user_agent: body.userAgent || body.user_agent || null,
          given_at: withdrawn ? null : nowIso,
          withdrawn_at: withdrawn ? nowIso : null,
          created_by: user.id,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select()
        .single();

      if (error) {
        console.error('Error recording consent:', error);
        return createCorsResponse(
          { error: 'Failed to record consent', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(consent, 201, req);
    }

    // ─── Compliance dashboard stats (EDGE-002h) ─────────────────────────────
    //
    // GdprComplianceDashboard.tsx calls /dpa/stats and /deduplication/stats.
    // Neither existed on the edge function OR on Express, so both 404'd on both
    // backends - a feature rather than a port. Both are computable: the tables
    // are already there and carry what the cards read.
    //
    // Note the routing: these are two-segment paths, so they match on
    // endpoint + requestId, where requestId happens to be the sub-resource.

    /**
     * GET /gdpr/consent/stats
     *
     * The GDPR compliance dashboard's four cards go through one QueryStates
     * wrapper, so ANY of them failing renders "Could not load compliance data"
     * over the whole page - and this endpoint and /data-export/requests below
     * existed only on Express, which does not serve /api/gdpr in production
     * (the prefix is not proxied). So the entire dashboard was an error state
     * on the deployed host while working on every developer machine.
     *
     * Counted with head:true rather than fetched, because a tenant's consent
     * ledger grows with every cookie banner acceptance and the cards need four
     * numbers, not the rows. The per-status and per-type breakdowns DO need the
     * rows - PostgREST has no GROUP BY - but only those two columns.
     */
    if (req.method === 'GET' && endpoint === 'consent' && requestId === 'stats') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [{ count: totalRecords }, groupRows, { count: recentWithdrawals }] = await Promise.all([
        admin
          .from('consent_records')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        fetchAllRows<{ status: string | null; consent_type: string | null }>((from, to) =>
          admin
            .from('consent_records')
            .select('status, consent_type')
            .eq('tenant_id', tenantId)
            .range(from, to),
        ),
        admin
          .from('consent_records')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'withdrawn')
          .gte('withdrawn_at', thirtyDaysAgo),
      ]);

      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      for (const row of groupRows) {
        const status = String(row.status ?? 'unknown');
        const type = String(row.consent_type ?? 'unknown');
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        byType[type] = (byType[type] ?? 0) + 1;
      }

      return createCorsResponse(
        {
          totalRecords: totalRecords ?? 0,
          byStatus,
          byType,
          recentWithdrawals: recentWithdrawals ?? 0,
        },
        200,
        req,
      );
    }

    /**
     * GET /gdpr/data-export/requests[?status=&subjectId=&page=&limit=]
     *
     * Rows go out CAMELISED: the dashboard reads exp.exportNumber,
     * exp.subjectType and exp.format straight off each row, so raw PostgREST
     * snake_case renders a list of blank entries with a status badge - which on
     * this page reads as "requests exist but say nothing" rather than as a bug.
     */
    if (req.method === 'GET' && endpoint === 'data-export' && requestId === 'requests') {
      const status = url.searchParams.get('status');
      const subjectId = url.searchParams.get('subjectId');
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '25') || 25));
      const offset = (page - 1) * limit;

      let query = admin
        .from('personal_data_exports')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);
      if (status) query = query.eq('status', status);
      if (subjectId) query = query.eq('subject_id', subjectId);

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error listing data export requests:', error);
        return createCorsResponse({ error: 'Failed to list data export requests' }, 500, req);
      }

      return createCorsResponse(
        { exports: (data ?? []).map(toCamel), total: count ?? 0 },
        200,
        req,
      );
    }

    // GET /gdpr/dpa/stats
    if (req.method === 'GET' && endpoint === 'dpa' && requestId === 'stats') {
      const { data: agreements, error } = await admin
        .from('data_processing_agreements')
        .select('status, expiration_date')
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error fetching DPA stats:', error);
        return createCorsResponse({ error: 'Failed to fetch DPA statistics' }, 500, req);
      }

      const rows = agreements ?? [];
      const byStatus: Record<string, number> = {};
      for (const row of rows) {
        const status = String((row as any).status ?? 'unknown');
        byStatus[status] = (byStatus[status] ?? 0) + 1;
      }

      // The card reads `expiringIn30Days` and is LABELLED "expiring in 30
      // days"; this answered `expiringIn` over a NINETY-day window, so the
      // number the page wanted was never sent (permanently 0) and the number
      // sent described a different question. Both halves are fixed here: the
      // key the card reads, over the window the card names. The 90-day
      // renewal-reminder horizon stays beside it, named for what it is.
      const now = Date.now();
      const windowEnd = (days: number) => now + days * 24 * 60 * 60 * 1000;
      const expiringWithin = (days: number) =>
        rows.filter((r: any) => {
          if (!r.expiration_date) return false;
          const at = new Date(r.expiration_date).getTime();
          return at >= now && at <= windowEnd(days);
        }).length;
      const expiringIn30Days = expiringWithin(30);
      const expiringIn90Days = expiringWithin(90);

      // Compliance checks that have not been signed off yet.
      const { count: pendingCompliance } = await admin
        .from('dpa_compliance_checks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('approval_date', null);

      return createCorsResponse(
        {
          totalDpas: rows.length,
          byStatus,
          expiringIn30Days,
          expiringIn90Days,
          pendingCompliance: pendingCompliance ?? 0,
        },
        200,
        req,
      );
    }

    // GET /gdpr/deduplication/stats
    if (req.method === 'GET' && endpoint === 'deduplication' && requestId === 'stats') {
      const countOf = async (
        client: typeof admin,
        table: string,
        apply: (q: any) => any,
      ): Promise<number> => {
        const { count } = await apply(
          client.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        );
        return count ?? 0;
      };

      const [totalMatches, pendingMatches, mergedRecords] = await Promise.all([
        countOf(admin, 'duplicate_matches', (q) => q),
        countOf(admin, 'duplicate_matches', (q) => q.eq('status', 'pending')),
        // A merge is recorded by merged_record_id being set, not by a status
        // value, so this counts the rows that actually resulted in one.
        countOf(admin, 'duplicate_matches', (q) => q.not('merged_record_id', 'is', null)),
      ]);

      return createCorsResponse({ totalMatches, pendingMatches, mergedRecords }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in gdpr function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
