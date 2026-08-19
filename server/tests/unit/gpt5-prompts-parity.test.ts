// AI-001 parity lock.
//
// /api/ai/gpt5/* runs on Express in dev and on the ai-gpt5 edge function in
// production. Two copies of the prompt text, the model configs and the response
// parser therefore exist:
//
//   server/services/gpt5-service.ts
//   supabase/functions/_shared/gpt5-prompts.ts       (+ crisis-response.ts)
//
// They cannot import each other (Node vs Deno), so this suite imports both and
// asserts identical output. A prompt edit, a model swap or a guardrail change
// that lands in only one file fails here.
import { describe, it, expect } from 'vitest';

import * as node from '../../services/gpt5-service';
import * as edge from '../../../supabase/functions/_shared/gpt5-prompts';
import * as nodeCrisis from '../../lib/crisis-response';
import * as edgeCrisis from '../../../supabase/functions/_shared/crisis-response';

const LEAD = {
  companyName: 'Northgate Dental',
  monthlyVolume: 14000,
  contact: { name: 'R. Alvarez', email: 'r@northgate.example' },
  notes: 'Two aging Ricoh MP C3004s, lease ends in March.',
};
const HISTORY = { priorQuotes: 2, lastServiceCall: '2026-02-11' };

const CUSTOMER = { id: 'c-1', name: 'Northgate Dental', locations: 3 };
const REQUIREMENTS = { colorMfp: 2, bwMfp: 1, finisher: 'staple' };
const PRICING = { unitPrice: 8400, serviceRate: 0.0072 };

const TICKET = { id: 't-9', symptom: 'E-05 fuser jam', model: 'MP C3004' };
const EQUIPMENT_HISTORY = { calls12mo: 6, lastPmDate: '2025-11-02' };

const SALES = { bookedArr: 412000, unitsSold: 37 };
const SERVICE = { ticketsClosed: 288, firstCallFix: 0.81 };

describe('model configs and descriptions match', () => {
  it('GPT5_CONFIGS is identical', () => {
    expect(edge.GPT5_CONFIGS).toEqual(node.GPT5_CONFIGS);
  });

  it('config names are identical and in the same order', () => {
    expect(Object.keys(edge.GPT5_CONFIGS)).toEqual(Object.keys(node.GPT5_CONFIGS));
  });

  it('GPT5_CONFIG_DESCRIPTIONS is identical', () => {
    expect(edge.GPT5_CONFIG_DESCRIPTIONS).toEqual(node.GPT5_CONFIG_DESCRIPTIONS);
  });

  it('every config has a description', () => {
    for (const name of Object.keys(node.GPT5_CONFIGS)) {
      expect(node.GPT5_CONFIG_DESCRIPTIONS[name as keyof typeof node.GPT5_CONFIGS]).toBeTruthy();
    }
  });
});

describe('crisis guardrail copies match', () => {
  it('CRISIS_SYSTEM_DIRECTIVE is identical', () => {
    expect(edgeCrisis.CRISIS_SYSTEM_DIRECTIVE).toBe(nodeCrisis.CRISIS_SYSTEM_DIRECTIVE);
  });

  it('CRISIS_RESOURCES_US is identical', () => {
    expect(edgeCrisis.CRISIS_RESOURCES_US).toEqual(nodeCrisis.CRISIS_RESOURCES_US);
  });

  it('crisisResponse() is identical', () => {
    expect(edgeCrisis.crisisResponse()).toBe(nodeCrisis.crisisResponse());
  });

  it.each([
    'kill myself',
    'i want to die',
    'thinking about self-harm',
    'the copier is killing our budget',
    'we need to end it all with this vendor',
    '',
    '   ',
    'please reset the meter on unit 4',
  ])('detectsCrisis(%j) agrees', (text) => {
    expect(edgeCrisis.detectsCrisis(text)).toBe(nodeCrisis.detectsCrisis(text));
  });

  it('withCrisisGuardrail agrees and stays idempotent', () => {
    const base = 'You are a helpful customer support representative for a copier dealer.';
    const once = nodeCrisis.withCrisisGuardrail(base);
    expect(edgeCrisis.withCrisisGuardrail(base)).toBe(once);
    expect(edgeCrisis.withCrisisGuardrail(once)).toBe(once);
    expect(nodeCrisis.withCrisisGuardrail(once)).toBe(once);
  });
});

