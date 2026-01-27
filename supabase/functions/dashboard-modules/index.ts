// Dashboard Modules Edge Function
// Handles modular dashboard configuration
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

    // GET /dashboard/modules - Get available dashboard modules
    if (req.method === 'GET') {
      const modules = [
        {
          id: 'sales_pipeline',
          name: 'Sales Pipeline',
          description: 'View and manage sales pipeline',
          icon: 'trending-up',
          category: 'sales',
          defaultEnabled: true,
        },
        {
          id: 'leads_overview',
          name: 'Leads Overview',
          description: 'Track lead status and conversion',
          icon: 'users',
          category: 'sales',
          defaultEnabled: true,
        },
        {
          id: 'tasks_today',
          name: "Today's Tasks",
          description: 'View tasks due today',
          icon: 'check-square',
          category: 'productivity',
          defaultEnabled: true,
        },
        {
          id: 'appointments_calendar',
          name: 'Appointments',
          description: 'Upcoming appointments calendar',
          icon: 'calendar',
          category: 'productivity',
          defaultEnabled: true,
        },
        {
          id: 'revenue_metrics',
          name: 'Revenue Metrics',
          description: 'Monthly and quarterly revenue',
          icon: 'dollar-sign',
          category: 'finance',
          defaultEnabled: true,
        },
        {
          id: 'customer_health',
          name: 'Customer Health',
          description: 'Customer satisfaction scores',
          icon: 'heart',
          category: 'service',
          defaultEnabled: false,
        },
        {
          id: 'service_tickets',
          name: 'Service Tickets',
          description: 'Open service ticket summary',
          icon: 'ticket',
          category: 'service',
          defaultEnabled: false,
        },
        {
          id: 'equipment_alerts',
          name: 'Equipment Alerts',
          description: 'Equipment requiring attention',
          icon: 'alert-triangle',
          category: 'service',
          defaultEnabled: false,
        },
        {
          id: 'team_performance',
          name: 'Team Performance',
          description: 'Team metrics and goals',
          icon: 'award',
          category: 'management',
          defaultEnabled: false,
        },
        {
          id: 'recent_activity',
          name: 'Recent Activity',
          description: 'Latest system activities',
          icon: 'activity',
          category: 'general',
          defaultEnabled: true,
        },
      ];

      // Get user's enabled modules
      const { data: userConfig } = await admin
        .from('dashboard_configs')
        .select('enabled_modules, layout')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      const enabledModules =
        userConfig?.enabled_modules || modules.filter((m) => m.defaultEnabled).map((m) => m.id);

      return createCorsResponse(
        {
          modules,
          enabledModules,
          layout: userConfig?.layout || 'grid',
        },
        200,
        req,
      );
    }

    // PUT /dashboard/modules - Update enabled modules
    if (req.method === 'PUT') {
      const body = await req.json();

      const { data: config, error } = await admin
        .from('dashboard_configs')
        .upsert(
          {
            user_id: user.id,
            tenant_id: tenantId,
            enabled_modules: body.enabledModules || body.enabled_modules,
            layout: body.layout,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,tenant_id',
          },
        )
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update dashboard config' }, 500, req);
      }

      return createCorsResponse(config, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in dashboard-modules function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
