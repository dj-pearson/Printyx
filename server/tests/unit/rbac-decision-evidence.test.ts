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
    ].filter((f) => !f.endsWith('scope-middleware.ts'));

    // An IMPORT, not a mention. This used to match any occurrence of the
    // basename in a comment-stripped file, which meant it fired the moment
    // another test named the path in a string - WF-G-03's guard test does
    // exactly that, and an assertion whose own name is "nothing imports" was
    // reporting a fixture as a caller. The self-exemption by filename that used
    // to be needed is gone with it.
    const IMPORT_RE =
      /(?:^|\n)\s*import[^;\n]*['"][^'"\n]*scope-middleware[^'"\n]*['"]|require\(\s*['"][^'"\n]*scope-middleware[^'"\n]*['"]|await import\(\s*['"][^'"\n]*scope-middleware[^'"\n]*['"]/;
    const referencing = importers.filter((f) => IMPORT_RE.test(code(f)));
    // If this fails because somebody wired it up, that is RBAC-008 progressing -
    // update the story rather than the assertion.
    expect(referencing, `scope-middleware is now imported by: ${referencing.join(', ')}`).toEqual(
      [],
    );
  });
});

describe('WF-R-10: the dashboard role fallbacks are reachable again', () => {
  // CORRECTED 2026-09-18. These two assertions used to require the DEFECT -
  // they pinned `role?.code || role?.name || 'USER'` and the short-circuit
  // above the inference, and the second carried the message "the short-circuit
  // is gone - re-read WF-R-10" so it would fail the day somebody fixed it.
  // That day came; they are inverted rather than deleted, because the pair is
  // still the cheapest description of what was wrong.

  it('usePermissions returns the role CODE, never a display name', () => {
    const src = code('client/src/hooks/usePermissions.ts');
    // The old value was always truthy, which is what made the consumer's
    // `if (roleCode)` short-circuit everything beneath it.
    expect(src).not.toMatch(/roleCode[^=]*=\s*role\?\.code\s*\|\|\s*role\?\.name/);
    expect(src).toMatch(/const roleCode: string = role\?\.code \|\| '';/);
  });

  it('RoleBasedDashboard resolves through the shared ladder, not an inline chain', () => {
    const src = code('client/src/components/dashboards/RoleBasedDashboard.tsx');
    expect(src).not.toContain('if (roleCode) return roleCode.toUpperCase()');
    expect(src).toContain('resolveRoleLayoutKey({');

    // The level tiers and the department inference moved into
    // dashboard-widget-registry.ts, where they can be tested against every
    // seeded role code without mounting a component.
    const registry = code('client/src/lib/dashboard-widget-registry.ts');
    expect(registry).toMatch(/level >= 7/);
    expect(registry).toMatch(/dept === 'sales'/);
  });

  it("'USER' is not a seeded layout, so those users get the generic dashboard", () => {
    const registry = code('client/src/lib/dashboard-widget-registry.ts');
    expect(registry).not.toMatch(/DEFAULT_ROLE_LAYOUTS\s*\[\s*'USER'\s*\]/);
    expect(registry).not.toMatch(/^\s*USER:\s*\[/m);
  });
});