describe('prompt builders produce byte-identical text', () => {
  it('lead analysis, with and without history', () => {
    expect(edge.buildLeadAnalysisPrompt(LEAD, HISTORY)).toBe(
      node.buildLeadAnalysisPrompt(LEAD, HISTORY),
    );
    expect(edge.buildLeadAnalysisPrompt(LEAD)).toBe(node.buildLeadAnalysisPrompt(LEAD));
    expect(edge.buildLeadAnalysisPrompt(LEAD, undefined)).toBe(
      node.buildLeadAnalysisPrompt(LEAD, undefined),
    );
  });

  it('proposal', () => {
    expect(edge.buildProposalPrompt(CUSTOMER, REQUIREMENTS, PRICING)).toBe(
      node.buildProposalPrompt(CUSTOMER, REQUIREMENTS, PRICING),
    );
  });

  it('service analysis, with and without equipment history', () => {
    expect(edge.buildServiceAnalysisPrompt(TICKET, EQUIPMENT_HISTORY)).toBe(
      node.buildServiceAnalysisPrompt(TICKET, EQUIPMENT_HISTORY),
    );
    expect(edge.buildServiceAnalysisPrompt(TICKET)).toBe(node.buildServiceAnalysisPrompt(TICKET));
  });

  it('support response, with and without context', () => {
    const q = 'Our color output has vertical banding since Tuesday.';
    expect(edge.buildSupportResponsePrompt(q, CUSTOMER)).toBe(
      node.buildSupportResponsePrompt(q, CUSTOMER),
    );
    expect(edge.buildSupportResponsePrompt(q)).toBe(node.buildSupportResponsePrompt(q));
  });

  it('support response carries the crisis directive', () => {
    const prompt = node.buildSupportResponsePrompt('hi');
    expect(prompt).toContain('988 Suicide & Crisis Lifeline');
    expect(edge.buildSupportResponsePrompt('hi')).toContain('988 Suicide & Crisis Lifeline');
  });

  it('business analytics', () => {
    expect(edge.buildBusinessAnalyticsPrompt(SALES, SERVICE, 'Q1 2026')).toBe(
      node.buildBusinessAnalyticsPrompt(SALES, SERVICE, 'Q1 2026'),
    );
  });

  it('inquiry classification', () => {
    const inquiry = 'Do you lease refurbished units?';
    expect(edge.buildInquiryClassificationPrompt(inquiry)).toBe(
      node.buildInquiryClassificationPrompt(inquiry),
    );
  });

  it.each(['javascript', 'python', 'sql'] as const)('automation code (%s)', (codeType) => {
    const req = 'Nightly sync of meter reads into the billing table.';
    expect(edge.buildAutomationCodePrompt(req, codeType)).toBe(
      node.buildAutomationCodePrompt(req, codeType),
    );
  });
});

describe('buildResponsesRequest', () => {
  it('matches across copies', () => {
    expect(edge.buildResponsesRequest('hello', edge.GPT5_CONFIGS.CLASSIFICATION)).toEqual(
      node.buildResponsesRequest('hello', node.GPT5_CONFIGS.CLASSIFICATION),
    );
  });

  it('carries model, input, reasoning and verbosity', () => {
    const body = node.buildResponsesRequest('hello', node.GPT5_CONFIGS.PROPOSAL_GENERATION);
    expect(body.model).toBe('gpt-5');
    expect(body.input).toBe('hello');
    expect(body.reasoning).toEqual({ effort: 'high' });
    expect(body.text).toEqual({ verbosity: 'high' });
  });

  it('omits previous_response_id unless one is given', () => {
    expect(
      'previous_response_id' in node.buildResponsesRequest('x', node.GPT5_CONFIGS.LEAD_ANALYSIS),
    ).toBe(false);
    expect(
      node.buildResponsesRequest('x', node.GPT5_CONFIGS.LEAD_ANALYSIS, 'resp_42')
        .previous_response_id,
    ).toBe('resp_42');
    expect(edge.buildResponsesRequest('x', edge.GPT5_CONFIGS.LEAD_ANALYSIS, 'resp_42')).toEqual(
      node.buildResponsesRequest('x', node.GPT5_CONFIGS.LEAD_ANALYSIS, 'resp_42'),
    );
  });
});

describe('extractResponseText', () => {
  // The bug this replaced: `response.output?.content` on an ARRAY is undefined,
  // so every endpoint returned an empty string even on a successful call.
  const REST_SHAPE = {
    id: 'resp_1',
    output: [
      { type: 'reasoning', summary: [] },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Qualification score: 8/10.' }],
      },
    ],
  };

  it('reads the assistant text out of the raw REST payload', () => {
    expect(node.extractResponseText(REST_SHAPE)).toBe('Qualification score: 8/10.');
    expect(edge.extractResponseText(REST_SHAPE)).toBe('Qualification score: 8/10.');
  });

  it('does not return an empty string for a well-formed response', () => {
    expect(node.extractResponseText(REST_SHAPE)).not.toBe('');
  });

  it('skips reasoning items and concatenates multiple text chunks', () => {
    const multi = {
      output: [
        { type: 'reasoning', summary: ['thinking'] },
        { type: 'message', content: [{ type: 'output_text', text: 'part one ' }] },
        { type: 'message', content: [{ type: 'output_text', text: 'part two' }] },
      ],
    };
    expect(node.extractResponseText(multi)).toBe('part one part two');
    expect(edge.extractResponseText(multi)).toBe('part one part two');
  });

  it('prefers the SDK output_text convenience property when present', () => {
    const sdkShape = { output_text: 'flattened', output: [{ content: [{ text: 'walked' }] }] };
    expect(node.extractResponseText(sdkShape)).toBe('flattened');
    expect(edge.extractResponseText(sdkShape)).toBe('flattened');
  });

  it('falls back to the array walk when output_text is empty', () => {
    const sdkShape = { output_text: '', output: [{ content: [{ text: 'walked' }] }] };
    expect(node.extractResponseText(sdkShape)).toBe('walked');
    expect(edge.extractResponseText(sdkShape)).toBe('walked');
  });

  it.each([
    [null, ''],
    [undefined, ''],
    [{}, ''],
    [{ output: [] }, ''],
    [{ output: 'plain string' }, 'plain string'],
    [{ output: { content: 'legacy object' } }, 'legacy object'],
    [{ output: [{ content: 'string content' }] }, 'string content'],
    [{ output: [{ type: 'reasoning', summary: ['no content key'] }] }, ''],
  ])('handles %j', (input, expected) => {
    expect(node.extractResponseText(input)).toBe(expected);
    expect(edge.extractResponseText(input)).toBe(expected);
  });
});
