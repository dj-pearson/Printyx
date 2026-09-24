/**
 * Round 237: TanStack Query v5 silently ignores four v4 query options, and
 * this tree still used three of them. `keepPreviousData: true` (the service
 * request list blanked on every page change), `cacheTime` (never applied)
 * and a query-level `onSuccess` (useVerifyCheckoutSession's subscription
 * refresh never ran). A query-level `onError` is the fourth. They typecheck
 * only when the options object is untyped, so the check is structural: every
 * `useQuery(` call's argument is extracted with paren matching and searched.
 * Mutations are exempt - useMutation still takes onSuccess and onError.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** The text between `useQuery(` and its matching `)`. */
export function queryCallArgs(src: string): string[] {
  const out: string[] = [];
  const re = /\buseQuery(?:<[^()]*?>)?\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

/** Top-level keys of the options literal only, so a nested object cannot match. */
function topLevelKeys(arg: string): string[] {
  const open = arg.indexOf('{');
  if (open < 0) return [];
  const keys: string[] = [];
  let depth = 0;
  let atKey = true;
  for (let i = open; i < arg.length; i++) {
    const c = arg[i];
    if ('{[('.includes(c)) {
      depth++;
      if (depth === 1) atKey = true;
      continue;
    }
    if ('}])'.includes(c)) {
      depth--;
      continue;
    }
    if (depth === 1 && c === ',') atKey = true;
    else if (depth === 1 && atKey && /[A-Za-z_]/.test(c)) {
      const k = /^[A-Za-z_]\w*/.exec(arg.slice(i))![0];
      keys.push(k);
      atKey = false;
      i += k.length - 1;
    } else if (depth === 1 && !/\s/.test(c)) atKey = false;
  }
  return keys;
}

const V4_ONLY = ['keepPreviousData', 'cacheTime', 'onSuccess', 'onError'];

describe('TanStack v5 query options', () => {
  it('extracts nested calls and top-level keys only', () => {
    const [arg] = queryCallArgs(
      'useQuery<X>({ queryKey: [f(1)], gcTime: 5, meta: { onSuccess: 1 } })',
    );
    expect(topLevelKeys(arg)).toEqual(['queryKey', 'gcTime', 'meta']);
    const [bad] = queryCallArgs('useQuery({\n  queryKey: ["a"],\n  keepPreviousData: true,\n})');
    expect(topLevelKeys(bad)).toContain('keepPreviousData');
  });

  it('no useQuery in any client tree passes an option v5 ignores', () => {
    const files = walk('client/src');
    let calls = 0;
    const offenders: string[] = [];
    for (const f of files) {
      const src = strip(readFileSync(f, 'utf8'));
      for (const arg of queryCallArgs(src)) {
        calls++;
        for (const k of topLevelKeys(arg)) if (V4_ONLY.includes(k)) offenders.push(`${f}: ${k}`);
      }
    }
    expect(calls).toBeGreaterThan(300);
    expect(offenders).toEqual([]);
  });

  it('the checkout verify refreshes the subscription inside the queryFn', () => {
    const src = strip(readFileSync('client/src/hooks/useSubscription.ts', 'utf8'));
    const at = src.indexOf('export function useVerifyCheckoutSession');
    const body = src.slice(at, src.indexOf('export function', at + 10));
    const fn = body.slice(body.indexOf('queryFn'), body.indexOf('enabled:'));
    expect(fn).toMatch(/invalidateQueries\(\{ queryKey: \['subscription'\] \}\)/);
  });
});
