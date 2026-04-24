// Employees CRUD — /ai-employee/ai-employees (+ /:employeeId)
// Replaces server/routes/ai-employee-routes.ts::23-114 + 342-461.

import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { z } from 'https://esm.sh/zod@3.22.4';
import type { HandlerCtx } from '../_context.ts';
import { AI_EMPLOYEE_TEMPLATES, DEFAULT_SKILLS_BY_TYPE } from '../_templates.ts';

const createEmployeeSchema = z.object({
  employeeName: z.string().min(1).max(255),
  employeeType: z.string().min(1),
  employeeRole: z.string().min(1),
  aiPersonality: z.record(z.unknown()).optional(),
  aiExpertiseAreas: z.array(z.string()).optional(),
  aiCapabilities: z.array(z.string()).optional(),
  autonomyLevel: z.enum(['supervised', 'semi_autonomous', 'autonomous']).optional(),
});

export async function handleEmployees(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  const [_resource, employeeIdOrSub, sub2] = pathParts; // pathParts[0] === 'ai-employees'

  // GET /ai-employees/templates — static catalog
  if (method === 'GET' && employeeIdOrSub === 'templates') {
    return jsonResponse(
      { success: true, data: AI_EMPLOYEE_TEMPLATES, count: AI_EMPLOYEE_TEMPLATES.length },
      200,
      req,
      requestId,
    );
  }

  // POST /ai-employees — create
  if (method === 'POST' && !employeeIdOrSub) {
    let body;
    try {
      body = await validateBody(createEmployeeSchema, req);
    } catch (err) {
      return errorResponse(400, 'Invalid request body', req, {
        code: 'VALIDATION',
        details: (err as { issues?: unknown }).issues,
        requestId,
      });
    }

    const { data: employee, error } = await db
      .from('ai_employees')
      .insert({
        tenant_id: auth.tenantId,
        employee_name: body.employeeName,
        employee_type: body.employeeType,
        employee_role: body.employeeRole,
        ai_personality: body.aiPersonality ?? {},
        ai_expertise_areas: body.aiExpertiseAreas ?? [],
        ai_capabilities: body.aiCapabilities ?? [],
        autonomy_level: body.autonomyLevel ?? 'supervised',
        created_by: auth.userId,
      })
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to create AI employee', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    // Seed default skills based on type. Non-blocking — a skill seed failure
    // shouldn't prevent employee creation from succeeding.
    const skills = DEFAULT_SKILLS_BY_TYPE[body.employeeType] ?? ['general_assistance'];
    const skillRows = skills.map((skill_name) => ({
      tenant_id: auth.tenantId,
      employee_id: employee.id,
      skill_name,
      skill_category: 'core',
      proficiency_level: 7,
    }));
    await db.from('ai_employee_skills').upsert(skillRows, {
      onConflict: 'tenant_id,employee_id,skill_name',
      ignoreDuplicates: true,
    });

    return jsonResponse(
      { success: true, data: employee, message: 'AI employee created successfully' },
      201,
      req,
      requestId,
    );
  }

  // GET /ai-employees — list
  if (method === 'GET' && !employeeIdOrSub) {
    const q = ctx.url.searchParams;
    let query = db
      .from('ai_employees')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false });

    if (q.get('employeeType')) query = query.eq('employee_type', q.get('employeeType')!);
    if (q.get('status')) query = query.eq('status', q.get('status')!);
    if (q.get('autonomyLevel')) query = query.eq('autonomy_level', q.get('autonomyLevel')!);

    const { data, error } = await query;
    if (error) {
      return errorResponse(500, 'Failed to fetch AI employees', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      { success: true, data: data ?? [], count: data?.length ?? 0 },
      200,
      req,
      requestId,
    );
  }

  // GET /ai-employees/:id — detail (only if sub2 is missing; otherwise it's a nested resource)
  if (method === 'GET' && employeeIdOrSub && !sub2) {
    const { data, error } = await db
      .from('ai_employees')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('id', employeeIdOrSub)
      .maybeSingle();

    if (error) {
      return errorResponse(500, 'Failed to fetch AI employee', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    if (!data) {
      return errorResponse(404, 'AI employee not found', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse({ success: true, data }, 200, req, requestId);
  }

  return null;
}
