/**
 * Two surfaces, one row (CRM-LAYOUT-001).
 *
 * `/dashboard` (the role dashboard, via `dashboard-widgets`) and
 * `/custom-dashboard` (via the dashboard function's layouts handler) both
 * stored "the one custom layout per user" in `dashboard_layouts`, and both
 * filtered on `(tenant_id, user_id, is_user_custom)` and nothing else. So a
 * layout saved on one screen could be handed to the other - and
 * `saveLayout`'s existence check did it with no ORDER BY, which made the winner
 * arbitrary rather than merely wrong.
 *
 * Proven against a real PostgreSQL before this was written: with two rows for
 * one user the old filter matched both, and each surface's new filter returns
 * exactly its own.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { dashboardLayouts } from '../../../shared/schema-dashboard';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const WIDGETS = read('supabase/functions/dashboard-widgets/index.ts');
const LAYOUTS = read('supabase/functions/dashboard/handlers/layouts.ts');
const WIDGETS_CODE = strip(WIDGETS);
const LAYOUTS_CODE = strip(LAYOUTS);

describe('the discriminator exists and is not user-typeable', () => {
  it('surface is a real column', () => {
    const columns = Object.values(getTableColumns(dashboardLayouts)).map(
      (c) => (c as { name: string }).name,
    );
    expect(columns).toContain('surface');
  });

  it('and the migration adds it with the backfill', () => {
    const sql = read('drizzle/migrations/0096_cold_ted_forrester.sql');
    expect(sql).toContain('ADD COLUMN "surface"');
    // ADD COLUMN ... DEFAULT backfills EVERY row to 'custom', including the
    // role dashboard's, so the correction has to follow or the discriminator
    // starts wrong for exactly the rows it exists to separate.
    expect(sql).toContain('SET "surface" = \'role-dashboard\'');
    expect(sql).toContain('"name" = \'Custom Dashboard\'');
  });

  it('is not `name`, which a user can type', () => {
    // The story's own AC suggested `name` as the smallest change. It is not
    // safe: CustomDashboard lets the user name their dashboard, so a user
    // typing "Custom Dashboard" collides with the row the discriminator is
    // meant to separate.
    // Whitespace collapsed: prettier decides where a comment wraps, and the
    // unwrapped form of this sentence stopped matching the moment it did.
    // Whitespace collapsed AND the JSDoc `*` prefixes removed: prettier decides
    // where a comment wraps, and a wrapped sentence carries a ` * ` in the
    // middle of it. Collapsing whitespace alone left "...can type is * not...".
    const schema = read('shared/schema-dashboard.ts')
      .replace(/^\s*\*\s?/gm, '')
      .replace(/\s+/g, ' ');
    expect(schema).toContain('A discriminator a user can type is not a discriminator');
    expect(schema).toContain("surface: varchar('surface'");
  });
});

describe('every read and write on both surfaces carries it', () => {
  const pairs: Array<[string, string, string]> = [
    ['dashboard-widgets', WIDGETS_CODE, 'ROLE_DASHBOARD_SURFACE'],
    ['layouts handler', LAYOUTS_CODE, 'CUSTOM_DASHBOARD_SURFACE'],
  ];

  for (const [label, code, constant] of pairs) {
    it(`${label} filters every is_user_custom query by surface`, () => {
      // One unguarded query is the whole defect back: it is the query that
      // reads the other screen's row.
      const shared = (code.match(/\.eq\('is_user_custom', true\)/g) ?? []).length;
      const scoped = (code.match(new RegExp(`\\.eq\\('surface', ${constant}\\)`, 'g')) ?? [])
        .length;
      expect(shared).toBeGreaterThan(0);
      expect(scoped).toBe(shared);
    });

    it(`${label} writes it on insert`, () => {
      expect(code).toContain(`surface: ${constant}`);
    });
  }

  it('the two surfaces are different values', () => {
    const roleValue = /const ROLE_DASHBOARD_SURFACE = '([^']+)'/.exec(WIDGETS)?.[1];
    const customValue = /const CUSTOM_DASHBOARD_SURFACE = '([^']+)'/.exec(LAYOUTS)?.[1];
    expect(roleValue).toBeTruthy();
    expect(customValue).toBeTruthy();
    expect(roleValue).not.toBe(customValue);
  });

  it("the custom surface matches the column's default", () => {
    // ADD COLUMN defaulted every existing row to 'custom', and the backfill
    // moves only the role-dashboard ones. If this constant were anything else,
    // every pre-existing custom layout would be orphaned by its own migration.
    const customValue = /const CUSTOM_DASHBOARD_SURFACE = '([^']+)'/.exec(LAYOUTS)?.[1];
    expect(read('drizzle/migrations/0096_cold_ted_forrester.sql')).toContain(
      `DEFAULT '${customValue}'`,
    );
  });
});

describe('both reads are deterministic', () => {
  it('neither takes limit(1) without an order', () => {
    // AC4. A row predating the column can leave two candidates, and an update
    // that picks a different one than the read did shows the user a layout
    // they did not just save.
    for (const code of [LAYOUTS_CODE]) {
      const chains = code.split('.from(');
      for (const chain of chains) {
        if (!chain.includes('.limit(1)')) continue;
        expect(chain.slice(0, chain.indexOf('.limit(1)'))).toContain(".order('updated_at'");
      }
    }
  });
});

describe('the stale second declaration is gone', () => {
  it('reporting-schema no longer declares dashboard_layouts', () => {
    // It described the table as migration 0000 created it; 0002 dropped eight
    // of its columns. Nothing imported it, so nothing broke - what it cost was
    // check:phantom-cols, which skips a table declared twice rather than guess.
    const reporting = read('shared/reporting-schema.ts');
    expect(strip(reporting)).not.toContain("pgTable(\n  'dashboard_layouts'");
  });

  it('and the duplicate-table baseline no longer lists it', () => {
    const baseline = read('docs/duplicate-tables-baseline.json');
    expect(baseline).not.toContain('dashboard_layouts');
  });
});
