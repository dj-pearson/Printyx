// Service Analysis Edge Function
// Handles service ticket analysis and parts ordering
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { toCamelShallow } from '../_shared/case.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { buildAnalysisRow } from '../_shared/service-call-analysis.ts';

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
    // /service-analysis, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'service-analysis');
    const resource = parts[0]; // analysis ID or 'stats', 'recent'
    const subResource = parts[1];

    // Round 163. Every branch from here to parts-order read or wrote
    // `service_analyses` or `service_analysis_parts`, neither of which is in any
    // schema or migration - the real tables are service_call_analysis and
    // service_parts_used. Stats also counted `status` and `resolution_type`,
    // which service_call_analysis does not have; its vocabulary is `outcome`
    // and `analysis_type`. Creating an analysis is served by
    // /service-tickets/:id/analysis, the path the page calls, so the POST
    // that used to sit here (reachable only as /service-analysis/<ticketId>,
    // which nothing requests) is gone.

    // GET /service-analysis/stats
    if (req.method === 'GET' && resource === 'stats') {
      let analyses: Array<{ outcome: string | null; analysis_type: string | null }>;
      try {
        analyses = await fetchAllRows<{ outcome: string | null; analysis_type: string | null }>(
          () =>
            admin
              .from('service_call_analysis')
              .select('outcome, analysis_type')
              .eq('tenant_id', tenantId),
        );
      } catch (error) {
        console.error('Error fetching analysis stats:', error);
        return createCorsResponse({ error: 'Failed to fetch analysis stats' }, 500, req);
      }

      const byOutcome: Record<string, number> = {};
      const byAnalysisType: Record<string, number> = {};
      for (const a of analyses) {
        const outcome = a.outcome ?? 'unrecorded';
        const type = a.analysis_type ?? 'unrecorded';
        byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;
        byAnalysisType[type] = (byAnalysisType[type] ?? 0) + 1;
      }

      return createCorsResponse({ total: analyses.length, byOutcome, byAnalysisType }, 200, req);
    }

    // GET /service-analysis/recent
    if (req.method === 'GET' && resource === 'recent') {
      const { data: analyses, error } = await admin
        .from('service_call_analysis')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch recent analyses' }, 500, req);
      }

      return createCorsResponse((analyses ?? []).map(toCamelShallow), 200, req);
    }

    // GET /service-analysis/:analysisId
    if (req.method === 'GET' && resource && !subResource) {
      const { data: analysis, error } = await admin
        .from('service_call_analysis')
        .select('*')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        return createCorsResponse({ error: 'Failed to load service analysis' }, 500, req);
      }
      if (!analysis) {
        return createCorsResponse({ error: 'Service analysis not found' }, 404, req);
      }

      return createCorsResponse(toCamelShallow(analysis), 200, req);
    }

    // PUT /service-analysis/:id - update only the fields sent
    if (req.method === 'PUT' && resource && !subResource) {
      const body = await req.json().catch(() => ({}));
      const plan = buildAnalysisRow(body, { tenantId, ticketId: '', userId: user.id }, 'update');
      if (plan.invalid.length > 0) {
        return createCorsResponse(
          { error: 'Invalid analysis', code: 'INVALID_ANALYSIS', invalid: plan.invalid },
          400,
          req,
        );
      }
      if (Object.keys(plan.row).length === 0) {
        return createCorsResponse(
          {
            error: 'No writable fields',
            code: 'NO_WRITABLE_FIELDS',
            ignoredFields: plan.ignoredFields,
          },
          400,
          req,
        );
      }

      const { data: analysis, error } = await admin
        .from('service_call_analysis')
        .update({ ...plan.row, updated_at: new Date().toISOString() })
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return createCorsResponse({ error: 'Failed to update service analysis' }, 500, req);
      }
      if (!analysis) {
        return createCorsResponse({ error: 'Service analysis not found' }, 404, req);
      }

      return createCorsResponse(
        { ...toCamelShallow(analysis), ignoredFields: plan.ignoredFields },
        200,
        req,
      );
    }

    // GET /service-analysis/:analysisId/parts-used
    if (req.method === 'GET' && resource && subResource === 'parts-used') {
      const { data: parts, error } = await admin
        .from('service_parts_used')
        .select('*')
        .eq('analysis_id', resource)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch parts used' }, 500, req);
      }

      return createCorsResponse((parts ?? []).map(toCamelShallow), 200, req);
    }

    // POST /service-analysis/:analysisId/parts-used
    if (req.method === 'POST' && resource && subResource === 'parts-used') {
      const body = await req.json().catch(() => ({}));
      const partNumber = body.partNumber ?? body.part_number;
      const partName = body.partName ?? body.part_name;
      const quantityUsed = Number(body.quantityUsed ?? body.quantity_used ?? body.quantity);
      const missing = [
        !partNumber && 'partNumber',
        !partName && 'partName',
        !(quantityUsed > 0) && 'quantityUsed',
      ].filter(Boolean);
      if (missing.length > 0) {
        return createCorsResponse({ error: 'Missing required fields', missing }, 400, req);
      }

      const { data: analysisRow } = await admin
        .from('service_call_analysis')
        .select('id')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!analysisRow) {
        return createCorsResponse({ error: 'Analysis not found' }, 404, req);
      }

      const unitCost = body.unitCost ?? body.unit_cost ?? null;
      const { data: part, error } = await admin
        .from('service_parts_used')
        .insert({
          tenant_id: tenantId,
          analysis_id: resource,
          part_number: partNumber,
          part_name: partName,
          part_description: body.partDescription ?? body.part_description ?? null,
          quantity_used: quantityUsed,
          was_in_stock: body.wasInStock ?? body.was_in_stock ?? false,
          unit_cost: unitCost,
          total_cost: unitCost === null ? null : Number(unitCost) * quantityUsed,
          billable: body.billable ?? true,
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add part used' }, 500, req);
      }

      return createCorsResponse(toCamelShallow(part), 201, req);
    }

    // POST /service-analysis/:analysisId/parts-order - Create parts order
    if (req.method === 'POST' && resource && subResource === 'parts-order') {
      const body = await req.json();

      // AUDIT-037: this wrote parts, total_cost and ordered_by, none of which
      // is a column, and omitted five NOT NULLs - service_ticket_id,
      // order_number, vendor_name, order_date, subtotal and total. So creating
      // a parts order was a 42703 that would have failed five more times.
      //
      // The client was already right: ServiceTicketAnalysis derives its form
      // from insertPartsOrderSchema, so it sends the real column set in
      // camelCase, and the line items go separately to
      // /api/parts-orders/:id/items - which is why `parts` had nowhere to go.
      const { data: analysisRow } = await admin
        .from('service_call_analysis')
        .select('id, service_ticket_id')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!analysisRow) {
        return createCorsResponse({ error: 'Analysis not found' }, 404, req);
      }

      const vendorName = body.vendorName ?? body.vendor_name;
      const subtotal = Number(body.subtotal ?? 0);
      const total = Number(body.total ?? subtotal);
      if (!vendorName) {
        return createCorsResponse(
          { error: 'vendorName is required', missing: ['vendorName'] },
          400,
          req,
        );
      }

      const orderNumber =
        body.orderNumber ??
        body.order_number ??
        `PO-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)
          .toString()
          .padStart(4, '0')}`;

      const { data: order, error } = await admin
        .from('parts_orders')
        .insert({
          tenant_id: tenantId,
          analysis_id: resource,
          service_ticket_id: (analysisRow as Record<string, unknown>).service_ticket_id,
          order_number: orderNumber,
          vendor_id: body.vendorId ?? body.vendor_id ?? null,
          vendor_name: vendorName,
          status: 'pending',
          order_date: body.orderDate ?? body.order_date ?? new Date().toISOString(),
          expected_delivery_date: body.expectedDeliveryDate ?? body.expected_delivery_date ?? null,
          subtotal,
          tax: Number(body.tax ?? 0),
          shipping: Number(body.shipping ?? 0),
          total,
          priority: body.priority ?? 'normal',
          rush_order: body.rushOrder ?? body.rush_order ?? false,
          special_instructions: body.specialInstructions ?? body.special_instructions ?? null,
          delivery_address: body.deliveryAddress ?? body.delivery_address ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create parts order' }, 500, req);
      }

      // `parts` is not dropped information: parts_order_items is the table for
      // it, and the client already posts there with the new order's id.
      const partsIgnored =
        body.parts !== undefined
          ? ['parts: line items belong in parts_order_items - POST /parts-orders/:id/items']
          : [];

      return createCorsResponse(
        partsIgnored.length > 0
          ? { ...(order as Record<string, unknown>), unpersisted: partsIgnored }
          : order,
        201,
        req,
      );
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

      return createCorsResponse((orders ?? []).map(toCamelShallow), 200, req);
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
