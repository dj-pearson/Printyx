/**
 * Creates the satisfaction survey a completed service ticket produces
 * (CSAT-PRODUCER-001, round 180). The rules live in shared/csat-survey.ts;
 * this is the I/O.
 *
 * It NEVER THROWS and never blocks the caller: a ticket completion must not
 * fail because a survey could not be created. Every outcome is returned so the
 * caller can log it.
 *
 * Idempotent per ticket by a lookup on related_service_request_id before the
 * insert. There is no unique index on that column, so two concurrent
 * completions of one ticket can both pass the lookup; that is accepted - the
 * consequence is a duplicate invitation in one customer's portal, not a wrong
 * number, and completing the same ticket twice at once is not a real workflow.
 */
import {
  DEFAULT_COMPLETION_TEMPLATE,
  planCompletionSurvey,
  planTemplate,
} from '../../../shared/csat-survey.ts';

// deno-lint-ignore no-explicit-any
type Client = any;

export type DispatchOutcome =
  | { created: true; surveyId: string }
  | { created: false; reason: string };

function newAccessToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The tenant's default active completion template, created on first use. */
async function completionTemplate(
  admin: Client,
  tenantId: string,
): Promise<{ id: string; expiry_days: number | null } | null> {
  const { data: existing, error } = await admin
    .from('customer_satisfaction_survey_templates')
    .select('id, expiry_days, is_default, updated_at')
    .eq('tenant_id', tenantId)
    .eq('survey_type', 'service_request_completion')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (existing && existing.length > 0) return existing[0];

  const plan = planTemplate(DEFAULT_COMPLETION_TEMPLATE);
  if (!plan.ok || !plan.template || !plan.questions) return null;
  const { data: created, error: createError } = await admin
    .from('customer_satisfaction_survey_templates')
    .insert({ ...plan.template, tenant_id: tenantId })
    .select('id, expiry_days')
    .single();
  if (createError) throw createError;

  const { error: questionError } = await admin
    .from('customer_satisfaction_survey_questions')
    .insert(plan.questions.map((q) => ({ ...q, template_id: created.id })));
  if (questionError) {
    // A template with no questions renders an empty survey; remove it so the
    // next completion tries again rather than dispatching blank surveys.
    const { error: cleanupError } = await admin
      .from('customer_satisfaction_survey_templates')
      .delete()
      .eq('id', created.id)
      .eq('tenant_id', tenantId);
    if (cleanupError) console.error('CSAT template cleanup failed:', cleanupError);
    throw questionError;
  }
  return created;
}

export async function dispatchCompletionSurvey(
  admin: Client,
  tenantId: string,
  ticket: { id: string; customer_id?: string | null },
  now: Date = new Date(),
): Promise<DispatchOutcome> {
  try {
    if (!ticket.customer_id) return { created: false, reason: 'ticket has no customer' };

    const { data: prior, error: priorError } = await admin
      .from('customer_satisfaction_surveys')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('related_service_request_id', ticket.id)
      .limit(1);
    if (priorError) throw priorError;
    if (prior && prior.length > 0) return { created: false, reason: 'already surveyed' };

    const template = await completionTemplate(admin, tenantId);
    if (!template) return { created: false, reason: 'no template could be resolved' };

    const plan = planCompletionSurvey({
      tenantId,
      ticket,
      template,
      accessToken: newAccessToken(),
      now,
    });
    if (!plan.ok) return { created: false, reason: plan.reason };

    const { data: survey, error } = await admin
      .from('customer_satisfaction_surveys')
      .insert(plan.row)
      .select('id')
      .single();
    if (error) throw error;
    return { created: true, surveyId: survey.id };
  } catch (err) {
    console.error('CSAT survey not created:', err);
    return { created: false, reason: 'error' };
  }
}
