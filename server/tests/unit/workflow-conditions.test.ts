// Workflow trigger conditions: whether an automation runs at all.
//
// Locked here because the rule is subtle in three places that a reader would
// reasonably guess wrong - the empty case fires rather than blocks, the chain
// is a running fold with no operator precedence, and an unknown operator fails
// CLOSED. These gate automations that send email and create supply orders, so
// each direction of error has a cost: firing when it should not spends money,
// not firing when it should is the silent kind.
import { describe, it, expect } from 'vitest';
import {
  evaluateConditions,
  evaluateOne,
  conditionFromRow,
  type WorkflowCondition,
} from '../../../supabase/functions/_shared/workflow-conditions';

function cond(over: Partial<WorkflowCondition> = {}): WorkflowCondition {
  return {
    conditionGroup: 'default',
    logicalOperator: 'AND',
    leftOperand: 'deal.amount',
    operator: 'equals',
    rightOperand: '100',
    dataType: null,
    orderIndex: 0,
    ...over,
  };
}

describe('evaluateConditions - the empty case', () => {
  it('fires when there are no conditions', () => {
    // An unconditional trigger is the common case; treating empty as "never"
    // would make every plain event trigger inert.
    expect(evaluateConditions([], {})).toBe(true);
    expect(evaluateConditions(null, {})).toBe(true);
    expect(evaluateConditions(undefined, {})).toBe(true);
  });
});

describe('evaluateOne - operand resolution', () => {
  const payload = { deal: { amount: 100, stage: 'won', owner: null }, count: 5 };

  it('reads a dotted path out of the payload', () => {
    expect(evaluateOne(cond({ leftOperand: 'deal.stage', rightOperand: 'won' }), payload)).toBe(
      true,
    );
  });

  it('falls back to treating the left operand as a literal when the path misses', () => {
    // This is what lets a condition compare two constants; without it a typo'd
    // path would silently compare undefined.
    expect(
      evaluateOne(
        cond({ leftOperand: 'closed', operator: 'equals', rightOperand: 'closed' }),
        payload,
      ),
    ).toBe(true);
  });

  it('compares loosely, so a numeric payload matches a varchar operand', () => {
    // rightOperand is a varchar column; requiring dataType: 'number' for every
    // numeric comparison would break existing rows.
    expect(evaluateOne(cond({ leftOperand: 'deal.amount', rightOperand: '100' }), payload)).toBe(
      true,
    );
  });

  it('is_null tests the RAW value, not the literal fallback', () => {
    // The fallback makes a missing path resolve to its own name, so testing the
    // coerced value would report every missing field as present.
    expect(evaluateOne(cond({ leftOperand: 'deal.owner', operator: 'is_null' }), payload)).toBe(
      true,
    );
    expect(evaluateOne(cond({ leftOperand: 'deal.nothing', operator: 'is_null' }), payload)).toBe(
      true,
    );
    expect(evaluateOne(cond({ leftOperand: 'deal.stage', operator: 'is_not_null' }), payload)).toBe(
      true,
    );
  });
});

describe('evaluateOne - operators', () => {
  const payload = { n: 5, s: 'Acme Corporation', t: '2026-06-01' };

  it.each([
    ['equals matches', { leftOperand: 'n', operator: 'equals', rightOperand: '5' }, true],
    ['not_equals', { leftOperand: 'n', operator: 'not_equals', rightOperand: '6' }, true],
    ['greater_than', { leftOperand: 'n', operator: 'greater_than', rightOperand: '4' }, true],
    [
      'greater_than at the boundary',
      { leftOperand: 'n', operator: 'greater_than', rightOperand: '5' },
      false,
    ],
    [
      'greater_than_or_equal at the boundary',
      { leftOperand: 'n', operator: 'greater_than_or_equal', rightOperand: '5' },
      true,
    ],
    ['less_than', { leftOperand: 'n', operator: 'less_than', rightOperand: '6' }, true],
    [
      'less_than_or_equal at the boundary',
      { leftOperand: 'n', operator: 'less_than_or_equal', rightOperand: '5' },
      true,
    ],
    ['contains', { leftOperand: 's', operator: 'contains', rightOperand: 'Corp' }, true],
    ['not_contains', { leftOperand: 's', operator: 'not_contains', rightOperand: 'Ltd' }, true],
    ['starts_with', { leftOperand: 's', operator: 'starts_with', rightOperand: 'Acme' }, true],
    ['ends_with', { leftOperand: 's', operator: 'ends_with', rightOperand: 'ation' }, true],
    ['matches_regex', { leftOperand: 's', operator: 'matches_regex', rightOperand: '^Acme' }, true],
  ])('%s', (_label, over, expected) => {
    expect(evaluateOne(cond(over as Partial<WorkflowCondition>), payload)).toBe(expected);
  });

  it('in/not_in split a comma list and trim it', () => {
    // Operators are authored by hand in a UI, so " won , lost " is realistic.
    const inList = cond({ leftOperand: 'n', operator: 'in', rightOperand: '3, 5 ,7' });
    expect(evaluateOne(inList, payload)).toBe(true);
    expect(evaluateOne({ ...inList, operator: 'not_in' }, payload)).toBe(false);
    expect(evaluateOne({ ...inList, rightOperand: '1,2' }, payload)).toBe(false);
  });

  it('an unparseable regex does not fire', () => {
    expect(
      evaluateOne(
        cond({ leftOperand: 's', operator: 'matches_regex', rightOperand: '([' }),
        payload,
      ),
    ).toBe(false);
  });

  it('an unknown operator does not fire', () => {
    // Fails closed. A typo'd or newly-added operator must not enrol every event
    // into an automation that spends money.
    expect(evaluateOne(cond({ operator: 'is_roughly' }), payload)).toBe(false);
    expect(evaluateOne(cond({ operator: '' }), payload)).toBe(false);
  });
});

