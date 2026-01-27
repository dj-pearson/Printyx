// Audit Log Edge Function
// Handles audit logging and retrieval
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

    // GET /audit-log - Get audit logs
    if (req.method === 'GET' && !endpoint) {
      const entityType = url.searchParams.get('entityType');
      const entityId = url.searchParams.get('entityId');
      const userId = url.searchParams.get('userId');
      const action = url.searchParams.get('action');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      if (userId) query = query.eq('user_id', userId);
      if (action) query = query.eq('action', action);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data: logs, count, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return createCorsResponse({ error: 'Failed to fetch audit logs' }, 500, req);
      }

      return createCorsResponse(
        {
          logs: logs || [],
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

    // GET /audit-log/entity/:type/:id - Get logs for specific entity
    if (req.method === 'GET' && endpoint === 'entity') {
      const entityType = pathParts[2];
      const entityId = pathParts[3];

      const { data: logs, error } = await admin
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch entity audit logs' }, 500, req);
      }

      return createCorsResponse(logs || [], 200, req);
    }

    // GET /audit-log/user/:userId - Get logs by user
    if (req.method === 'GET' && endpoint === 'user') {
      const targetUserId = pathParts[2];

      const { data: logs, error } = await admin
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch user audit logs' }, 500, req);
      }

      return createCorsResponse(logs || [], 200, req);
    }

    // GET /audit-log/actions - Get available action types
    if (req.method === 'GET' && endpoint === 'actions') {
      const { data: logs } = await admin
        .from('audit_logs')
        .select('action')
        .eq('tenant_id', tenantId);

      const actions = [...new Set((logs || []).map((l: any) => l.action))].sort();

      return createCorsResponse(actions, 200, req);
    }

    // GET /audit-log/entity-types - Get available entity types
    if (req.method === 'GET' && endpoint === 'entity-types') {
      const { data: logs } = await admin
        .from('audit_logs')
        .select('entity_type')
        .eq('tenant_id', tenantId);

      const types = [...new Set((logs || []).map((l: any) => l.entity_type))].sort();

      return createCorsResponse(types, 200, req);
    }

    // POST /audit-log - Create audit log entry
    if (req.method === 'POST' && !endpoint) {
      const body = await req.json();

      const logData = {
        tenant_id: tenantId,
        user_id: user.id,
        action: body.action,
        entity_type: body.entityType || body.entity_type,
        entity_id: body.entityId || body.entity_id,
        entity_name: body.entityName || body.entity_name,
        old_values: body.oldValues || body.old_values,
        new_values: body.newValues || body.new_values,
        ip_address: body.ipAddress || body.ip_address || req.headers.get('x-forwarded-for'),
        user_agent: body.userAgent || body.user_agent || req.headers.get('user-agent'),
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
      };

      const { data: log, error } = await admin.from('audit_logs').insert(logData).select().single();

      if (error) {
        console.error('Error creating audit log:', error);
        return createCorsResponse({ error: 'Failed to create audit log' }, 500, req);
      }

      return createCorsResponse(log, 201, req);
    }

    // GET /audit-log/summary - Get audit summary stats
    if (req.method === 'GET' && endpoint === 'summary') {
      const days = parseInt(url.searchParams.get('days') || '30');
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const { data: logs } = await admin
        .from('audit_logs')
        .select('action, entity_type, user_id, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString());

      // Group by action
      const byAction = new Map<string, number>();
      (logs || []).forEach((l: any) => {
        byAction.set(l.action, (byAction.get(l.action) || 0) + 1);
      });

      // Group by entity type
      const byEntityType = new Map<string, number>();
      (logs || []).forEach((l: any) => {
        byEntityType.set(l.entity_type, (byEntityType.get(l.entity_type) || 0) + 1);
      });

      // Group by user
      const byUser = new Map<string, number>();
      (logs || []).forEach((l: any) => {
        byUser.set(l.user_id, (byUser.get(l.user_id) || 0) + 1);
      });

      // Group by day
      const byDay = new Map<string, number>();
      (logs || []).forEach((l: any) => {
        const day = l.created_at.split('T')[0];
        byDay.set(day, (byDay.get(day) || 0) + 1);
      });

      return createCorsResponse(
        {
          totalEvents: logs?.length || 0,
          byAction: Array.from(byAction.entries()).map(([action, count]) => ({ action, count })),
          byEntityType: Array.from(byEntityType.entries()).map(([type, count]) => ({
            type,
            count,
          })),
          topUsers: Array.from(byUser.entries())
            .map(([userId, count]) => ({ userId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
          byDay: Array.from(byDay.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
        200,
        req,
      );
    }

    // POST /audit-log/export - Export audit logs
    if (req.method === 'POST' && endpoint === 'export') {
      const body = await req.json();

      let query = admin
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (body.startDate) query = query.gte('created_at', body.startDate);
      if (body.endDate) query = query.lte('created_at', body.endDate);
      if (body.entityType) query = query.eq('entity_type', body.entityType);
      if (body.action) query = query.eq('action', body.action);

      const { data: logs } = await query.limit(10000);

      // In production, this might generate a CSV file or queue a background job
      return createCorsResponse(
        {
          exportedCount: logs?.length || 0,
          data: logs || [],
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in audit-log function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
