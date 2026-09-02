/**
 * The deal desk can hold a rule and take a request (AUDIT-037).
 *
 * Eighteen of its column references were not columns, split evenly: creating an
 * approval RULE 42703'd, and so did submitting a REQUEST. So the deal desk had
 * nothing to match against and nowhere to put a submission - the whole feature
 * was inert, on a table set (shared/deal-desk-schema.ts) that is real and
 * detailed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
// Both sides strip comments: the file now explains the old names in prose.
const src = read('supabase/functions/deal-desk/index.ts')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('approval rules use the declared column names', () => {
  it('writes rule_name, comparison_operator and approval_chain_type', () => {
    expect(src).toMatch(/rule_name: body\.name/);
    expect(src).toMatch(/comparison_operator: body\.thresholdOperator/);
    expect(src).toMatch(/approval_chain_type: body\.approvalMode/);
  });

  it('folds approver_role_ids into approvers rather than keeping two names', () => {
    expect(src).not.toMatch(/approver_role_ids/);
    expect(src).toMatch(/approvers: body\.approvers \|\| body\.approverRoleIds/);
  });

  it('drops the two policy flags nothing stores, and says it did', () => {
    // auto_approve_below_threshold would silently approve discounts if it were
    // ever honoured; inventing a column would be inventing the behaviour.
    expect(src).not.toMatch(/auto_approve_below_threshold/);
    expect(src).not.toMatch(/requires_justification/);
    // A caller that sends them is told they were ignored.
    expect(src).toMatch(/ignoredRuleFields/);
  });
});

describe('approval requests use the declared column names', () => {
  it('writes original_price, proposed_price and business_justification', () => {
    expect(src).toMatch(/original_price: body\.originalValue/);
    expect(src).toMatch(/proposed_price: body\.requestedValue/);
    expect(src).toMatch(/business_justification: body\.justification/);
  });

  it('tracks the step on current_approval_level and the SLA on sla_deadline', () => {
    expect(src).toMatch(/current_approval_level: 1/);
    expect(src).toMatch(/sla_deadline: body\.slaDueAt/);
    // As COLUMN keys. Both still appear as accepted request-body aliases, which
    // is what lets an existing caller keep working.
    expect(src).not.toMatch(/current_step:/);
    expect(src).not.toMatch(/sla_due_at:/);
    expect(src).toMatch(/body\.sla_due_at/);
  });

  it('keeps one copy of the chain, not a chain and a step count', () => {
    // approval_chain's length IS the step count; a second copy invites the two
    // to disagree.
    expect(src).toMatch(/approval_chain: body\.approvalChain/);
    expect(src).not.toMatch(/total_steps/);
  });

  it('records the decision comment on final_decision_comments', () => {
    expect(src).toMatch(/final_decision_comments/);
    expect(src).not.toMatch(/final_comments/);
  });
});

describe('the backlog is ordered by reachability, not by size', () => {
  it('the guard note says not to work the list top-down', () => {
    // Half the remaining entries are in edge functions nothing calls, where a
    // phantom column cannot hurt anyone.
    const baseline = JSON.parse(read('docs/phantom-columns-baseline.json'));
    expect(baseline.note).toMatch(/DO NOT WORK THIS LIST TOP-DOWN/);
    expect(baseline.note).toMatch(/unreferenced-edge-fns-baseline\.json/);
  });
});
