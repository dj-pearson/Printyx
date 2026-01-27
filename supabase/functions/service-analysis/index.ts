// Service Analysis Edge Function
// Handles service ticket analysis and parts ordering
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
    const resource = pathParts[1]; // analysis ID or 'stats', 'recent'
    const subResource = pathParts[2];

    // GET /service-analysis/stats - Get analysis statistics
    if (req.method === 'GET' && resource === 'stats') {
      const { data: analyses } = await admin
        .from('service_analyses')
        .select('status, resolution_type')
        .eq('tenant_id', tenantId);

      const byStatus: Record<string, number> = {};
      const byResolutionType: Record<string, number> = {};

      (analyses || []).forEach((a: any) => {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
        if (a.resolution_type) {
          byResolutionType[a.resolution_type] = (byResolutionType[a.resolution_type] || 0) + 1;
        }
      });

      return createCorsResponse(
        {
          total: analyses?.length || 0,
          byStatus,
          byResolutionType,
        },
        200,
        req,
      );
    }

    // GET /service-analysis/recent - Get recent analyses
    if (req.method === 'GET' && resource === 'recent') {
      const { data: analyses, error } = await admin
        .from('service_analyses')
        .select(
          `
          *,
          ticket:ticket_id (id, title)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch recent analyses' }, 500, req);
      }

      return createCorsResponse(analyses || [], 200, req);
    }

    // GET /service-analysis/:analysisId - Get single analysis
    if (
      req.method === 'GET' &&
      resource &&
      !subResource &&
      resource !== 'stats' &&
      resource !== 'recent'
    ) {
      const { data: analysis, error } = await admin
        .from('service_analyses')
        .select(
          `
          *,
          ticket:ticket_id (*)
        `,
        )
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Service analysis not found' }, 404, req);
      }

      return createCorsResponse(analysis, 200, req);
    }

    // POST /service-tickets/:ticketId/analysis - Create analysis for ticket
    if (req.method === 'POST' && resource && !subResource) {
      const body = await req.json();

      const { data: analysis, error } = await admin
        .from('service_analyses')
        .insert({
          tenant_id: tenantId,
          ticket_id: body.ticketId || body.ticket_id || resource,
          diagnosis: body.diagnosis,
          root_cause: body.rootCause || body.root_cause,
          resolution_type: body.resolutionType || body.resolution_type,
          recommended_actions: body.recommendedActions || body.recommended_actions || [],
          parts_needed: body.partsNeeded || body.parts_needed || [],
          estimated_time: body.estimatedTime || body.estimated_time,
          status: body.status || 'pending',
          analyzed_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create service analysis' }, 500, req);
      }

      return createCorsResponse(analysis, 201, req);
    }

    // PUT /service-analysis/:id - Update analysis
    if (req.method === 'PUT' && resource && !subResource) {
      const body = await req.json();

      const { data: analysis, error } = await admin
        .from('service_analyses')
        .update({
          diagnosis: body.diagnosis,
          root_cause: body.rootCause || body.root_cause,
          resolution_type: body.resolutionType || body.resolution_type,
          recommended_actions: body.recommendedActions || body.recommended_actions,
          parts_needed: body.partsNeeded || body.parts_needed,
          estimated_time: body.estimatedTime || body.estimated_time,
          status: body.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update service analysis' }, 500, req);
      }

      return createCorsResponse(analysis, 200, req);
    }

    // GET /service-analysis/:analysisId/parts-used - Get parts used
    if (req.method === 'GET' && resource && subResource === 'parts-used') {
      const { data: parts, error } = await admin
        .from('service_analysis_parts')
        .select('*')
        .eq('analysis_id', resource)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch parts used' }, 500, req);
      }

      return createCorsResponse(parts || [], 200, req);
    }

    // POST /service-analysis/:analysisId/parts-used - Add part used
    if (req.method === 'POST' && resource && subResource === 'parts-used') {
      const body = await req.json();

      const { data: part, error } = await admin
        .from('service_analysis_parts')
        .insert({
          tenant_id: tenantId,
          analysis_id: resource,
          part_id: body.partId || body.part_id,
          part_number: body.partNumber || body.part_number,
          quantity: body.quantity || 1,
          cost: body.cost,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add part used' }, 500, req);
      }

      return createCorsResponse(part, 201, req);
    }

    // POST /service-analysis/:analysisId/parts-order - Create parts order
    if (req.method === 'POST' && resource && subResource === 'parts-order') {
      const body = await req.json();

      const { data: order, error } = await admin
        .from('parts_orders')
        .insert({
          tenant_id: tenantId,
          analysis_id: resource,
          parts: body.parts || [],
          vendor_id: body.vendorId || body.vendor_id,
          status: 'pending',
          total_cost: body.totalCost || body.total_cost,
          ordered_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create parts order' }, 500, req);
      }

      return createCorsResponse(order, 201, req);
    }

    // GET /service-analysis/:analysisId/parts-orders - Get parts orders
    if (req.method === 'GET' && resource && subResource === 'parts-orders') {
      const { data: orders, error } = await admin
        .from('parts_orders')
        .select('*')
        .eq('analysis_id', resource)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch parts orders' }, 500, req);
      }

      return createCorsResponse(orders || [], 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in service-analysis function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
