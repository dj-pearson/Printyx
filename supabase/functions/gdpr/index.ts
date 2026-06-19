// GDPR Edge Function
// Handles GDPR compliance operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Coolify-safe routing: parts[0] = endpoint, parts[1] = sub/requestId
    const { parts } = normalizePath(url.pathname, 'gdpr');
    const endpoint = parts[0];
    const requestId = parts[1];

    // ========================================================================
    // STATS / DASHBOARD ROUTES (two-segment, named — handle before catch-alls)
    // ========================================================================

    // GET /gdpr/consent/stats - Consent statistics for the dashboard
    if (req.method === 'GET' && endpoint === 'consent' && requestId === 'stats') {
      const { data: records, error } = await admin
        .from('consent_records')
        .select('status, consent_type, withdrawn_at')
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse(
          {
            totalRecords: 0,
            byStatus: {},
            byType: {},
            recentWithdrawals: 0,
            degraded: true,
          },
          200,
          req,
        );
      }

      const rows = (records || []) as any[];
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      let recentWithdrawals = 0;

      for (const r of rows) {
        if (r.status) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        if (r.consent_type) byType[r.consent_type] = (byType[r.consent_type] || 0) + 1;
        if (r.withdrawn_at && new Date(r.withdrawn_at).getTime() >= thirtyDaysAgo) {
          recentWithdrawals += 1;
        }
      }

      return createCorsResponse(
        {
          totalRecords: rows.length,
          byStatus,
          byType,
          recentWithdrawals,
        },
        200,
        req,
      );
    }

    // GET /gdpr/dpa/stats - Data Processing Agreement statistics
    if (req.method === 'GET' && endpoint === 'dpa' && requestId === 'stats') {
      const { data: dpas, error } = await admin
        .from('data_processing_agreements')
        .select('status, expiration_date')
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse(
          {
            totalDpas: 0,
            byStatus: {},
            expiringIn30Days: 0,
            pendingCompliance: 0,
            degraded: true,
          },
          200,
          req,
        );
      }

      const rows = (dpas || []) as any[];
      const byStatus: Record<string, number> = {};
      const now = Date.now();
      const in30Days = now + 30 * 24 * 60 * 60 * 1000;
      let expiringIn30Days = 0;

      for (const r of rows) {
        if (r.status) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        if (r.expiration_date) {
          const exp = new Date(r.expiration_date).getTime();
          if (exp >= now && exp <= in30Days) expiringIn30Days += 1;
        }
      }

      // Pending compliance: count DPA compliance checks awaiting review (degrade-tolerant)
      let pendingCompliance = 0;
      const { count: pendingCount, error: checkError } = await admin
        .from('dpa_compliance_checks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');
      if (!checkError) pendingCompliance = pendingCount || 0;

      return createCorsResponse(
        {
          totalDpas: rows.length,
          byStatus,
          expiringIn30Days,
          pendingCompliance,
        },
        200,
        req,
      );
    }

    // GET /gdpr/deduplication/stats - Contact deduplication statistics
    if (req.method === 'GET' && endpoint === 'deduplication' && requestId === 'stats') {
      const { data: matches, error } = await admin
        .from('duplicate_matches')
        .select('status')
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse(
          {
            totalMatches: 0,
            pendingMatches: 0,
            mergedRecords: 0,
            byStatus: {},
            degraded: true,
          },
          200,
          req,
        );
      }

      const rows = (matches || []) as any[];
      const byStatus: Record<string, number> = {};
      let pendingMatches = 0;
      let mergedRecords = 0;
      for (const r of rows) {
        if (r.status) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        if (r.status === 'pending' || r.status === 'reviewing') pendingMatches += 1;
        if (r.status === 'merged' || r.status === 'auto_merged') mergedRecords += 1;
      }

      return createCorsResponse(
        {
          totalMatches: rows.length,
          pendingMatches,
          mergedRecords,
          byStatus,
        },
        200,
        req,
      );
    }

    // GET /gdpr/data-export/requests - Personal data export requests (?status=pending)
    if (req.method === 'GET' && endpoint === 'data-export' && requestId === 'requests') {
      const status = url.searchParams.get('status');

      let query = admin
        .from('personal_data_exports')
        .select(
          'id, export_number, subject_type, subject_id, subject_email, format, status, progress, requested_by, created_at',
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (status) query = query.eq('status', status);

      const { data: exports, error } = await query;

      if (error) {
        return createCorsResponse({ exports: [], total: 0, degraded: true }, 200, req);
      }

      const camelized = ((exports || []) as any[]).map((e: any) => ({
        id: e.id,
        exportNumber: e.export_number,
        subjectType: e.subject_type,
        subjectId: e.subject_id,
        subjectEmail: e.subject_email,
        format: e.format,
        status: e.status,
        progress: e.progress,
        requestedBy: e.requested_by,
        createdAt: e.created_at,
      }));

      return createCorsResponse({ exports: camelized, total: camelized.length }, 200, req);
    }

    // ========================================================================
    // EXISTING ROUTES (migrated to normalizePath)
    // ========================================================================

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
      if (type) query = query.eq('request_type', type);

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

      const requestData = {
        tenant_id: tenantId,
        request_type: body.requestType || body.request_type, // 'access', 'deletion', 'portability', 'rectification'
        subject_email: body.subjectEmail || body.subject_email,
        subject_name: body.subjectName || body.subject_name,
        description: body.description,
        status: 'pending',
        submitted_by: user.id,
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
        .update({
          status: body.status,
          notes: body.notes,
          completed_at: body.status === 'completed' ? new Date().toISOString() : null,
          completed_by: body.status === 'completed' ? user.id : null,
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
    if (req.method === 'POST' && endpoint === 'data-export' && !requestId) {
      const body = await req.json();
      const subjectEmail = body.email || body.subjectEmail;

      // Collect data from various tables
      const { data: contacts } = await admin
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('email', subjectEmail);

      const { data: businessRecords } = await admin
        .from('business_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('email', subjectEmail);

      const { data: activities } = await admin
        .from('activities')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_email', subjectEmail);

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

      // Anonymize rather than delete to preserve referential integrity
      const anonymizedEmail = `deleted-${Date.now()}@anonymized.local`;

      await admin
        .from('contacts')
        .update({
          email: anonymizedEmail,
          first_name: 'DELETED',
          last_name: 'USER',
          phone: null,
          notes: 'Data deleted per GDPR request',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('email', subjectEmail);

      await admin
        .from('business_records')
        .update({
          email: anonymizedEmail,
          contact_name: 'DELETED USER',
          phone: null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('email', subjectEmail);

      // Log the deletion
      await admin.from('gdpr_audit_log').insert({
        tenant_id: tenantId,
        action: 'data_deletion',
        subject_email: subjectEmail,
        performed_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(
        {
          success: true,
          message: 'User data has been anonymized',
          affectedEmail: subjectEmail,
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
    if (req.method === 'POST' && endpoint === 'consent' && !requestId) {
      const body = await req.json();

      const { data: consent, error } = await admin
        .from('consent_records')
        .insert({
          tenant_id: tenantId,
          subject_email: body.email || body.subject_email,
          consent_type: body.consentType || body.consent_type,
          consented: body.consented,
          ip_address: body.ipAddress || body.ip_address,
          user_agent: body.userAgent || body.user_agent,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record consent' }, 500, req);
      }

      return createCorsResponse(consent, 201, req);
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
