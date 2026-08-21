// Locks the two copies of workflow trigger-condition evaluation together.
//
// server/services/workflow-runtime.ts (Node) and
// supabase/functions/_shared/workflow-conditions.ts (Deno) each own a copy.
// Unlike the renewal-retier and email-autopilot cases retired in PROD-008b,
// NEITHER of these is a fossil: the edge copy backs the event seams ported in
// CRMX-008a, and the Node copy is still reached from the web-form processor,
// which dispatches form.submitted from an interval loop rather than from a
// route. So both can run, and a drift would mean the same trigger conditions
// decide differently depending on which path fired the event.
//
// Following the mirror + parity convention this codebase already uses for
// gpt5-prompts, renewal-analysis, supply-analysis and document-html - server
// sources do not import out of supabase/functions/.
import { describe, it, expect } from 'vitest';
import { evaluateConditions as nodeEvaluate } from '../../services/workflow-runtime';
import {
  evaluateConditions as edgeEvaluate,
  type WorkflowCondition,
} from '../../../supabase/functions/_shared/workflow-conditions';

function cond(over: Partial<WorkflowCondition> = {}): WorkflowCondition {
  return {
    conditionGroup: 'default',
    logicalOperator: 'AND',
    leftOperand: 'amount',
    operator: 'equals',
    rightOperand: '100',
    dataType: null,
    orderIndex: 0,
    ...over,
  };
}

const PAYLOADS: Array<[string, Record<string, unknown>]> = [
  ['empty', {}],
  ['flat', { amount: 100, stage: 'won', flag: true }],
  ['nested', { deal: { amount: 100, stage: 'won', owner: null } }],
  ['null-valued', { amount: null, stage: null }],
  ['string numerics', { amount: '100', n: '9' }],
];

const CONDITION_SETS: Array<[string, WorkflowCondition[]]> = [
  ['no conditions', []],
  ['equals', [cond()]],
  ['nested path', [cond({ leftOperand: 'deal.stage', operator: 'equals', rightOperand: 'won' })]],
  [
    'missing path falls back to a literal',
    [cond({ leftOperand: 'closed', rightOperand: 'closed' })],
  ],
  ['is_null', [cond({ leftOperand: 'deal.owner', operator: 'is_null' })]],
  ['is_not_null', [cond({ leftOperand: 'amount', operator: 'is_not_null' })]],
  [
    'numeric coercion',
    [cond({ leftOperand: 'n', operator: 'greater_than', rightOperand: '10', dataType: 'number' })],
  ],
  ['boolean coercion', [cond({ leftOperand: 'flag', rightOperand: 'true', dataType: 'boolean' })]],
  ['contains', [cond({ leftOperand: 'stage', operator: 'contains', rightOperand: 'on' })]],
  [
    'in with padding',
    [cond({ leftOperand: 'amount', operator: 'in', rightOperand: ' 50 , 100 ' })],
  ],
  ['not_in', [cond({ leftOperand: 'amount', operator: 'not_in', rightOperand: '1,2' })]],
  ['bad regex', [cond({ leftOperand: 'stage', operator: 'matches_regex', rightOperand: '([' })]],
  ['unknown operator', [cond({ operator: 'is_roughly' })]],
  [
    'AND chain',
    [cond({ orderIndex: 0 }), cond({ leftOperand: 'stage', rightOperand: 'won', orderIndex: 1 })],
  ],
  [
    'OR chain',
    [
      cond({ rightOperand: '999', orderIndex: 0 }),
      cond({ leftOperand: 'stage', rightOperand: 'won', orderIndex: 1, logicalOperator: 'OR' }),
    ],
  ],
  [
    'AND then OR, no precedence',
    [
      cond({ rightOperand: '999', orderIndex: 0 }),
      cond({ rightOperand: '888', orderIndex: 1, logicalOperator: 'AND' }),
      cond({ orderIndex: 2, logicalOperator: 'OR' }),
    ],
  ],
  ['NOT', [cond({ rightOperand: '999', logicalOperator: 'NOT' })]],
  [
    'two groups',
    [
      cond({ conditionGroup: 'g1', rightOperand: '999', orderIndex: 0 }),
      cond({ conditionGroup: 'g2', leftOperand: 'stage', rightOperand: 'won', orderIndex: 0 }),
    ],
  ],
  [
    'null group is the default group',
    [
      cond({ conditionGroup: null, orderIndex: 0 }),
      cond({ conditionGroup: null, rightOperand: '999', orderIndex: 1 }),
    ],
  ],
  [
    'reversed fetch order',
    [
      cond({ leftOperand: 'stage', rightOperand: 'won', orderIndex: 1, logicalOperator: 'OR' }),
      cond({ rightOperand: '999', orderIndex: 0 }),
    ],
  ],
];

describe('workflow condition evaluation parity', () => {
  for (const [condLabel, conditions] of CONDITION_SETS) {
    for (const [payloadLabel, payload] of PAYLOADS) {
      it(`${condLabel} / ${payloadLabel} payload agrees`, () => {
        expect(edgeEvaluate(conditions, payload)).toBe(
          nodeEvaluate(conditions as never, payload as never),
        );
      });
    }
  }
});
