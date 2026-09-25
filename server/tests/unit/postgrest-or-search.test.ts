/**
 * Round 151: a search term never rewrites a PostgREST or() filter.
 *
 * 30-odd edge call sites built `.or(`col.ilike.%${search}%,...`)` from a query
 * parameter. A comma or parenthesis in the term - "Smith, Jones & Co" - broke
 * the filter into a 400/500, and a crafted term could append clauses of its
 * own. _shared/postgrest-or.ts quotes the value instead, which keeps the
 * comma as part of the search.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  ilikeAnyFilter,
  quoteOrValue,
  MAX_OR_TERM_LENGTH,
} from '../../../supabase/functions/_shared/postgrest-or';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Split a logic-tree string on the commas PostgREST treats as separators. */
function topLevelClauses(filter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < filter.length; i++) {
    const c = filter[i];
    if (quoted && c === '\\') {
      cur += c + filter[++i];
      continue;
    }
    if (c === '"') quoted = !quoted;
    if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

describe('ilikeAnyFilter', () => {
  it('keeps a comma in the term as part of the search, one clause per column', () => {
    const f = ilikeAnyFilter(['company_name', 'email'], 'Smith, Jones & Co');
    expect(f).toBe('company_name.ilike."%Smith, Jones & Co%",email.ilike."%Smith, Jones & Co%"');
    expect(topLevelClauses(f)).toHaveLength(2);
  });

  it('cannot be made to add a clause', () => {
    const f = ilikeAnyFilter(['title'], 'x%",id.not.is.null,title.ilike."y');
    expect(topLevelClauses(f)).toHaveLength(1);
    expect(f.startsWith('title.ilike."')).toBe(true);
    expect(f.endsWith('"')).toBe(true);
  });

  it('escapes the quote and backslash that would end the value', () => {
    expect(quoteOrValue('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it('keeps parentheses inside the quoted value', () => {
    expect(topLevelClauses(ilikeAnyFilter(['a', 'b'], 'Acme (North)'))).toHaveLength(2);
  });

  it('trims and caps the term', () => {
    expect(ilikeAnyFilter(['a'], '  hi  ')).toBe('a.ilike."%hi%"');
    const long = ilikeAnyFilter(['a'], 'x'.repeat(MAX_OR_TERM_LENGTH + 50));
    expect(long.length).toBe('a.ilike."%%"'.length + MAX_OR_TERM_LENGTH);
  });

  it('refuses an empty column list rather than emitting an empty filter', () => {
    expect(() => ilikeAnyFilter([], 'x')).toThrow();
  });
});

describe('no edge function interpolates a term into an ilike or() filter', () => {
  const files = walk('supabase/functions');

  it('walks the whole edge tree', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('finds none', () => {
    const shape = /\.or\(\s*`[^`]*\.ilike\.[^`]*\$\{/;
    const offenders = files.filter((f) => {
      const src = readFileSync(f);
      if (src.includes(0)) return false;
      return shape.test(stripComments(src.toString('utf8')));
    });
    expect(offenders).toEqual([]);
  });

  it('the converted call sites use the helper', () => {
    let uses = 0;
    for (const f of files) {
      const src = readFileSync(f);
      if (src.includes(0)) continue;
      uses += (stripComments(src.toString('utf8')).match(/\.or\(ilikeAnyFilter\(/g) ?? []).length;
    }
    expect(uses).toBeGreaterThanOrEqual(20);
  });
});
