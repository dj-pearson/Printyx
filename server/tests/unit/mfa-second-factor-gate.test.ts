/**
 * Turning MFA off has to cost a second factor.
 *
 * supabase/functions/mfa/ deleted every enrollment for the current user on
 * nothing but a valid session, and regenerated backup codes the same way. Those
 * are the two operations a second factor exists to protect: a stolen token was
 * enough to switch MFA off, or to invalidate the codes the real owner holds and
 * be handed a fresh set. The Express implementation this function replaced DID
 * verify a TOTP token first, so production was strictly weaker than dev on the
 * control that matters - and nobody could see it, because no client tree called
 * /api/mfa at all.
 *
 * These assertions read the source. The handler needs a live Postgres and a
 * real TOTP clock to exercise end to end, and an assertion that reads "the gate
 * is called before the delete" is worth more than nothing while that does not
 * exist. Comments are stripped first: an absence assertion otherwise matches
 * the comment explaining the fix.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const mfa = read('supabase/functions/mfa/index.ts');

/** The body of a top-level `if (...) { ... }` branch whose condition matches. */
function branch(source: string, marker: string): string {
  const at = source.indexOf(marker);
  expect(at, `branch not found: ${marker}`).toBeGreaterThan(-1);
  const open = source.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced branch: ${marker}`);
}

describe('POST /mfa/disable', () => {
  const body = branch(mfa, "p0 === 'disable'");

  it('requires a second factor before deleting anything', () => {
    const gateAt = body.indexOf('requireSecondFactor');
    const deleteAt = body.indexOf("from('mfa_enrollments').delete()");
    expect(gateAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(deleteAt);
  });

  it('returns rather than falling through when the gate fails', () => {
    expect(body).toMatch(/if \(!gate\.ok\) \{[\s\S]*?return errorResponse\(/);
  });

  it('audits the refusal, so a guessing attacker leaves a trail', () => {
    expect(body).toMatch(/writeAudit\([^)]*'disable_denied'/);
  });
});

describe('POST /mfa/backup-codes/regenerate', () => {
  const body = branch(mfa, "p1 === 'regenerate'");

  it('requires a second factor before issuing new codes', () => {
    const gateAt = body.indexOf('requireSecondFactor');
    const regenAt = body.indexOf('regenerateBackupCodes');
    expect(gateAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(regenAt);
  });
});

/**
 * A top-level function body, sliced to the closing brace in column 0.
 *
 * `branch` cannot be used here: it scans from the first `{` after the marker,
 * and for this function that is the `{ ok: true }` inside the return type, so
 * it returned a two-word string and every assertion below failed for the wrong
 * reason.
 */
function topLevelFunction(source: string, name: string): string {
  const at = source.indexOf(`async function ${name}`);
  expect(at, `function not found: ${name}`).toBeGreaterThan(-1);
  const end = source.indexOf('\n}\n', at);
  expect(end, `unterminated function: ${name}`).toBeGreaterThan(at);
  return source.slice(at, end);
}

describe('requireSecondFactor', () => {
  const helper = topLevelFunction(mfa, 'requireSecondFactor');

  it('accepts a TOTP code from a verified enrollment', () => {
    expect(helper).toMatch(/verifyCode\(/);
    expect(helper).toMatch(/eq\('is_verified', true\)/);
  });

  it('accepts an unused backup code, and consumes it', () => {
    expect(helper).toMatch(/consumeBackupCode\(/);
  });

  it('lets a user with no verified enrollment through', () => {
    // Otherwise a half-finished enrolment could never be cleared.
    expect(helper).toMatch(/verified\.length === 0.*return \{ ok: true \}/s);
  });

  it('rejects a missing code with 400 and a wrong one with 401', () => {
    expect(helper).toMatch(/status: 400[\s\S]*?MFA_CODE_REQUIRED/);
    expect(helper).toMatch(/status: 401[\s\S]*?BAD_CODE/);
  });
});

describe('the surface that reaches it', () => {
  it('is proxied, so dev exercises the same handler as production', () => {
    expect(read('server/middleware/edge-function-proxy.ts')).toMatch(/'\/api\/mfa':\s*'mfa'/);
  });

  it('has no Express router left - all 16 handlers gated on a session field nothing sets', () => {
    expect(existsSync(join(repo, 'server/routes/mfa-routes.ts'))).toBe(false);
  });

  it('is reachable from Settings, which used to render a Switch with no handler', () => {
    const card = read('client/src/components/auth/TwoFactorCard.tsx');
    expect(card).toMatch(/\/api\/mfa\/enroll\/init/);
    expect(card).toMatch(/\/api\/mfa\/enroll\/verify/);
    // Both destructive calls must send the code the endpoints now demand.
    expect(card).toMatch(/'\/api\/mfa\/disable', 'POST', \{ code \}/);
    expect(card).toMatch(/'\/api\/mfa\/backup-codes\/regenerate', 'POST', \{ code \}/);
    expect(read('client/src/pages/Settings.tsx')).toMatch(/<TwoFactorCard \/>/);
  });
});
