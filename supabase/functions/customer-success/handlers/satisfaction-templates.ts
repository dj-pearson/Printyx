/**
 * Satisfaction survey templates (CSAT-PRODUCER-001, round 180).
 *
 *   GET  /customer-success/satisfaction-templates   templates with their questions
 *   POST /customer-success/satisfaction-templates   author a template (MANAGER)
 *
 * The authoring half of the producer: a template and its questions are what
 * every survey is built from, and nothing in the product could create one. A
 * completed service ticket uses the tenant's default active
 * service_request_completion template, and gets DEFAULT_COMPLETION_TEMPLATE
 * created for it on first use if the tenant never authored one - so authoring
 * is how a tenant replaces the default, not a prerequisite for surveys.
 *
 * MANAGER to author, because a template decides what every customer of the
 * tenant is asked after every completed visit; reading stays open to anyone
 * in customer success.
 */
import { jsonResponse, errorResponse } from '../../_shared/http.ts';
import { requireRoleLevel, RbacError, ROLE_LEVEL } from '../../_shared/rbac.ts';
import { planTemplate } from '../../../../shared/csat-survey.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleSatisfactionTemplates(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { db, auth, requestId, method } = ctx;
  if (ctx.pathParts.length > 0) return null;

  if (method === 'GET') {
    const { data: templates, error } = await db
      .from('customer_satisfaction_survey_templates')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('updated_at', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to load survey templates', req, {
        code: 'TEMPLATES_READ_FAILED',
        requestId,
      });
    }
    const ids = (templates ?? []).map((t: { id: string }) => t.id);
    const questions: Array<Record<string, unknown>> = [];
    if (ids.length > 0) {
      const { data: rows, error: qError } = await db
        .from('customer_satisfaction_survey_questions')
        .select('*')
        .in('template_id', ids)
        .order('order_index', { ascending: true });
      if (qError) {
        return errorResponse(500, 'Failed to load survey questions', req, {
          code: 'TEMPLATES_READ_FAILED',
          requestId,
        });
      }
      questions.push(...(rows ?? []));
    }
    return jsonResponse(
      {
        data: (templates ?? []).map((t: Record<string, unknown>) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          surveyType: t.survey_type,
          isActive: t.is_active,
          isDefault: t.is_default,
          expiryDays: t.expiry_days,
          questions: questions
            .filter((q) => q.template_id === t.id)
            .map((q) => ({
              id: q.id,
              questionText: q.question_text,
              questionType: q.question_type,
              isRequired: q.is_required,
              orderIndex: q.order_index,
              category: q.category,
            })),
        })),
      },
      200,
      req,
      requestId,
    );
  }

  if (method === 'POST') {
    try {
      requireRoleLevel(auth, ROLE_LEVEL.MANAGER);
    } catch (err) {
      if (err instanceof RbacError) {
        return errorResponse(403, 'Authoring a survey template needs a manager', req, {
          code: 'INSUFFICIENT_ROLE',
          details: err.details,
          requestId,
        });
      }
      throw err;
    }

    const body = await req.json().catch(() => null);
    const plan = planTemplate(body);
    if (!plan.ok || !plan.template || !plan.questions) {
      return errorResponse(400, 'The template is not valid', req, {
        code: 'INVALID_TEMPLATE',
        details: { errors: plan.errors },
        requestId,
      });
    }

    // One default per survey type: clear the others first, so the dispatcher's
    // pick is never a coin toss between two defaults.
    if (plan.template.is_default) {
      const { error: clearError } = await db
        .from('customer_satisfaction_survey_templates')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', auth.tenantId)
        .eq('survey_type', plan.template.survey_type);
      if (clearError) {
        return errorResponse(500, 'Failed to save the survey template', req, {
          code: 'TEMPLATE_WRITE_FAILED',
          requestId,
        });
      }
    }

    const { data: template, error } = await db
      .from('customer_satisfaction_survey_templates')
      .insert({ ...plan.template, tenant_id: auth.tenantId, created_by: auth.userId })
      .select('id')
      .single();
    if (error) {
      return errorResponse(500, 'Failed to save the survey template', req, {
        code: 'TEMPLATE_WRITE_FAILED',
        requestId,
      });
    }

    const { error: qError } = await db
      .from('customer_satisfaction_survey_questions')
      .insert(plan.questions.map((q) => ({ ...q, template_id: template.id })));
    if (qError) {
      // A template with no questions would produce blank surveys; remove it
      // rather than answer 201 over half a write.
      const { error: cleanupError } = await db
        .from('customer_satisfaction_survey_templates')
        .delete()
        .eq('id', template.id)
        .eq('tenant_id', auth.tenantId);
      return errorResponse(500, 'Failed to save the survey questions', req, {
        code: 'TEMPLATE_WRITE_FAILED',
        details: { templateRemoved: !cleanupError },
        requestId,
      });
    }

    return jsonResponse({ id: template.id, questions: plan.questions.length }, 201, req, requestId);
  }

  return null;
}
