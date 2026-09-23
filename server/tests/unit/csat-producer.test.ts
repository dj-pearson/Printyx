// CSAT-PRODUCER-001 (round 180). Nothing created a satisfaction survey, a
// template or a question, so the portal's Satisfaction tab was permanently
// empty. A completed service ticket now creates one, from the tenant's default
// template (created on first use), and a manager can author templates.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_COMPLETION_TEMPLATE,
  QUESTION_TYPES,
  SURVEY_TYPES,
  isCompletionTransition,
  planCompletionSurvey,
  planTemplate,
} from '@shared/csat-survey';
import { dispatchCompletionSurvey } from '../../../supabase/functions/_shared/csat-dispatch';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const UUID_D = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-09-23T12:00:00Z');

describe('the vocabularies match the enums migration 0000 created', () => {
  const sql = readFileSync('drizzle/migrations/0000_fuzzy_blizzard.sql', 'utf8');
  const enumOf = (name: string) => {
    const m = sql.match(new RegExp(`CREATE TYPE "public"\\."${name}" AS ENUM\\(([^)]*)\\)`));
    expect(m, name).not.toBeNull();
    return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  it('survey types', () => expect([...SURVEY_TYPES]).toEqual(enumOf('satisfaction_survey_type')));
  it('question types', () =>
    expect([...QUESTION_TYPES]).toEqual(enumOf('satisfaction_question_type')));
});

describe('planTemplate', () => {
  it('accepts the default template and orders its questions', () => {
    const plan = planTemplate(DEFAULT_COMPLETION_TEMPLATE);
    expect(plan.ok).toBe(true);
    expect(plan.questions!.map((q) => q.order_index)).toEqual([1, 2, 3]);
    expect(plan.template!.survey_type).toBe('service_request_completion');
  });

  it('feeds both scores the submit handler computes', () => {
    const types = DEFAULT_COMPLETION_TEMPLATE.questions.map((q) => q.questionType);
    expect(types).toContain('rating_scale');
    expect(types).toContain('nps_score');
  });

  it('refuses a template with no questions, an unknown type or no name', () => {
    expect(
      planTemplate({ name: 'x', surveyType: 'service_request_completion', questions: [] }).ok,
    ).toBe(false);
    expect(
      planTemplate({
        name: 'x',
        surveyType: 'service_request_completion',
        questions: [{ questionText: 'q', questionType: 'stars' }],
      }).errors,
    ).toEqual([expect.stringContaining('question 1: questionType')]);
    expect(planTemplate({ name: '  ', surveyType: 'nope', questions: [] }).errors.length).toBe(3);
  });
});

describe('planCompletionSurvey', () => {
  const base = {
    tenantId: UUID_A,
    ticket: { id: UUID_B, customer_id: UUID_C },
    template: { id: UUID_D, expiry_days: 14 },
    accessToken: 'tok',
    now: NOW,
  };

  it('produces an invited survey tied to the ticket, expiring after the template window', () => {
    const plan = planCompletionSurvey(base);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.row).toMatchObject({
      tenant_id: UUID_A,
      customer_id: UUID_C,
      template_id: UUID_D,
      status: 'invited',
      related_service_request_id: UUID_B,
      expires_at: '2026-10-07T12:00:00.000Z',
    });
  });

  it('does not claim an invitation was sent', () => {
    const plan = planCompletionSurvey(base);
    expect(plan.ok && 'invitation_sent_at' in plan.row).toBe(false);
  });

  it('skips a ticket with no customer, and one whose ids cannot be stored in uuid columns', () => {
    expect(planCompletionSurvey({ ...base, ticket: { id: UUID_B } })).toEqual({
      ok: false,
      reason: 'ticket has no customer',
    });
    expect(
      planCompletionSurvey({ ...base, ticket: { id: UUID_B, customer_id: 'cust-demo-001' } }),
    ).toEqual({ ok: false, reason: 'customer id is not a uuid' });
  });
});

describe('isCompletionTransition', () => {
  it('fires on the move into completed, not on a re-save', () => {
    expect(isCompletionTransition('in_progress', 'completed')).toBe(true);
    expect(isCompletionTransition('completed', 'completed')).toBe(false);
    expect(isCompletionTransition('open', 'on_hold')).toBe(false);
  });
});

