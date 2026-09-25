import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideDisputeTransition } from '../../../shared/commission-dispute';

/**
 * Round 197. Commission disputes: the list sent `disputeDetails` as a string
 * the page dereferenced (crash on the first dispute) and was unscoped (every
 * colleague's pay disputes); nothing could change a dispute's status; and the
 * create branch could never insert.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const FN = strip(readFileSync(join(root, 'supabase/functions/commission/index.ts'), 'utf8'));
const PAGE = strip(readFileSync(join(root, 'client/src/pages/CommissionManagement.tsx'), 'utf8'));

const dispute = { employeeId: 'rep', submittedBy: 'rep', status: 'submitted' };

describe('decideDisputeTransition', () => {
  it('lets a manager who is not involved review', () => {
    expect(
      decideDisputeTransition({ actorId: 'mgr', actorLevel: 4, dispute, nextStatus: 'resolved' }),
    ).toEqual({ ok: true, terminal: true });
    expect(
      decideDisputeTransition({
        actorId: 'mgr',
        actorLevel: 4,
        dispute,
        nextStatus: 'under_review',
      }),
    ).toEqual({ ok: true, terminal: false });
  });
  it('refuses a rep, and refuses the employee or submitter whatever their rank', () => {
    expect(
      decideDisputeTransition({ actorId: 'x', actorLevel: 3, dispute, nextStatus: 'resolved' }),
    ).toMatchObject({ ok: false, code: 'INSUFFICIENT_ROLE' });
    expect(
      decideDisputeTransition({ actorId: 'rep', actorLevel: 7, dispute, nextStatus: 'resolved' }),
    ).toMatchObject({ ok: false, code: 'SELF_REVIEW' });
    expect(
      decideDisputeTransition({
        actorId: 'sub',
        actorLevel: 7,
        dispute: { ...dispute, submittedBy: 'sub' },
        nextStatus: 'resolved',
      }),
    ).toMatchObject({ ok: false, code: 'SELF_REVIEW' });
  });
  it('refuses unknown statuses, no-ops, and reopening a closed dispute', () => {
    const base = { actorId: 'mgr', actorLevel: 4 };
    expect(decideDisputeTransition({ ...base, dispute, nextStatus: 'approved' })).toMatchObject({
      code: 'INVALID_STATUS',
    });
    expect(decideDisputeTransition({ ...base, dispute, nextStatus: 'submitted' })).toMatchObject({
      code: 'NO_CHANGE',
    });
    expect(
      decideDisputeTransition({
        ...base,
        dispute: { ...dispute, status: 'resolved' },
        nextStatus: 'under_review',
      }),
    ).toMatchObject({ code: 'ALREADY_CLOSED' });
  });
});

describe('the commission function', () => {
  const list = FN.slice(
    FN.indexOf("req.method === 'GET' && endpoint === 'disputes'"),
    FN.indexOf("req.method === 'PATCH' && endpoint === 'disputes'"),
  );
  const patch = FN.slice(
    FN.indexOf("req.method === 'PATCH' && endpoint === 'disputes'"),
    FN.indexOf("req.method === 'POST' && endpoint === 'disputes'"),
  );

  it('scopes the list to the caller tier', () => {
    expect(list).toMatch(/applyUserScope\(\s*admin\s*\.from\('commission_disputes'\)/);
    expect(list).toContain("'employee_id'");
  });

  it('sends disputeDetails as the object the page reads', () => {
    expect(list).toMatch(/disputeDetails: \{\s*type: d\.dispute_type,/);
    expect(list).not.toMatch(/disputeDetails: d\.description/);
  });

  it('decides the transition before it writes', () => {
    expect(patch.indexOf('decideDisputeTransition(')).toBeGreaterThan(-1);
    expect(patch.indexOf('decideDisputeTransition(')).toBeLessThan(patch.indexOf('.update('));
    expect(patch).toContain(".eq('tenant_id', tenantId)");
  });

  it('validates a create instead of guaranteeing a failed insert', () => {
    expect(FN).not.toMatch(/dispute_type \?\? 'calculation'\)/);
    expect(FN).toMatch(/DISPUTE_TYPES as readonly string\[\]\)\.includes\(disputeType\)/);
  });
});

describe('the page', () => {
  it('wires Update Status and Resolve Dispute', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => openReview\(dispute, 'status'\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => openReview\(dispute, 'resolve'\)\}/);
    expect(PAGE).toMatch(/apiRequest\(`\/api\/commission\/disputes\/\$\{payload\.id\}`, 'PATCH'/);
    expect(PAGE).not.toContain('View History');
  });
});
