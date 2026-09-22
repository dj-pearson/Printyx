/**
 * COP-B04 AC4: plays are scoped to the rep's ownership AND RBAC scope.
 *
 * The list had `?mine=true` and nothing else, and a filter the CALLER chooses
 * is not an access check. Omitting one query parameter returned up to 500
 * plays from across the whole tenant - each carrying an account name, the
 * machines, the trigger and an estimated dollar value - so every rep could
 * read every other rep's book of opportunities. COP-I06 found the same shape
 * on the forecast categories, and the fix is the same one: the scope goes on
 * FIRST and the query parameters filter inside it.
 *
 * Asserted by reading source, because nothing typechecks the edge tree and
 * ORDER is the property - a scope applied after a caller's filter still reads
 * as protected.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const fn = readFileSync(path.join(root, 'supabase/functions/opportunity-radar/index.ts'), 'utf-8');

/** The list branch alone, so nothing drifts in from a neighbouring handler. */
function listBranch(): string {
  const start = fn.indexOf("if (req.method === 'GET' && !resource)");
  expect(start).toBeGreaterThan(-1);
  return fn.slice(start, fn.indexOf('return createCorsResponse', fn.indexOf('unbacked:', start)));
}

/** The single-play branch, from the row load to the dismiss handler. */
function itemBranch(): string {
  const start = fn.indexOf('if (!play) return createCorsResponse');
  expect(start).toBeGreaterThan(-1);
  return fn.slice(start, fn.indexOf("if (action === 'dismiss'", start));
}

describe('the play list is row-scoped', () => {
  const branch = listBranch();

  it('resolves the caller scope and applies it to the query', () => {
    expect(branch).toContain('resolveScope(admin');
    expect(branch).toContain("applyUserScope(query, 'owner_id', scope)");
  });

  it('applies the scope BEFORE the caller-supplied filters', () => {
    const scopeAt = branch.indexOf("applyUserScope(query, 'owner_id', scope)");
    const mineAt = branch.indexOf("searchParams.get('mine')");
    const typeAt = branch.indexOf("searchParams.get('playType')");
    expect(scopeAt).toBeGreaterThan(-1);
    // A parameter applied before the scope is a filter the caller controls;
    // applied after, it is a filter inside a box they do not.
    expect(mineAt).toBeGreaterThan(scopeAt);
    expect(typeAt).toBeGreaterThan(scopeAt);
  });

  it('reports the tier, so a shorter list is explicable', () => {
    expect(branch).toContain('scopeTier: scope.tier');
    expect(branch).toContain('coversWholeTenant: scope.userIds === null');
  });
});

describe('dismiss and convert are scoped to the row they act on', () => {
  const branch = itemBranch();

  it('refuses a play owned outside the caller scope', () => {
    expect(branch).toContain('OUT_OF_SCOPE');
    expect(branch).toContain('itemScope.userIds.includes(playOwner)');
  });

  it('leaves an unowned play actionable', () => {
    // Nobody is deprived of a play nobody has claimed - the same default
    // applyUserScope encodes for a tier above 'own'.
    expect(branch).toContain('playOwner === null');
  });

  it('checks before the action, not after', () => {
    const checkAt = fn.indexOf('OUT_OF_SCOPE');
    const dismissAt = fn.indexOf("if (action === 'dismiss'");
    const convertAt = fn.indexOf("if (action === 'convert'");
    expect(checkAt).toBeLessThan(dismissAt);
    expect(checkAt).toBeLessThan(convertAt);
  });
});

/**
 * AC3's one-click convert, verified against the real schema rather than by
 * reading the handler. `check:phantom-cols` cannot see this insert: its own
 * documented blind spot is a payload built as a named variable, and
 * `dealFromPlay` is exactly that.
 */
describe('AC3: the deal a play converts into is writable', () => {
  it('names only real columns and supplies every required one', async () => {
    const { getTableConfig } = await import('drizzle-orm/pg-core');
    const { deals } = await import('../../../shared/schema');
    const config = getTableConfig(deals as never);
    const columns = new Set(config.columns.map((c) => c.name));

    const source = readFileSync(
      path.join(root, 'supabase/functions/_shared/opportunity-radar.ts'),
      'utf-8',
    );
    const body = source.slice(source.indexOf('export function dealFromPlay'));
    const written = [...body.slice(0, body.indexOf('\n}')).matchAll(/^\s{4}([a-z_]+):/gm)].map(
      (m) => m[1],
    );
    expect(written.length).toBeGreaterThan(10);

    for (const column of written) {
      expect(columns.has(column), `dealFromPlay writes ${column}, which deals does not have`).toBe(
        true,
      );
    }

    const required = config.columns
      .filter((c) => c.notNull && !c.hasDefault)
      .map((c) => c.name)
      .filter((name) => name !== 'id');
    for (const column of required) {
      expect(written, `deals.${column} is NOT NULL with no default and is not written`).toContain(
        column,
      );
    }
  });

  it('attaches the machines through a relation the deal page actually reads', async () => {
    const dealsFn = readFileSync(path.join(root, 'supabase/functions/deals/index.ts'), 'utf-8');
    // The radar writes 'replaces'; the deals function reads 'replaces'. A link
    // written under any other label would exist and surface nowhere.
    expect(fn).toContain("relation: 'replaces'");
    expect(dealsFn).toContain(".eq('relation', 'replaces')");

    const { CRM_ASSOCIABLE_TYPES } = await import('../../../shared/crm-associations-schema');
    expect(CRM_ASSOCIABLE_TYPES).toContain('equipment');
  });
});
