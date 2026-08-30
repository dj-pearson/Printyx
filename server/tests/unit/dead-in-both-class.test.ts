/**
 * A path NOTHING serves is a different defect from a prod-only 404 (PA-022).
 *
 * route-parity classified both as `missing-edge`, whose message is "add the
 * edge function". That is the right instruction when Express serves the path
 * and production does not - the handler exists, port or proxy it. It is the
 * wrong instruction when neither host serves it: there is nothing to port, the
 * page is broken while you develop it too, and the fix is to build the endpoint
 * or delete the call.
 *
 * PA-022 opened with fourteen such prefixes and had to separate them by hand,
 * which is what its third acceptance criterion asks to automate.
 *
 * The class is GATED AT ZERO rather than baselined. A missing-edge domain gets
 * grandfathered because it works in dev, so it can sit unnoticed; a
 * dead-in-both domain is broken for everyone from the first commit, and
 * baselining one would record a live defect as accepted debt.
 *
 * Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const parity = read('scripts/lib/route-parity.mjs');
const guard = read('scripts/check-route-ownership.mjs');
const baseline = JSON.parse(readFileSync(join(repo, 'docs/route-ownership-baseline.json'), 'utf8'));

describe('the classifier separates the two', () => {
  it('checks dead-in-both BEFORE missing-edge, so the narrower rule wins', () => {
    const deadAt = parity.indexOf("return 'dead-in-both'");
    const missingAt = parity.indexOf("return 'missing-edge'");
    expect(deadAt).toBeGreaterThan(-1);
    expect(missingAt).toBeGreaterThan(-1);
    expect(deadAt).toBeLessThan(missingAt);
  });

  it('requires the absence of an Express handler too', () => {
    // Without `&& !exp` this would swallow every missing-edge domain, and the
    // prod-blocker message would stop being emitted at all.
    expect(parity).toMatch(/if \(fe && !edge && !exp\) return 'dead-in-both';/);
    expect(parity).toMatch(/if \(fe && !edge\) return 'missing-edge';/);
  });

  it('lists the class first in CLASS_ORDER', () => {
    const order = parity.slice(parity.indexOf('export const CLASS_ORDER'));
    expect(order.slice(0, 200)).toMatch(/'dead-in-both',\s*\n\s*'missing-edge',/);
  });
});

describe('the guard gates it at zero', () => {
  it('fails the build on a live caller rather than baselining it', () => {
    expect(guard).toMatch(/liveDeadInBoth\.length > 0/);
    expect(guard).toMatch(/const fail =[\s\S]{0,120}liveDeadInBoth\.length > 0/);
  });

  it('reports, but does not gate, a caller inside an orphaned file', () => {
    // Same rule missing-edge and check-nav-targets already apply: a call that
    // can never run must not fail CI, or the real ones get buried.
    expect(guard).toMatch(/const liveDeadInBoth = byClassLive\('dead-in-both'\)/);
    expect(guard).toMatch(/const deadDeadInBoth = byClassDead\('dead-in-both'\)/);
    const deadBlock = guard.slice(guard.indexOf('if (deadDeadInBoth.length)'));
    expect(deadBlock.slice(0, 400)).toMatch(/console\.log/);
    expect(deadBlock.slice(0, 400)).not.toMatch(/console\.error/);
  });

  it('says build-or-delete, not add-an-edge-function', () => {
    const block = guard.slice(guard.indexOf('if (liveDeadInBoth.length)'));
    expect(block.slice(0, 700)).toMatch(/build the endpoint, or delete the call/);
    expect(block.slice(0, 700)).toMatch(/Do NOT baseline it/);
  });

  it('records the class in the baseline so an accidental entry is visible', () => {
    expect(baseline).toHaveProperty('deadInBoth');
    expect(baseline.deadInBoth).toEqual([]);
  });
});

describe('the fourteen prefixes PA-022 opened with', () => {
  it('none of them is a live served-by-nothing domain any more', () => {
    // The story listed these in July. Most were closed by the port and
    // convergence stories since; this asserts the outcome rather than the
    // history, so it fails if one comes back.
    expect(baseline.deadInBoth).toEqual([]);
    expect(baseline.missingEdge).toEqual([]);
  });
});