/** A PostgREST-shaped stub that records inserts and answers from `rows`. */
function stub(rows: Record<string, unknown[]>, opts: { failInsertOn?: string } = {}) {
  const inserts: Array<{ table: string; value: unknown }> = [];
  const client = {
    from(table: string) {
      let pending: unknown = null;
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: async () => ({ data: rows[table] ?? [], error: null }),
        insert: (value: unknown) => {
          pending = value;
          inserts.push({ table, value });
          if (opts.failInsertOn === table) {
            return {
              select: () => ({ single: async () => ({ data: null, error: { message: 'boom' } }) }),
              then: (r: any) => r({ error: { message: 'boom' } }),
            };
          }
          return {
            select: () => ({
              single: async () => ({ data: { id: UUID_D, expiry_days: 14 }, error: null }),
            }),
            then: (r: any) => r({ error: null }),
          };
        },
        delete: () => chain,
      };
      void pending;
      return chain;
    },
  };
  return { client, inserts };
}

describe('dispatchCompletionSurvey', () => {
  const ticket = { id: UUID_B, customer_id: UUID_C };

  it('creates the default template and its questions on first use, then the survey', async () => {
    const { client, inserts } = stub({});
    const outcome = await dispatchCompletionSurvey(client, UUID_A, ticket, NOW);
    expect(outcome.created).toBe(true);
    expect(inserts.map((i) => i.table)).toEqual([
      'customer_satisfaction_survey_templates',
      'customer_satisfaction_survey_questions',
      'customer_satisfaction_surveys',
    ]);
  });

  it('reuses an existing template', async () => {
    const { client, inserts } = stub({
      customer_satisfaction_survey_templates: [{ id: UUID_D, expiry_days: 7 }],
    });
    expect((await dispatchCompletionSurvey(client, UUID_A, ticket, NOW)).created).toBe(true);
    expect(inserts.map((i) => i.table)).toEqual(['customer_satisfaction_surveys']);
  });

  it('does not survey the same ticket twice', async () => {
    const { client, inserts } = stub({ customer_satisfaction_surveys: [{ id: 'x' }] });
    expect(await dispatchCompletionSurvey(client, UUID_A, ticket, NOW)).toEqual({
      created: false,
      reason: 'already surveyed',
    });
    expect(inserts).toEqual([]);
  });

  it('never throws, so a ticket completion cannot fail on it', async () => {
    const { client } = stub(
      { customer_satisfaction_survey_templates: [{ id: UUID_D, expiry_days: 7 }] },
      { failInsertOn: 'customer_satisfaction_surveys' },
    );
    await expect(dispatchCompletionSurvey(client, UUID_A, ticket, NOW)).resolves.toEqual({
      created: false,
      reason: 'error',
    });
  });
});

describe('wiring', () => {
  it('the service-tickets PATCH dispatches on a completion transition, after the save', () => {
    const src = strip(readFileSync('supabase/functions/service-tickets/index.ts', 'utf8'));
    const at = src.indexOf('if (isCompletionTransition(currentTicket?.status, ticket?.status))');
    const save = src.indexOf(".from('service_tickets')\n        .update(updateData)");
    expect(at).toBeGreaterThan(0);
    expect(save).toBeGreaterThan(0);
    expect(at).toBeGreaterThan(save);
    expect(src.slice(at, at + 200)).toMatch(/dispatchCompletionSurvey\(admin, tenantId, ticket\)/);
  });

  it('template authoring is routed and needs a manager to write', () => {
    const index = strip(readFileSync('supabase/functions/customer-success/index.ts', 'utf8'));
    expect(index).toMatch(
      /case 'satisfaction-templates':\s*result = await handleSatisfactionTemplates/,
    );
    const h = strip(
      readFileSync(
        'supabase/functions/customer-success/handlers/satisfaction-templates.ts',
        'utf8',
      ),
    );
    const post = h.slice(h.indexOf("if (method === 'POST')"));
    expect(post.indexOf('requireRoleLevel(auth, ROLE_LEVEL.MANAGER)')).toBeGreaterThan(-1);
    expect(post.indexOf('requireRoleLevel')).toBeLessThan(post.indexOf('.insert('));
  });
});
