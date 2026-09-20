// Renewal Playbooks Edge Function
//
// SEC-EDGE-001 batch 16. The table stores playbook_name and trigger_conditions;
// this function wrote `name` and `risk_levels`, so every create and update was a
// PGRST204 and the list ORDERED BY `name`, taking the whole read down with a
// 42703.
//
// THE RECOMMENDATION WAS THE WORSE HALF. It read `p.risk_levels?.includes(...)`,
// which is undefined on every row, so the find() never matched and the code fell
// through to `playbooks?.[0]` - the FIRST playbook in the list, returned under
// the key `recommendedPlaybook` as though it had been matched against the
// renewal's risk level. Arbitrary selection wearing matching logic's clothes.
// It matches trigger_conditions now and returns null with a reason when nothing
// fits, because no recommendation is honest and a wrong one is not.
// Handles renewal playbook templates and recommendations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

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
        .order('playbook_name', { ascending: true });

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

      // trigger_conditions is free-form jsonb; riskLevels is the key this
      // matching has always meant to read. A playbook flagged is_default wins
      // when nothing matches on risk, and when there is no default either the
      // answer is null rather than whichever row came back first.
      const rows = playbooks || [];
      const matchesRisk = (p: any) => {
        const levels = p?.trigger_conditions?.riskLevels ?? p?.trigger_conditions?.risk_levels;
        return Array.isArray(levels) && levels.includes(renewal.risk_level);
      };
      const matched = rows.find(matchesRisk) ?? null;
      const fallback = matched ? null : (rows.find((p: any) => p.is_default) ?? null);

      return createCorsResponse(
        {
          renewal,
          recommendedPlaybook: matched ?? fallback,
          recommendationBasis: matched ? 'risk_level' : fallback ? 'tenant_default' : 'none',
          allPlaybooks: rows,
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
          playbook_name: body.playbookName || body.playbook_name || body.name,
          description: body.description,
          // risk_levels was never a column; the criteria live in this jsonb blob.
          trigger_conditions: body.triggerConditions ||
            body.trigger_conditions || {
              riskLevels: body.riskLevels || body.risk_levels || [],
            },
          steps: body.steps || [],
          is_default: body.isDefault ?? body.is_default ?? false,
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
        .update(
          Object.fromEntries(
            Object.entries({
              playbook_name: body.playbookName ?? body.playbook_name ?? body.name,
              description: body.description,
              trigger_conditions:
                body.triggerConditions ??
                body.trigger_conditions ??
                (body.riskLevels || body.risk_levels
                  ? { riskLevels: body.riskLevels ?? body.risk_levels }
                  : undefined),
              steps: body.steps,
              is_active: body.isActive ?? body.is_active,
              is_default: body.isDefault ?? body.is_default,
              updated_at: new Date().toISOString(),
            }).filter(([, v]) => v !== undefined),
          ),
        )
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
