// GDPR Edge Function
// Handles GDPR compliance operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1];
    const requestId = pathParts[2];

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
    if (req.method === 'POST' && endpoint === 'data-export') {
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
    if (req.method === 'POST' && endpoint === 'consent') {
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
