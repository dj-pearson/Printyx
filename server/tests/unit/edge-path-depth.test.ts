/**
 * The edge-path coverage guard now looks PAST an id (PA-025).
 *
 * Its regex captured one segment and rejected anything holding a `$` or `{`,
 * so a call shaped `/api/equipment/${id}/meter-readings` was dropped entirely:
 * the placeholder failed the literal test and the segment behind it was never
 * examined. That is the PA-020 class, and it is the worst-behaved one, because
 * such a request does not 404 - the handler reads parts[0] as the id, never
 * looks at parts[1], and answers 200 with the PARENT OBJECT. A component
 * mapping over it renders an empty list and reports nothing.
 *
 * This test pins the two judgement calls, because both were wrong first.
 *
 * Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const guard = stripComments(
  readFileSync(join(repo, 'scripts/check-edge-path-coverage.mjs'), 'utf8'),
);
const baseline = JSON.parse(
  readFileSync(join(repo, 'docs/edge-path-coverage-baseline.json'), 'utf8'),
);

/** The guard's own matcher, kept in step by the assertions below. */
function appearsIn(src: string, segment: string) {
  const esc = segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`/]${esc}(?=['"\`/$?\\\\)])`).test(src);
}

describe('a segment counts as handled only when it reads as a route token', () => {
  it.each([
    ["if (path === '/summary')", 'summary'],
    ['path.match(/^\\/public\\/([^/]+)\\/respond$/)', 'respond'],
    ["parts[1] === 'timer'", 'timer'],
    ["url.pathname.startsWith('/stages/')", 'stages'],
  ])('accepts %s', (src, segment) => {
    expect(appearsIn(src, segment)).toBe(true);
  });

  it.each([
    // A word-boundary search was the second version of this rule and it
    // "resolved" 25 baselined gaps against text like these two, which would
    // have been a silent de-gating dressed up as progress.
    ["push('Multiple critical security events in the last 7 days')", 'security'],
    ['const metrics = {', 'metrics'],
    ['const exported = true;', 'export'],
  ])('rejects %s', (src, segment) => {
    expect(appearsIn(src, segment)).toBe(false);
  });

  it('is the rule the script actually uses', () => {
    expect(guard).toMatch(/function appearsIn\(src, segment\)/);
    expect(guard).toContain('const esc = segment.replace(');
    // A quote, a backtick or a slash before; one of those or a regex anchor
    // after. Asserted as source text rather than re-escaped, which is what the
    // first two attempts at this line got wrong.
    expect(guard).toContain("(?=['" + '\"');
  });
});

describe('paths are normalized to a shape', () => {
  it('collapses both placeholder forms to :id', () => {
    expect(guard).toMatch(/function isPlaceholder\(segment\)/);
    expect(guard).toMatch(/\\\$\\\{\[\^}\]\*\\\}\$/);
    expect(guard).toMatch(/\^:\[A-Za-z\]/);
    expect(guard).toMatch(/isPlaceholder\(s\) \? ':id' : s/);
  });

  it('refuses a path whose interpolation was truncated by whitespace', () => {
    // The match stops at whitespace, so `${opts.format ?? 'pdf'}` arrives as
    // `${opts`. Guessing there would have baselined a misread entry, and a
    // baseline holding one is where a real gap hides.
    expect(guard).toMatch(/function shapeSegments\(rawTail\)/);
    expect(guard).toMatch(/if \(opens !== closes\) return null;/);
  });

  it('only reports a literal that sits AFTER a placeholder', () => {
    // A depth-1 literal is the original branch's to report. Counting it here
    // too would put one defect in the baseline twice.
    expect(guard).toMatch(/if \(!afterPlaceholder \|\| !isLiteralSegment\(seg\)\) continue;/);
    expect(guard).toMatch(/if \(!segs \|\| !segs\.some\(isPlaceholder\)\) continue;/);
  });
});

describe('the findings are recorded as findings', () => {
  const flat = Object.entries(baseline.gaps as Record<string, string[]>).flatMap(([d, ss]) =>
    ss.map((s) => `${d}/${s}`),
  );

  it('holds the deep shapes the extension found', () => {
    // equipment/:id/meter-readings was the worked example here until PA-052
    // closed it (a real branch in the equipment fn + the Express mirror), so
    // it is deliberately gone from the list. The shape entries remain.
    expect(flat).not.toContain('equipment/:id/meter-readings');
    expect(flat.filter((p) => p.includes('/:id/')).length).toBeGreaterThanOrEqual(19);
  });

  it('keeps the depth-1 entries alongside them in one list', () => {
    expect(flat).toContain('admin/audit-logs');
  });

  it('says in its note what a shape entry means', () => {
    expect(baseline.note).toMatch(/:id/);
    expect(baseline.note).toMatch(/PARENT OBJECT/);
  });
});
