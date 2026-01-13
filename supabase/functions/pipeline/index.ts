// Pipeline Edge Function
// Handles sales pipeline configuration and stages
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const resource = pathParts[1]; // 'stages', 'config', 'stats'
    const resourceId = pathParts[2];

    // GET /pipeline/stages - List pipeline stages
    if (req.method === 'GET' && resource === 'stages' && !resourceId) {
      const { data: stages, error } = await admin
        .from('deal_stages')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching pipeline stages:', error);
        return createCorsResponse({ error: 'Failed to fetch pipeline stages' }, 500, req);
      }

      return createCorsResponse(stages || [], 200, req);
    }

    // POST /pipeline/stages - Create pipeline stage
    if (req.method === 'POST' && resource === 'stages') {
      const body = await req.json();

      const stageData = {
        tenant_id: tenantId,
        stage_name: body.stageName || body.stage_name,
        order_index: body.orderIndex || body.order_index || 0,
        probability: body.probability || 0,
        is_closed:
          body.isClosed !== undefined
            ? body.isClosed
            : body.is_closed !== undefined
              ? body.is_closed
              : false,
        is_won:
          body.isWon !== undefined ? body.isWon : body.is_won !== undefined ? body.is_won : false,
        color: body.color || '#6B7280',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: stage, error } = await admin
        .from('deal_stages')
        .insert(stageData)
        .select()
        .single();

      if (error) {
        console.error('Error creating pipeline stage:', error);
        return createCorsResponse(
          { error: 'Failed to create pipeline stage', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(stage, 201, req);
    }

    // PATCH /pipeline/stages/:id - Update pipeline stage
    if ((req.method === 'PATCH' || req.method === 'PUT') && resource === 'stages' && resourceId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        stageName: 'stage_name',
        orderIndex: 'order_index',
        probability: 'probability',
        isClosed: 'is_closed',
        isWon: 'is_won',
        color: 'color',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: stage, error } = await admin
        .from('deal_stages')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating pipeline stage:', error);
        return createCorsResponse({ error: 'Failed to update pipeline stage' }, 500, req);
      }

      return createCorsResponse(stage, 200, req);
    }

    // DELETE /pipeline/stages/:id - Delete pipeline stage
    if (req.method === 'DELETE' && resource === 'stages' && resourceId) {
      const { error } = await admin
        .from('deal_stages')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting pipeline stage:', error);
        return createCorsResponse({ error: 'Failed to delete pipeline stage' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Pipeline stage deleted' }, 200, req);
    }

    // GET /pipeline/stats - Get pipeline statistics
    if (req.method === 'GET' && resource === 'stats') {
      const [deals, stages] = await Promise.all([
        admin.from('deals').select('stage, deal_value').eq('tenant_id', tenantId),
        admin
          .from('deal_stages')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('order_index', { ascending: true }),
      ]);

      const pipelineStats = stages.data?.map((stage) => {
        const stageDeals = deals.data?.filter((d) => d.stage === stage.stage_name) || [];
        const totalValue = stageDeals.reduce((sum, d) => sum + parseFloat(d.deal_value || '0'), 0);

        return {
          stageName: stage.stage_name,
          orderIndex: stage.order_index,
          probability: stage.probability,
          dealCount: stageDeals.length,
          totalValue,
          avgDealSize: stageDeals.length > 0 ? totalValue / stageDeals.length : 0,
        };
      });

      return createCorsResponse(
        {
          stages: pipelineStats || [],
          totalDeals: deals.data?.length || 0,
          totalValue: deals.data?.reduce((sum, d) => sum + parseFloat(d.deal_value || '0'), 0) || 0,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Invalid pipeline endpoint' }, 400, req);
  } catch (error) {
    console.error('Error in pipeline function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
