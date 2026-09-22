/**
 * An unknown sub-resource answers 404, never the parent record (round 131).
 *
 * PA-020 found `supabase/functions/customers/` answering every tab - invoices,
 * equipment, service history, financials, supplies - with the CUSTOMER OBJECT
 * at 200, and recorded why it had survived an audit: a component mapping over
 * an object renders an empty list and reports nothing. That story fixed one
 * function. Seven more had the same fallthrough, so the next missing branch in
 * any of them would have been invisible the same way.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  MIN_CORPUS,
  analyzeFunction,
  edgeFunctions,
  hasBareIdRefusal,
  scan,
  stripComments,
} from '../../../scripts/check-subresource-fallthrough.mjs';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('the guard measures the tree it claims to measure', () => {
  it('walks every edge function, not a handful', () => {
    const names = edgeFunctions();
    expect(names.length).toBeGreaterThan(200);
    // Derived, not pinned: every name must really carry an index.ts.
    for (const n of names) {
      expect({ n, real: existsSync(join(repo, 'supabase/functions', n, 'index.ts')) }).toEqual({
        n,
        real: true,
      });
    }
  });

  it('its floor is meaningful, so a walk that stops matching fails rather than passes', () => {
    // A floor of 0 is the same vacuous pass it was added to close, and a source
    // check cannot tell a working floor from a disabled one.
    expect(MIN_CORPUS).toBeGreaterThan(10);
    expect(MIN_CORPUS).toBeLessThan(edgeFunctions().length);
  });

  it('nothing in the tree answers an unknown sub-resource with the row', () => {
    const { findings, inScope } = scan();
    expect(findings.map((f: { fn: string }) => f.fn)).toEqual([]);
    // A floor on the in-scope set: if the scope rule stops matching, this guard
    // passes while checking nothing.
    expect(inScope.length).toBeGreaterThan(20);
  });
});

describe('it accepts each guard shape this tree really uses', () => {
  const shapeOf = (fn: string) =>
    analyzeFunction(fn, read(`supabase/functions/${fn}/index.ts`))?.shape;

  it.each([
    ['equipment', 'catch-all'], // if (id && sub) { 404 } - method-agnostic
    ['service-tickets', 'catch-all'], // if (GET && id && sub) { 404 }
    ['customers', 'catch-all'], // if (id && sub) return handleSubResource(...)
    ['companies', 'negated-generic'], // if (GET && id && !sub) - safe by shape
    ['leads', 'negated-generic'],
    ['business-records', 'bare-id-refusal'], // if (id) { 404 } - PROD-008b
  ])('%s is cleared as %s', (fn, shape) => {
    expect({ fn, shape: shapeOf(fn) }).toEqual({ fn, shape });
  });
});

describe('the rule distinguishes a fallthrough from a refusal', () => {
  const base = (body: string) => `
    const parts = url.pathname.split('/');
    const thingId = parts[0];
    const subResource = parts[1];
    if (req.method === 'GET' && thingId && subResource === 'notes') {
      return createCorsResponse(notes, 200, req);
    }
${body}
    if (req.method === 'GET' && thingId) {
      return createCorsResponse(thing, 200, req);
    }
  `;

  it('REJECTS a function whose /:id branch is reachable for an unknown sub', () => {
    const res = analyzeFunction('fixture', base(''));
    expect(res).not.toBeNull();
    expect(res.guarded).toBe(false);
    expect(res.routed).toEqual(['notes']);
  });

  it('ACCEPTS the same function once the catch-all is added', () => {
    const guard = `
    if (req.method === 'GET' && thingId && subResource) {
      return createCorsResponse({ error: 'Unknown' }, 404, req);
    }`;
    expect(analyzeFunction('fixture', base(guard)).guarded).toBe(true);
  });

  it('a catch-all BELOW the /:id branch does not count - order is the property', () => {
    const src = `
    const parts = url.pathname.split('/');
    const thingId = parts[0];
    const subResource = parts[1];
    if (req.method === 'GET' && thingId && subResource === 'notes') { return a; }
    if (req.method === 'GET' && thingId) { return thing; }
    if (thingId && subResource) { return createCorsResponse({}, 404, req); }
    `;
    expect(analyzeFunction('fixture', src).guarded).toBe(false);
  });

  it('a function that routes NO sub-resource is out of scope, not a finding', () => {
    const src = `
    const parts = url.pathname.split('/');
    const thingId = parts[0];
    const subResource = parts[1];
    if (req.method === 'GET' && thingId) { return thing; }
    `;
    expect(analyzeFunction('fixture', src)).toBeNull();
  });

  it('a normalisation line whose RHS also starts with an index does not become the id', () => {
    // `deals` opens with `const pathParts = rawParts[0] === 'deals' ? ... ;`.
    // Without the terminator the id resolved to "pathParts" and the whole
    // function fell out of scope - which is how deals hid its own fallthrough.
    const src = `
    const pathParts = rawParts[0] === 'deals' ? rawParts.slice(1) : rawParts;
    const dealId = pathParts[0];
    const subResource = pathParts[1];
    if (dealId && subResource === 'quotes') { return q; }
    if (req.method === 'GET' && dealId) { return deal; }
    `;
    const res = analyzeFunction('fixture', src);
    expect({ id: res.id, sub: res.sub, guarded: res.guarded }).toEqual({
      id: 'dealId',
      sub: 'subResource',
      guarded: false,
    });
  });
});

describe('the bare-id refusal is read for what it RETURNS', () => {
  it('an ordinary `if (id)` condition is not a refusal', () => {
    const src = `if (recordId) { const row = await load(recordId); return ok(row); }`;
    expect(hasBareIdRefusal(src, 'recordId')).toBe(false);
  });

  it('a 404 return counts', () => {
    const src = `if (recordId) { return createCorsResponse({ error: 'Not found' }, 404, req); }`;
    expect(hasBareIdRefusal(src, 'recordId')).toBe(true);
  });
});

describe('comments are stripped in the order that survives a URL', () => {
  it('a line comment ending in /* does not blank everything up to the next */', () => {
    // The other order reads that trailing `/*` as a block opener - the exact
    // failure check:shared-helper-imports paid for.
    //
    // The fixture needs a REAL block comment further down, or the non-greedy
    // `[\s\S]*?\*\/` finds no closer, blanks nothing, and both orders behave
    // identically: a fixture can only distinguish implementations it contains
    // an example of.
    const src = [
      '// Sales-persona reports - /reports/sales/*',
      'const id = parts[0];',
      '/* an ordinary block comment */',
      'const sub = parts[1];',
    ].join('\n');
    const out = stripComments(src);
    expect(out).toContain('const id = parts[0];');
    expect(out).toContain('const sub = parts[1];');
    expect(out).not.toContain('ordinary block comment');
  });

  it('a protocol slash survives', () => {
    expect(stripComments("const u = 'https://printyx.net/x';")).toContain('https://printyx.net/x');
  });

  it('block comments become spaces, so line numbers stay honest', () => {
    const src = 'a\n/* two\nlines */\nb';
    const out = stripComments(src);
    expect(out.split('\n').length).toBe(src.split('\n').length);
  });
});

