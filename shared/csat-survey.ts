/**
 * Customer satisfaction survey producer (CSAT-PRODUCER-001, round 180).
 *
 * The portal could already start, answer and score a survey
 * (supabase/functions/customer-portal/handlers/satisfaction.ts), but nothing
 * anywhere CREATED one - no template, no question, no survey row - so every
 * customer's Satisfaction tab was permanently empty and the two dashboards that
 * aggregate CSAT had nothing to aggregate. This is the missing half: what a
 * template must contain, the default one a tenant gets on first use, and the
 * survey row a completed service ticket produces.
 *
 * Dependency-free so the Deno functions import it directly. The vocabularies
 * are the enums migration 0000 created; a value outside them is a 22P02 on
 * insert, so they are validated here rather than discovered there.
 */

export const SURVEY_TYPES = [
  'service_request_completion',
  'maintenance_appointment',
  'supply_delivery',
  'technical_support',
  'general_experience',
  'annual_review',
] as const;

export const QUESTION_TYPES = [
  'rating_scale',
  'yes_no',
  'multiple_choice',
  'text_short',
  'text_long',
  'nps_score',
] as const;

export type SurveyType = (typeof SURVEY_TYPES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface QuestionInput {
  questionText: string;
  questionType: QuestionType;
  isRequired?: boolean;
  category?: string | null;
}

export interface TemplateInput {
  name: string;
  description?: string | null;
  surveyType: SurveyType;
  isDefault?: boolean;
  expiryDays?: number;
  questions: QuestionInput[];
}

/**
 * The template a tenant gets the first time a survey is dispatched and it has
 * none. Three questions and no more: the submit handler scores rating_scale
 * answers into overall_score and the nps_score answer into nps_score, so this
 * is the smallest template that feeds both measurements, plus one free-text
 * answer a service manager actually reads.
 */
export const DEFAULT_COMPLETION_TEMPLATE: TemplateInput = {
  name: 'Service visit follow-up',
  description: 'Sent automatically when a service ticket is completed.',
  surveyType: 'service_request_completion',
  isDefault: true,
  expiryDays: 14,
  questions: [
    {
      questionText: 'How satisfied are you with this service visit?',
      questionType: 'rating_scale',
      isRequired: true,
      category: 'service_quality',
    },
    {
      questionText: 'How likely are you to recommend us to a colleague?',
      questionType: 'nps_score',
      isRequired: false,
      category: 'loyalty',
    },
    {
      questionText: 'Anything we could have done better?',
      questionType: 'text_long',
      isRequired: false,
      category: 'feedback',
    },
  ],
};

export interface TemplatePlan {
  ok: boolean;
  errors: string[];
  template?: Record<string, unknown>;
  questions?: Array<Record<string, unknown>>;
}

/** Validates an authored template and shapes its rows (tenant_id and template_id added by the caller). */
export function planTemplate(input: unknown): TemplatePlan {
  const errors: string[] = [];
  const t = (input ?? {}) as Partial<TemplateInput>;
  const name = typeof t.name === 'string' ? t.name.trim() : '';
  if (!name) errors.push('name is required');
  if (!SURVEY_TYPES.includes(t.surveyType as SurveyType)) {
    errors.push(`surveyType must be one of ${SURVEY_TYPES.join(', ')}`);
  }
  const questions = Array.isArray(t.questions) ? t.questions : [];
  if (questions.length === 0) errors.push('a template needs at least one question');
  questions.forEach((q, i) => {
    const text = typeof q?.questionText === 'string' ? q.questionText.trim() : '';
    if (!text) errors.push(`question ${i + 1}: questionText is required`);
    if (!QUESTION_TYPES.includes(q?.questionType as QuestionType)) {
      errors.push(`question ${i + 1}: questionType must be one of ${QUESTION_TYPES.join(', ')}`);
    }
  });
  const expiry = t.expiryDays ?? 14;
  if (!Number.isInteger(expiry) || expiry < 1 || expiry > 365) {
    errors.push('expiryDays must be a whole number of days between 1 and 365');
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors,
    template: {
      name,
      description: t.description ?? null,
      survey_type: t.surveyType,
      is_active: true,
      is_default: Boolean(t.isDefault),
      expiry_days: expiry,
    },
    questions: questions.map((q, i) => ({
      question_text: q.questionText.trim(),
      question_type: q.questionType,
      is_required: Boolean(q.isRequired),
      order_index: i + 1,
      category: q.category ?? null,
    })),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CompletionSurveyInput {
  tenantId: string;
  ticket: { id: string; customer_id?: string | null };
  template: { id: string; expiry_days?: number | null };
  accessToken: string;
  now: Date;
}

export type CompletionSurveyPlan =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; reason: string };

/**
 * The survey row a completed ticket produces, or why it produces none.
 *
 * customer_id, tenant_id and related_service_request_id are uuid columns, so a
 * non-uuid id (the demo seeder writes some) is a reason to skip rather than an
 * insert that fails. invitation_sent_at stays null: this creates the survey the
 * customer sees in their portal, and it sends no email, so claiming an
 * invitation went out would be a fabricated write.
 */
export function planCompletionSurvey(input: CompletionSurveyInput): CompletionSurveyPlan {
  const customerId = input.ticket.customer_id;
  if (!customerId) return { ok: false, reason: 'ticket has no customer' };
  for (const [label, value] of [
    ['customer', customerId],
    ['tenant', input.tenantId],
    ['ticket', input.ticket.id],
    ['template', input.template.id],
  ] as const) {
    if (!UUID.test(String(value))) return { ok: false, reason: `${label} id is not a uuid` };
  }
  const days = input.template.expiry_days ?? 14;
  return {
    ok: true,
    row: {
      tenant_id: input.tenantId,
      customer_id: customerId,
      template_id: input.template.id,
      survey_type: 'service_request_completion',
      status: 'invited',
      related_service_request_id: input.ticket.id,
      access_token: input.accessToken,
      expires_at: new Date(input.now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

/** A ticket moving INTO completed, not one saved again while already there. */
export function isCompletionTransition(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  return nextStatus === 'completed' && previousStatus !== 'completed';
}