describe('evaluateOne - dataType coercion', () => {
  it('number compares numerically rather than as strings', () => {
    // '9' > '10' as strings; 9 > 10 is false. Without the coercion an amount
    // threshold would be wrong for exactly the values that matter.
    const payload = { amount: 9 };
    const c = cond({
      leftOperand: 'amount',
      operator: 'greater_than',
      rightOperand: '10',
      dataType: 'number',
    });
    expect(evaluateOne(c, payload)).toBe(false);
  });

  it('boolean accepts the spellings a form actually submits', () => {
    for (const raw of [true, 'true', 1, '1']) {
      expect(
        evaluateOne(
          cond({
            leftOperand: 'flag',
            operator: 'equals',
            rightOperand: 'true',
            dataType: 'boolean',
          }),
          { flag: raw },
        ),
      ).toBe(true);
    }
    expect(
      evaluateOne(
        cond({
          leftOperand: 'flag',
          operator: 'equals',
          rightOperand: 'true',
          dataType: 'boolean',
        }),
        { flag: 'no' },
      ),
    ).toBe(false);
  });

  it('date compares as a timestamp, not as text', () => {
    const c = cond({
      leftOperand: 'when',
      operator: 'greater_than',
      rightOperand: '2026-01-01',
      dataType: 'date',
    });
    expect(evaluateOne(c, { when: '2026-06-01' })).toBe(true);
    expect(evaluateOne(c, { when: '2025-06-01' })).toBe(false);
  });
});

describe('evaluateConditions - chaining', () => {
  const payload = { a: 1, b: 2 };
  const eq = (field: string, value: string, over: Partial<WorkflowCondition> = {}) =>
    cond({ leftOperand: field, operator: 'equals', rightOperand: value, ...over });

  it('ANDs within a group', () => {
    expect(
      evaluateConditions(
        [eq('a', '1', { orderIndex: 0 }), eq('b', '2', { orderIndex: 1 })],
        payload,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        [eq('a', '1', { orderIndex: 0 }), eq('b', '9', { orderIndex: 1 })],
        payload,
      ),
    ).toBe(false);
  });

  it('ORs within a group when the condition says so', () => {
    expect(
      evaluateConditions(
        [eq('a', '9', { orderIndex: 0 }), eq('b', '2', { orderIndex: 1, logicalOperator: 'OR' })],
        payload,
      ),
    ).toBe(true);
  });

  it('folds left to right with no operator precedence', () => {
    // A AND B OR C is ((A AND B) OR C), not A AND (B OR C). The distinction is
    // invisible until a rule mixes them, and then it silently fires or does not.
    const a = eq('a', '9', { orderIndex: 0 });
    const b = eq('b', '9', { orderIndex: 1, logicalOperator: 'AND' });
    const c = eq('a', '1', { orderIndex: 2, logicalOperator: 'OR' });
    expect(evaluateConditions([a, b, c], payload)).toBe(true);
  });

  it("ignores the FIRST condition's operator, since nothing sits to its left", () => {
    const first = eq('a', '1', { orderIndex: 0, logicalOperator: 'OR' });
    expect(evaluateConditions([first], payload)).toBe(true);
  });

  it('NOT negates its own condition, then combines as AND', () => {
    const a = eq('a', '1', { orderIndex: 0 });
    const notB = eq('b', '9', { orderIndex: 1, logicalOperator: 'NOT' });
    expect(evaluateConditions([a, notB], payload)).toBe(true);

    const notA = eq('a', '1', { orderIndex: 0, logicalOperator: 'NOT' });
    expect(evaluateConditions([notA], payload)).toBe(false);
  });

  it('sorts by orderIndex rather than trusting the fetch order', () => {
    // Conditions come back from PostgREST without an ORDER BY guarantee, and
    // the fold is order-dependent.
    const a = eq('a', '9', { orderIndex: 0 });
    const b = eq('b', '2', { orderIndex: 1, logicalOperator: 'OR' });
    expect(evaluateConditions([b, a], payload)).toBe(evaluateConditions([a, b], payload));
  });

  it('ORs separate groups together', () => {
    const g1 = eq('a', '9', { conditionGroup: 'g1', orderIndex: 0 });
    const g2 = eq('b', '2', { conditionGroup: 'g2', orderIndex: 0 });
    expect(evaluateConditions([g1, g2], payload)).toBe(true);
    expect(evaluateConditions([g1, { ...g2, rightOperand: '9' }], payload)).toBe(false);
  });

  it('treats a null group as the default group, not as its own', () => {
    // Otherwise two ANDed conditions saved without a group would be OR'd.
    const a = eq('a', '1', { conditionGroup: null, orderIndex: 0 });
    const b = eq('b', '9', { conditionGroup: null, orderIndex: 1 });
    expect(evaluateConditions([a, b], payload)).toBe(false);
  });
});

describe('conditionFromRow', () => {
  it('maps a PostgREST row and defaults the operator to AND', () => {
    expect(
      conditionFromRow({
        condition_group: 'g1',
        logical_operator: null,
        left_operand: 'deal.stage',
        operator: 'equals',
        right_operand: 'won',
        data_type: null,
        order_index: 3,
      }),
    ).toEqual({
      conditionGroup: 'g1',
      logicalOperator: 'AND',
      leftOperand: 'deal.stage',
      operator: 'equals',
      rightOperand: 'won',
      dataType: null,
      orderIndex: 3,
    });
  });
});