describe('the eight functions fixed this round say what they refuse', () => {
  it.each([
    'activities',
    'contracts',
    'notifications',
    'platform-activities',
    'service-tickets',
    'deals',
    'opportunities',
  ])('%s answers 404 with the sub-resource named', (fn) => {
    const src = stripComments(read(`supabase/functions/${fn}/index.ts`));
    const res = analyzeFunction(fn, read(`supabase/functions/${fn}/index.ts`));
    expect({ fn, guarded: res.guarded }).toEqual({ fn, guarded: true });
    // Naming the segment is what turns a 404 into a diagnosis: without it the
    // caller cannot tell a wrong id from a route nobody built.
    expect(src).toMatch(/Unknown [a-z ]+ sub-resource: \$\{/);
  });

  it('and the refusal is a 404, not a 200 with an empty body', () => {
    for (const fn of ['deals', 'service-tickets', 'activities']) {
      const src = stripComments(read(`supabase/functions/${fn}/index.ts`));
      const at = src.indexOf('Unknown ');
      const tail = src.slice(at, src.indexOf(';', at));
      expect({ fn, refuses: /\b404\b/.test(tail) }).toEqual({ fn, refuses: true });
    }
  });
});

describe('the guard is wired where it runs', () => {
  it('has an npm script and a CI step', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['check:subresource-fallthrough']).toBe(
      'node scripts/check-subresource-fallthrough.mjs',
    );
    // CR-023: runnable is not run - a guard absent from the workflow
    // accumulates a baseline nobody evaluates.
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:subresource-fallthrough');
  });

  it('importing the module does not run the walk', () => {
    // Top-level IO in an ESM module executes on import; `import.meta.main` is a
    // Deno API and is always undefined in Node.
    const src = read('scripts/check-subresource-fallthrough.mjs');
    expect(src).toContain('const isEntryPoint =');
    expect(src).toContain('fileURLToPath(import.meta.url)');
    expect(src).not.toContain('import.meta.main');
  });
});

describe('every edge function directory is readable', () => {
  it('the scan reads index.ts and nothing else', () => {
    const dirs = readdirSync(join(repo, 'supabase/functions')).filter((d) =>
      existsSync(join(repo, 'supabase/functions', d, 'index.ts')),
    );
    expect(edgeFunctions()).toEqual(dirs.sort());
  });
});
