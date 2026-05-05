// Renewal Playbooks Edge Function
// Handles renewal playbook templates and recommendations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'renewal-playbooks');
    const playbookId = parts[0];
    const subResource = parts[1];

    // GET /renewal-playbooks - List playbooks
    if (req.method === 'GET' && !playbookId) {
      const { data: playbooks, error } = await admin
        .from('renewal_playbooks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch playbooks' }, 500, req);
      }

      return createCorsResponse(playbooks || [], 200, req);
    }

    // GET /renewal-playbooks/recommend/:renewalId - Get recommended playbook
    if (req.method === 'GET' && playbookId === 'recommend' && subResource) {
      const renewalId = subResource;

      // Get renewal details
      const { data: renewal } = await admin
        .from('contract_renewals')
        .select('*, customer:customer_id (*)')
        .eq('id', renewalId)
        .eq('tenant_id', tenantId)
        .single();

      if (!renewal) {
        return createCorsResponse({ error: 'Renewal not found' }, 404, req);
      }

      // Get playbooks and find best match
      const { data: playbooks } = await admin
        .from('renewal_playbooks')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Simple recommendation logic based on risk level
      const recommended =
        (playbooks || []).find((p: any) => p.risk_levels?.includes(renewal.risk_level)) ||
        playbooks?.[0];

      return createCorsResponse(
        {
          renewal,
          recommendedPlaybook: recommended,
          allPlaybooks: playbooks || [],
        },
        200,
        req,
      );
    }

    // GET /renewal-playbooks/:id - Get single playbook
    if (req.method === 'GET' && playbookId && !subResource) {
      const { data: playbook, error } = await admin
        .from('renewal_playbooks')
        .select('*')
        .eq('id', playbookId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Playbook not found' }, 404, req);
      }

      return createCorsResponse(playbook, 200, req);
    }

    // POST /renewal-playbooks - Create playbook
    if (req.method === 'POST' && !playbookId) {
      const body = await req.json();

      const { data: playbook, error } = await admin
        .from('renewal_playbooks')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          risk_levels: body.riskLevels || body.risk_levels || [],
          steps: body.steps || [],
          is_active: body.isActive !== false,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create playbook' }, 500, req);
      }

      return createCorsResponse(playbook, 201, req);
    }

    // PUT /renewal-playbooks/:id - Update playbook
    if (req.method === 'PUT' && playbookId) {
      const body = await req.json();

      const { data: playbook, error } = await admin
        .from('renewal_playbooks')
        .update({
          name: body.name,
          description: body.description,
          risk_levels: body.riskLevels || body.risk_levels,
          steps: body.steps,
          is_active: body.isActive ?? body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', playbookId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update playbook' }, 500, req);
      }

      return createCorsResponse(playbook, 200, req);
    }

    // DELETE /renewal-playbooks/:id - Delete playbook
    if (req.method === 'DELETE' && playbookId) {
      const { error } = await admin
        .from('renewal_playbooks')
        .delete()
        .eq('id', playbookId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete playbook' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Playbook deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in renewal-playbooks function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
