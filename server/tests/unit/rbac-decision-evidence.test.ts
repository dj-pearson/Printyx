/**
 * WF-R-01: the evidence the RBAC decision rests on.
 *
 * This story is decision and bookkeeping - no handler changed. What it produced is
 * a claim about the tree (docs/rbac-decision.md), and two closed stories reopened
 * on that claim. A claim nothing checks drifts: RBAC-008 and RBAC-009 were marked
 * passing while the code said otherwise for long enough that the landscape had to
 * be derived four times.
 *
 * So this pins the specific facts the decision turns on. If one of them stops
 * being true - somebody wires up scope-middleware, or gives usePermissions a
 * nullable roleCode - this test fails and the decision record is re-read rather
 * than quietly outlived.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Comments stripped: a file that explains a symbol is not a file that uses it. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('WF-R-01: the decision is written down', () => {
  it('the record exists and answers all three questions', () => {
    expect(existsSync('docs/rbac-decision.md')).toBe(true);
    const doc = readFileSync('docs/rbac-decision.md', 'utf8');
    expect(doc).toMatch(/Which role table survives/i);
    expect(doc).toMatch(/Which vocabulary is canonical/i);
    expect(doc).toMatch(/Migration order/i);
  });

  it('the landscape doc points at it, so the landscape is not re-derived', () => {
    const doc = readFileSync('docs/rbac-landscape.md', 'utf8');
    expect(doc).toMatch(/## Decision/);
    expect(doc).toContain('docs/rbac-decision.md');
  });
});

describe('WF-R-01: RBAC-008 — the scoping middleware has no caller', () => {
  it('nothing imports server/middleware/scope-middleware.ts', () => {
    const importers = [
      ...walk('server'),
      ...walk('client/src'),
      ...walk('supabase/functions'),
    ].filter(
      (f) => !f.endsWith('scope-middleware.ts') && !f.endsWith('rbac-decision-evidence.test.ts'),
    );

    const referencing = importers.filter((f) => code(f).includes('scope-middleware'));
    // If this fails because somebody wired it up, that is RBAC-008 progressing -
    // update the story rather than the assertion.
    expect(referencing, `scope-middleware is now imported by: ${referencing.join(', ')}`).toEqual(
      [],
    );
  });
});

describe('WF-R-01: RBAC-009 — the dashboard role fallbacks are unreachable', () => {
  it('usePermissions never returns an empty roleCode', () => {
    const src = code('client/src/hooks/usePermissions.ts');
    // role?.code || role?.name || 'USER' — the literal default is what makes the
    // consumer's `if (roleCode)` always true.
    expect(src).toMatch(/roleCode[^=]*=\s*role\?\.code\s*\|\|\s*role\?\.name\s*\|\|\s*'USER'/);
  });

  it('RoleBasedDashboard returns on that value before any fallback runs', () => {
    const src = code('client/src/components/dashboards/RoleBasedDashboard.tsx');
    const at = src.indexOf('if (roleCode) return roleCode.toUpperCase()');
    expect(at, 'the short-circuit is gone — re-read WF-R-10').toBeGreaterThan(-1);

    // Everything below it is dead: the level tiers and the department inference.
    const after = src.slice(at);
    expect(after).toMatch(/level >= 7/);
    expect(after).toMatch(/dept === 'sales'/);
  });

  it("'USER' is not a seeded layout, so those users get the generic dashboard", () => {
    const registry = code('client/src/lib/dashboard-widget-registry.ts');
    expect(registry).not.toMatch(/DEFAULT_ROLE_LAYOUTS\s*\[\s*'USER'\s*\]/);
    expect(registry).not.toMatch(/^\s*USER:\s*\[/m);
  });
});
