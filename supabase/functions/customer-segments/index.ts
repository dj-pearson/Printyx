// Customer Segments Edge Function
// Handles customer segmentation and targeting
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
    const segmentId = pathParts[1];
    const subResource = pathParts[2];

    // GET /customer-segments - List segments
    if (req.method === 'GET' && !segmentId) {
      const { data: segments, error } = await admin
        .from('customer_segments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching customer segments:', error);
        return createCorsResponse({ error: 'Failed to fetch segments' }, 500, req);
      }

      // Get member counts
      const segmentsWithCounts = await Promise.all(
        (segments || []).map(async (segment: any) => {
          const { count } = await admin
            .from('customer_segment_members')
            .select('*', { count: 'exact', head: true })
            .eq('segment_id', segment.id);
          return { ...segment, memberCount: count || 0 };
        }),
      );

      return createCorsResponse(segmentsWithCounts, 200, req);
    }

    // GET /customer-segments/:id - Get single segment
    if (req.method === 'GET' && segmentId && !subResource) {
      const { data: segment, error } = await admin
        .from('customer_segments')
        .select('*')
        .eq('id', segmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Segment not found' }, 404, req);
      }

      // Get member count
      const { count } = await admin
        .from('customer_segment_members')
        .select('*', { count: 'exact', head: true })
        .eq('segment_id', segmentId);

      return createCorsResponse({ ...segment, memberCount: count || 0 }, 200, req);
    }

    // GET /customer-segments/:id/members - Get segment members
    if (req.method === 'GET' && segmentId && subResource === 'members') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      const {
        data: members,
        count,
        error,
      } = await admin
        .from('customer_segment_members')
        .select(
          `
          *,
          customer:customer_id (
            id,
            company_name,
            email,
            status
          )
        `,
          { count: 'exact' },
        )
        .eq('segment_id', segmentId)
        .range(offset, offset + limit - 1);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch members' }, 500, req);
      }

      return createCorsResponse(
        {
          members: members || [],
          pagination: { page, limit, total: count || 0 },
        },
        200,
        req,
      );
    }

    // POST /customer-segments - Create segment
    if (req.method === 'POST' && !segmentId) {
      const body = await req.json();

      const segmentData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        segment_type: body.segmentType || body.segment_type || 'static', // 'static' or 'dynamic'
        criteria: body.criteria || {},
        is_active: body.isActive !== false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: segment, error } = await admin
        .from('customer_segments')
        .insert(segmentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating segment:', error);
        return createCorsResponse({ error: 'Failed to create segment' }, 500, req);
      }

      return createCorsResponse(segment, 201, req);
    }

    // PUT /customer-segments/:id - Update segment
    if (req.method === 'PUT' && segmentId && !subResource) {
      const body = await req.json();

      const { data: segment, error } = await admin
        .from('customer_segments')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', segmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update segment' }, 500, req);
      }

      return createCorsResponse(segment, 200, req);
    }

    // POST /customer-segments/:id/members - Add members to segment
    if (req.method === 'POST' && segmentId && subResource === 'members') {
      const body = await req.json();
      const customerIds = body.customerIds || body.customer_ids || [];

      const members = customerIds.map((customerId: string) => ({
        segment_id: segmentId,
        customer_id: customerId,
        added_by: user.id,
        added_at: new Date().toISOString(),
      }));

      const { error } = await admin
        .from('customer_segment_members')
        .upsert(members, { onConflict: 'segment_id,customer_id' });

      if (error) {
        return createCorsResponse({ error: 'Failed to add members' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          addedCount: customerIds.length,
        },
        200,
        req,
      );
    }

    // DELETE /customer-segments/:id/members - Remove members from segment
    if (req.method === 'DELETE' && segmentId && subResource === 'members') {
      const body = await req.json();
      const customerIds = body.customerIds || body.customer_ids || [];

      const { error } = await admin
        .from('customer_segment_members')
        .delete()
        .eq('segment_id', segmentId)
        .in('customer_id', customerIds);

      if (error) {
        return createCorsResponse({ error: 'Failed to remove members' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          removedCount: customerIds.length,
        },
        200,
        req,
      );
    }

    // POST /customer-segments/:id/refresh - Refresh dynamic segment
    if (req.method === 'POST' && segmentId && subResource === 'refresh') {
      const { data: segment } = await admin
        .from('customer_segments')
        .select('criteria, segment_type')
        .eq('id', segmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (segment?.segment_type !== 'dynamic') {
        return createCorsResponse({ error: 'Only dynamic segments can be refreshed' }, 400, req);
      }

      // Clear existing members
      await admin.from('customer_segment_members').delete().eq('segment_id', segmentId);

      // In production, apply criteria to find matching customers
      // For now, this is a placeholder
      const criteria = segment.criteria || {};

      let query = admin
        .from('business_records')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer');

      // Apply criteria filters
      if (criteria.industry) query = query.eq('industry', criteria.industry);
      if (criteria.minRevenue) query = query.gte('annual_revenue', criteria.minRevenue);
      if (criteria.maxRevenue) query = query.lte('annual_revenue', criteria.maxRevenue);
      if (criteria.status) query = query.eq('status', criteria.status);

      const { data: customers } = await query;

      // Add matching customers to segment
      if (customers && customers.length > 0) {
        const members = customers.map((c: any) => ({
          segment_id: segmentId,
          customer_id: c.id,
          added_by: user.id,
          added_at: new Date().toISOString(),
        }));

        await admin.from('customer_segment_members').insert(members);
      }

      // Update last refresh timestamp
      await admin
        .from('customer_segments')
        .update({
          last_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', segmentId);

      return createCorsResponse(
        {
          success: true,
          memberCount: customers?.length || 0,
          refreshedAt: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // DELETE /customer-segments/:id - Delete segment
    if (req.method === 'DELETE' && segmentId) {
      // Delete members first
      await admin.from('customer_segment_members').delete().eq('segment_id', segmentId);

      const { error } = await admin
        .from('customer_segments')
        .delete()
        .eq('id', segmentId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete segment' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Segment deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in customer-segments function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
