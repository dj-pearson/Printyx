import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  findings,
  compareToBaseline,
  claimedSegments,
  routeRegistrations,
  splitArgs,
  serverFiles,
  AMBIENT,
  NOT_A_GATE,
  MIN_REGISTRATIONS,
} from '../../../scripts/check-dead-policy-gates.mjs';

const repoRoot = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * LAUNCH-013's gates are mounted and cannot run: production sends every
 * segment they sit on to the functions host. This session found the same shape
 * five times by hand before a guard watched for it.
 */
describe('the guard reads a real corpus', () => {
  const result = findings();

  it('parses hundreds of route registrations, so a clean run is not a broken walk', () => {
    expect(result.registrations).toBeGreaterThan(200);
    expect(result.files).toBeGreaterThan(200);
    expect(serverFiles().length).toBeGreaterThan(200);
    // The floor's NUMBER matters as much as the branch: a floor of 0 is the
    // vacuous pass it exists to close, and a source check for `process.exit(2)`
    // cannot tell the two apart.
    expect(MIN_REGISTRATIONS).toBeGreaterThan(100);
  });

  it('knows which segments production claims', () => {
    const claimed = claimedSegments();
    // Both routes into the functions host: a crmProxies entry and a directory.
    expect(claimed.has('billing')).toBe(true); // proxied
    expect(claimed.has('leads')).toBe(true); // directory only, not proxied
    expect(claimed.has('import-eda')).toBe(false); // Express-only by design
  });

  it('passes against its annotated baseline', () => {
    const baseline = JSON.parse(read('docs/dead-policy-gates-baseline.json')) as {
      accepted: Record<string, string>;
    };
    const keys = new Set(result.findings.map((f) => f.key));
    expect(compareToBaseline(keys, baseline.accepted)).toEqual([]);
  });
});

describe('the parser handles the shapes this repo writes', () => {
  it('reads a multi-line registration with nested calls', () => {
    const src = `
      app.post(
        '/api/import/ai/map-columns',
        resolveTenant,
        requireFeature('ai_csv_import'),
        upload.single('file'),
        authed(async (req, res) => { res.json({ ok: true }); }),
      );
    `;
    const regs = routeRegistrations(src);
    expect(regs).toHaveLength(1);
    const parts = splitArgs(regs[0]);
    expect(parts[0]).toBe("'/api/import/ai/map-columns'");
    expect(parts.slice(1, -1).map((p) => p.match(/^(\w+)/)![1])).toEqual([
      'resolveTenant',
      'requireFeature',
      'upload',
    ]);
  });

  it('does not let a comma inside an argument split the list', () => {
    const parts = splitArgs("'/api/x', requirePermission(['a.b.c', 'd.e.f']), handler");
    expect(parts).toHaveLength(3);
  });

  it('does not let a comma inside a string split the list', () => {
    const parts = splitArgs("'/api/x', requireFeature('a,b'), handler");
    expect(parts).toHaveLength(3);
  });
});

describe('the ambient stack is exempt with a reason, not silently', () => {
  it('names why each ambient middleware does not count', () => {
    expect(AMBIENT.size).toBeGreaterThan(4);
    for (const [name, why] of AMBIENT) {
      expect(why, `${name} is exempt with no reason`).toBeTruthy();
      expect(why.length).toBeGreaterThan(20);
    }
  });

  it('does not exempt an authorization gate', () => {
    // requirePermission and requireFeature decide what a caller may DO, which
    // is not something the edge function does automatically.
    for (const name of ['requirePermission', 'requireFeature', 'enforceUsageLimits', 'can']) {
      expect(AMBIENT.has(name), `${name} must not be treated as ambient`).toBe(false);
      expect(NOT_A_GATE.has(name)).toBe(false);
    }
  });
});

describe('the baseline is a worklist', () => {
  const baseline = JSON.parse(read('docs/dead-policy-gates-baseline.json')) as {
    note: string;
    accepted: Record<string, string>;
  };

  it('gives every entry a reason that says covered or gap', () => {
    const entries = Object.entries(baseline.accepted);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, why] of entries) {
      expect(why, `${key} has no reason`).toBeTruthy();
      expect(why.length, `${key}'s reason is too thin`).toBeGreaterThan(80);
    }
  });

  it('records the LAUNCH-013 gap by name, and the one round 170 corrected', () => {
    expect(baseline.accepted['server/routes-crm-core.ts::enforceUsageLimits']).toMatch(/GAP/);
    // Not a gap: the edge function serves no AI path for the flag to gate.
    expect(baseline.accepted['server/routes-csv-import.ts::requireFeature']).toMatch(
      /COVERED BY ABSENCE/,
    );
  });
});

describe('the comparison, against fixtures', () => {
  it('passes when every key is accepted with a reason', () => {
    expect(compareToBaseline(['a::g'], { 'a::g': 'because' })).toEqual([]);
  });

  it('reports a new key, an unreasoned one, and a stale one', () => {
    expect(compareToBaseline(['a::g'], {})).toEqual([{ kind: 'new', key: 'a::g' }]);
    expect(compareToBaseline(['a::g'], { 'a::g': '' })).toEqual([
      { kind: 'unreasoned', key: 'a::g' },
    ]);
    expect(compareToBaseline([], { 'gone::g': 'because' })).toEqual([
      { kind: 'stale', key: 'gone::g' },
    ]);
  });
});

describe('the subscription middleware says it is dev-only (LAUNCH-013)', () => {
  const src = read('server/middleware/subscription.ts');

  it('carries the header rather than reading as enforcement', () => {
    expect(src).toContain('RUNS IN DEVELOPMENT ONLY');
    expect(src).toContain('check:dead-policy-gates');
  });

  /**
   * A warning about a file wants a check that the condition it warns about
   * still holds (round 114). The header says no edge function enforces plan
   * limits; this fails the day one starts to, so the header is revisited
   * instead of quietly outliving its reason.
   */
  it('and no edge function has started enforcing plan limits behind its back', () => {
    const edgeRoot = resolve(repoRoot, 'supabase/functions');
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.ts')) {
          const body = stripComments(readFileSync(p, 'utf8'));
          if (/tenant_subscriptions|subscription_plans|usage_metrics/.test(body)) {
            readers.push(
              p
                .slice(edgeRoot.length + 1)
                .split('\\')
                .join('/'),
            );
          }
        }
      }
    };
    walk(edgeRoot);
    // The management surface and the Stripe helper. Anything else means an
    // enforcement point has appeared and this story's note needs rewriting.
    expect(readers.sort()).toEqual(['_shared/stripe.ts', 'subscriptions/index.ts']);
  });

  it('and the billing function still carries no plan check', () => {
    const billing = resolve(repoRoot, 'supabase/functions/billing');
    expect(existsSync(billing)).toBe(true);
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(p));
        else if (entry.name.endsWith('.ts')) out.push(p);
      }
      return out;
    };
    const files = walk(billing);
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      expect(
        /tenant_subscriptions|subscription_plans|usage_metrics/.test(
          stripComments(readFileSync(f, 'utf8')),
        ),
        `${f} now checks a plan - LAUNCH-013's note is stale`,
      ).toBe(false);
    }
  });
});
