/**
 * check:edge-path-coverage has to read every client tree, not just the web one.
 *
 * It shared computeParity with check:routes, which walks `client/src` and
 * nothing else, so a path only a native client calls could never put a domain
 * on its list. That is how /api/leads/:id/activities stayed invisible: the iOS
 * quick-log FAB and its offline write queue post there, supabase/functions/leads
 * had no such branch, and the guard reported `leads` as carrying one unrelated
 * gap. check:unreferenced-edge-fns had to learn the same lesson when the iOS app
 * turned out to be the only caller of five edge functions.
 *
 * The rule is asserted by RUNNING the analysis against fixtures rather than by
 * reading the regex: a constant that is still in the file tells you nothing
 * about whether the branch fires.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeCoverageGaps } from '../../../scripts/check-edge-path-coverage.mjs';

const repo = process.cwd();

const NATIVE_TREES = [
  'printyx-client',
  'printyx-desktop',
  'mobile-app',
  'mobile',
  'browser-extensions',
  'printyx-extension',
  'ios',
];

describe('the coverage guard reads every client tree', () => {
  it('names the same trees check:unreferenced-edge-fns does', () => {
    // Derived from that guard's own list so the two cannot drift: a tree added
    // to one and not the other is a blind spot in whichever was forgotten.
    const other = readFileSync(join(repo, 'scripts/check-unreferenced-edge-fns.mjs'), 'utf8');
    const block = /const CLIENT_TREES = \[([\s\S]*?)\]/.exec(other);
    expect(block).not.toBeNull();
    const theirs = [...block![1].matchAll(/'([a-z-]+)'/g)]
      .map((m) => m[1])
      .filter((t) => t !== 'client' && t !== 'src');
    expect([...NATIVE_TREES].sort()).toEqual([...new Set(theirs)].sort());
  });

  it('the guard itself lists those trees', () => {
    const src = readFileSync(join(repo, 'scripts/check-edge-path-coverage.mjs'), 'utf8');
    const block = /const NATIVE_TREES = \[([\s\S]*?)\]/.exec(src);
    expect(block).not.toBeNull();
    const listed = [...block![1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    expect([...listed].sort()).toEqual([...NATIVE_TREES].sort());
  });

  it('those trees actually hold source files, so the walk is not vacuous', () => {
    // A guard that widened its corpus onto empty directories reads exactly like
    // one that widened it correctly.
    let files = 0;
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx|swift|kt)$/.test(entry)) files++;
      }
    };
    for (const tree of NATIVE_TREES) walk(join(repo, tree));
    expect(files).toBeGreaterThan(100);
  });
});

describe('native placeholder syntax', () => {
  const src = readFileSync(join(repo, 'scripts/check-edge-path-coverage.mjs'), 'utf8');
  const body = /function isPlaceholder\(segment\) \{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';

  it('recognises Swift interpolation, or the segment behind an id is never checked', () => {
    // "/api/leads/\(leadId)/activities": with only ${...} and :param known,
    // nothing in that path is a placeholder, so `activities` is never treated
    // as sitting behind an id and the whole path is dropped.
    expect(body).toMatch(/\\\\\\\(/);
  });

  it('recognises a bare $name, which is how Kotlin interpolates', () => {
    expect(body).toMatch(/\\\$\[A-Za-z_\]/);
  });
});

describe('the leads gap is closed and stays closed', () => {
  const gaps = computeCoverageGaps() as Record<string, string[]>;

  it('leads no longer reports :id/activities', () => {
    expect(gaps.leads ?? []).not.toContain(':id/activities');
  });

  it('the run found gaps at all, so a clean leads entry is not a broken walk', () => {
    // The floor that separates "fixed" from "the analysis matched nothing".
    expect(Object.keys(gaps).length).toBeGreaterThan(10);
  });

  it('import-eda is still reported - it is a real gap and was not silently absorbed', () => {
    expect(gaps.leads ?? []).toContain('import-eda');
  });
});

describe('the widened corpus is load-bearing', () => {
  const gaps = computeCoverageGaps() as Record<string, string[]>;

  /** Every /api path any file under client/src names. */
  const webText = (() => {
    let text = '';
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry)) text += readFileSync(full, 'utf8');
      }
    };
    walk(join(repo, 'client/src'));
    return text;
  })();

  it('at least one reported gap has no caller in client/src at all', () => {
    // DERIVED rather than pinned to a named entry, so fixing any one of them
    // does not turn this assertion into a claim about a different path. Without
    // it the native corpus could be dropped from the caller loop and every
    // assertion here would still pass, because the leads gap this story fixed
    // is closed on both readings.
    const nativeOnly: string[] = [];
    for (const [domain, segs] of Object.entries(gaps)) {
      for (const seg of segs) {
        const tail = seg.startsWith('#') ? '' : seg.replace(/:id/g, '');
        if (!tail) continue;
        const leaf = tail.split('/').filter(Boolean).pop()!;
        if (!webText.includes(`/api/${domain}`) || !webText.includes(leaf)) {
          nativeOnly.push(`${domain}/${seg}`);
        }
      }
    }
    expect(nativeOnly.length).toBeGreaterThan(0);
  });

  it('no gap is a bare id - native test fixtures are not endpoints', () => {
    // ios/PrintyxTests posts to /api/leads/123/activities and /api/leads/abc/...
    // Counting those puts `123` in the baseline as a missing endpoint, and a
    // baseline holding a known non-defect is where a real one hides.
    const idShaped: string[] = [];
    for (const [domain, segs] of Object.entries(gaps)) {
      for (const seg of segs) {
        if (/^\d+$/.test(seg) || seg === 'abc') idShaped.push(`${domain}/${seg}`);
      }
    }
    expect(idShaped).toEqual([]);
  });
});
