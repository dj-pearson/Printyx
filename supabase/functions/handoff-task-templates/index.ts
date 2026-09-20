// Handoff Task Templates Edge Function
// Handles templates for handoff tasks
//
// SEC-EDGE-001 round 91 settled this function's `unexamined` triage verdict, and
// answering the question found three defects in branches nobody calls yet.
//
// THE READ HAS ONE CALLER AND THE WRITES HAVE NONE. SalesHandoffs.tsx issues a
// single GET; no client tree anywhere POSTs, PUTs or DELETEs a template. That is
// what made the gate free to install (round 85's "a write branch with no caller
// is a door nobody has walked through yet") and it is also why the PUT could be
// a guaranteed 500 since the day it shipped without anyone noticing - COP-B03's
// setup exactly.
//
// WHY SUPERVISOR ON THE WRITES. A template is TENANT-WIDE: `ensureHandoffTemplate`
// in _shared/handoff-create.ts picks one per handoff type and every future handoff
// of that type inherits its checklist, so editing one silently changes what
// operations is asked to do for everybody. That is the churn-risk/toner-replenish
// shape. The gate mirrors `/handoffs` in navigation-permissions.ts (minLevel 3), so
// it constrains nobody who can already open the page and everybody who cannot -
// which is the point, because a nav gate hides a menu item and protects nothing.
// Reads stay open at the function level: the page's own rule already fronts them,
// and a checklist of internal steps is not what a role gate is for.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  buildTemplateUpdate,
  normalizeHandoffType,
  HANDOFF_TYPES,
} from '../_shared/sales-handoff.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel, type AuthContext } from '../_shared/rbac.ts';

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

    const requireSupervisor = () =>
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        ROLE_LEVEL.SUPERVISOR,
      );

    // Only an RbacError is a role refusal; anything else is rethrown so a
    // database outage does not read as "your role is too low".
    const denySupervisor = (err: unknown) => {
      if (!(err instanceof RbacError)) throw err;
      return createCorsResponse(
        {
          error: 'Changing handoff task templates requires a supervisor role',
          code: 'INSUFFICIENT_ROLE',
          details: err.details,
        },
        403,
        req,
      );
    };

    /**
     * One default per (tenant, handoff type), cleared in the same call that sets
     * one - the default-row rule this repo already applies to brand voices and
     * CMS targets. It runs AFTER the row is written: the caller asked for that
     * write, so failing it to protect an invariant the reader now resolves
     * deterministically anyway would be the wrong trade. What the clear must not
     * do is fail in silence, so its outcome is reported (COP-B06).
     */
    const clearOtherDefaults = async (keepId: string, handoffType: string) => {
      const { data, error } = await admin
        .from('handoff_task_templates')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('handoff_type', handoffType)
        .eq('is_default', true)
        .neq('id', keepId)
        .select('id');
      if (error) return { cleared: 0, warning: `Could not clear other defaults: ${error.message}` };
      return { cleared: data?.length ?? 0 };
    };

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /handoff-task-templates, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'handoff-task-templates');
    const templateId = parts[0];

    // GET /handoff-task-templates - List templates
    if (req.method === 'GET' && !templateId) {
      // WF-C-06: the real columns are template_name and handoff_type. This
      // ordered by `name` and filtered on `category`, neither of which exists, so
      // the list was a 42703 on every request and the two writes below dropped
      // four keys each - name, description, category and default_assignee_role -
      // while never setting template_name or handoff_type, both NOT NULL. Nothing
      // caught it because nothing called it.
      const handoffType =
        url.searchParams.get('handoffType') || url.searchParams.get('handoff_type');

      let query = admin
        .from('handoff_task_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('template_name', { ascending: true });

      if (handoffType) query = query.eq('handoff_type', handoffType);

      const { data: templates, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch handoff task templates' }, 500, req);
      }

      return createCorsResponse(templates || [], 200, req);
    }

    // GET /handoff-task-templates/:id - Get single template
    if (req.method === 'GET' && templateId) {
      const { data: template, error } = await admin
        .from('handoff_task_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Handoff task template not found' }, 404, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // POST /handoff-task-templates - Create template
    if (req.method === 'POST' && !templateId) {
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

      const body = (await req.json()) as Record<string, unknown>;

      // Both are NOT NULL, so a 400 naming the field beats a 23502 the caller
      // reads as a server fault.
      const missing: string[] = [];
      if (!(body.templateName || body.template_name || body.name)) missing.push('templateName');
      if (!normalizeHandoffType(body.handoffType ?? body.handoff_type ?? body.category)) {
        missing.push('handoffType');
      }
      if (missing.length > 0) {
        return createCorsResponse(
          { error: `Missing required field(s): ${missing.join(', ')}`, missing },
          400,
          req,
        );
      }

      const handoffType = normalizeHandoffType(
        body.handoffType ?? body.handoff_type ?? body.category,
      ) as string;

      const { data: template, error } = await admin
        .from('handoff_task_templates')
        .insert({
          tenant_id: tenantId,
          template_name: body.templateName || body.template_name || body.name,
          handoff_type: handoffType,
          description: body.description ?? null,
          tasks: body.tasks || [],
          is_active: body.isActive !== false,
          is_default: body.isDefault === true,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create handoff task template' }, 500, req);
      }

      if (body.isDefault === true) {
        const outcome = await clearOtherDefaults(template.id as string, handoffType);
        return createCorsResponse({ ...template, ...outcome }, 201, req);
      }

      return createCorsResponse(template, 201, req);
    }

    // PUT /handoff-task-templates/:id - Update template
    if (req.method === 'PUT' && templateId) {
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

      const body = (await req.json()) as Record<string, unknown>;

      // The plan is built by a pure function in _shared/sales-handoff.ts so the
      // property can be tested against real inputs; see its header for what the
      // blanket object it replaced did to every partial edit.
      const { update, refused } = buildTemplateUpdate(body);

      if (refused.length > 0) {
        return createCorsResponse(
          {
            error: `Invalid value for field(s): ${refused.join(', ')}`,
            refused,
            allowedHandoffTypes: HANDOFF_TYPES,
          },
          400,
          req,
        );
      }

      // An empty plan is a 400, never a 200 that bumps updated_at and reports
      // success (COP-M01).
      if (Object.keys(update).length === 0) {
        return createCorsResponse({ error: 'No updatable fields in request body' }, 400, req);
      }

      update.updated_at = new Date().toISOString();

      const { data: template, error } = await admin
        .from('handoff_task_templates')
        .update(update)
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update handoff task template' }, 500, req);
      }

      if (update.is_default === true) {
        const outcome = await clearOtherDefaults(
          template.id as string,
          template.handoff_type as string,
        );
        return createCorsResponse({ ...template, ...outcome }, 200, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // DELETE /handoff-task-templates/:id - Delete template
    if (req.method === 'DELETE' && templateId) {
      try {
        requireSupervisor();
      } catch (err) {
        return denySupervisor(err);
      }

      const { error } = await admin
        .from('handoff_task_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete handoff task template' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Handoff task template deleted' },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in handoff-task-templates function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
