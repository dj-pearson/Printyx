// SEC-EDGE-001: an approval queue a rep can complete alone is a formality.
//
// `POST /deal-desk/requests/:id/decision` wrote `final_decision_by: user.id`
// and moved the request to `approved` with NO check that the caller was an
// approver and no check that they were not the requester. The quote guardrails
// (QUOTE-006/016) route exactly the discounts that are over policy into this
// queue, so a rep could raise the request the policy demanded and grant it
// themselves in the next call.
//
// Nothing typechecks the edge tree, so this reads the source - the same tool
// server/tests/unit/inbound-webhook-ordering.test.ts uses for a property that
// is invisible to tsc. ORDER IS PART OF THE PROPERTY: a refusal that runs
// after the update has already happened is not a refusal.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SOURCE = readFileSync(join(process.cwd(), 'supabase/functions/deal-desk/index.ts'), 'utf8');

/** Comments explain the control; they are not the control (COP-E02's rule). */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const decisionBranch = (() => {
  const start = CODE.indexOf("action === 'decision'");
  expect(start).toBeGreaterThan(0);
  // To the next TOP-LEVEL branch (four-space indent). Searching for a bare
  // `if (req.method ===` cut the slice short on a nested one and hid the
  // audit-trail assertion below.
  const end = CODE.indexOf('\n    if (req.method ===', start + 50);
  return CODE.slice(start, end > 0 ? end : undefined);
})();

describe('deciding an approval request', () => {
  it('requires a manager role', () => {
    expect(decisionBranch).toMatch(/requireRoleLevel\(/);
    expect(decisionBranch).toMatch(/ROLE_LEVEL\.MANAGER/);
  });

  it('REFUSES the requester, whatever their rank', () => {
    // A manager approving their own discount is still self-approval, so the
    // role gate alone does not close this.
    expect(decisionBranch).toMatch(/request\.requested_by === user\.id/);
    expect(decisionBranch).toMatch(/SELF_APPROVAL_REFUSED/);
  });

  it('refuses BEFORE it writes, not after', () => {
    const refusal = decisionBranch.indexOf('SELF_APPROVAL_REFUSED');
    const write = decisionBranch.indexOf('.update(');
    expect(refusal).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(0);
    expect(refusal).toBeLessThan(write);
  });

  it('answers 403, not 400 — this is an authorisation refusal', () => {
    const idx = decisionBranch.indexOf('SELF_APPROVAL_REFUSED');
    expect(decisionBranch.slice(idx, idx + 200)).toMatch(/403/);
  });

  it('still records who decided it, so the audit trail survives the fix', () => {
    expect(decisionBranch).toMatch(/final_decision_by\s*=\s*user\.id/);
  });
});
