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

  /**
   * The deep shapes currently in the baseline, BY NAME.
   *
   * This assertion has been wrong twice in opposite directions, and both times
   * because it was a claim about DEBT rather than about a property. It first
   * demanded at least 19 of them, so closing them made the story that closed
   * them look like a regression; it was then relaxed to exactly zero, so
   * PROD-008 widening the guard's corpus to the native client trees - which
   * found three real ones - looked like a regression too.
   *
   * All three were paths only a native client calls, which is precisely what
   * that widening exists to surface, and ALL THREE ARE NOW CLOSED - the list
   * shrank rather than being relaxed, one entry at a time:
   *   service-tickets/:id/attachments  round 110
   *   proposals/:id/send               round 111
   *   equipment/:id/service-history    round 115
   *
   * EMPTY IS NOT THE SAME AS RELAXED. The assertion below is unchanged and
   * still bites: a deep shape appearing in the baseline fails until somebody
   * examines it and puts it here. Listed rather than counted, and asserted in
   * both directions, so it cannot rot into a pre-forgiveness for whatever is
   * added next.
   */
  const KNOWN_DEEP_SHAPES: string[] = [];

  it('the deep shapes in the baseline are exactly the ones that were examined', () => {
    const deep = flat.filter((p) => p.includes('/:id/')).sort();
    expect(deep).toEqual([...KNOWN_DEEP_SHAPES].sort());
    expect(flat.length).toBeGreaterThan(0);
  });

  it('every deep entry is a shape, not a bare word', () => {
    // The property the guard actually owns: a deep finding names the whole path
    // a caller uses, so the report says where the gap is rather than leaving a
    // segment that could belong to any depth.
    //
    // With every deep shape closed this loop has nothing to iterate, so it is
    // run over the real entries AND over the three that were closed - which are
    // the exact strings the guard emitted - rather than being left to pass on
    // an empty array. The mechanism that produces them is asserted separately
    // against the script's source above.
    const CLOSED_SHAPES = [
      'service-tickets/:id/attachments',
      'proposals/:id/send',
      'equipment/:id/service-history',
    ];
    const entries = [...flat.filter((p) => p.includes('/:id/')), ...CLOSED_SHAPES];
    expect(CLOSED_SHAPES.length).toBe(3);
    // COUNTED INSIDE THE LOOP, not asserted about the array beside it. A floor
    // on `entries.length` does not bind to the iteration: a mutant that walks
    // an empty list instead still satisfies it, which is the vacuous pass this
    // file's own note is about, one level in.
    let checked = 0;
    for (const entry of entries) {
      checked += 1;
      const segs = entry.split('/').slice(1);
      expect({ entry, hasPlaceholder: segs.includes(':id') }).toEqual({
        entry,
        hasPlaceholder: true,
      });
      expect({ entry, literalLeaf: /^[a-z0-9][a-z0-9-]*$/.test(segs[segs.length - 1]) }).toEqual({
        entry,
        literalLeaf: true,
      });
    }
    expect(checked).toBe(entries.length);
    expect(checked).toBeGreaterThanOrEqual(CLOSED_SHAPES.length);
  });

  it('keeps the depth-1 entries alongside them in one list', () => {
    expect(flat).toContain('admin/audit-logs');
  });

  it('says in its note what a shape entry means', () => {
    expect(baseline.note).toMatch(/:id/);
    expect(baseline.note).toMatch(/PARENT OBJECT/);
  });
});
