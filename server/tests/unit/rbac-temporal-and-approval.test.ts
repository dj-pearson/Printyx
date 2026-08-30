import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { permissionOverrides, userRoleAssignments } from '../../enhanced-rbac-schema';

/**
 * QUALITY-002. Three defects in the RBAC layer, all of which typechecked as
 * errors inside the ratchet and none of which any test could see.
 *
 * 1. `eq(col, null)` renders as `col = NULL`, which is never true in SQL. Both
 *    the assignment and override queries wrapped it in
 *    `or(eq(effectiveUntil, null), effectiveUntil > NOW())`, so the OR collapsed
 *    to its second half and a grant with NO expiry - the normal shape for a
 *    permanent one - matched nothing.
 * 2. permission_overrides has no `approvalStatus` column; approval is recorded
 *    by approved_by + approval_date. Comparing a property that does not exist
 *    made both branches false, so an approved override never granted anything.
 * 3. `(await import('../db')).users` resolved to undefined, because server/db
 *    exports the client, not the schema.
 *
 * Source text is the only thing to assert against here: these are query
 * builders that need a live database to execute.
 */
const repoRoot = join(__dirname, '..', '..', '..');

function codeOf(...segments: string[]): string {
  // Comments stripped first - the comments explaining these fixes necessarily
  // name the broken form, and a check that cannot tell prose from code reports
  // its own explanation as the defect.
  return readFileSync(join(repoRoot, 'server', ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const RBAC_SOURCES = [['middleware', 'enhanced-rbac-middleware.ts'], ['enhanced-rbac-service.ts']];

describe('RBAC temporal filters and override approval', () => {
  it('no RBAC query compares a column to null with eq()', () => {
    for (const segments of RBAC_SOURCES) {
      const source = codeOf(...segments);
      expect(source, segments.join('/')).not.toMatch(/eq\([A-Za-z_.]+,\s*null\)/);
      expect(source, segments.join('/')).toMatch(/isNull\(/);
    }
  });

  it('permission_overrides really has no approvalStatus column', () => {
    const columns = Object.keys(getTableColumns(permissionOverrides));
    expect(columns).not.toContain('approvalStatus');
    // What approval is actually recorded as.
    expect(columns).toContain('approvedBy');
    expect(columns).toContain('approvalDate');
  });

  it('the approval check reads approvedBy/approvalDate, not approvalStatus', () => {
    const source = codeOf('middleware', 'enhanced-rbac-middleware.ts');
    // Scoped to the property READ. `approvalStatus` is also a perfectly good
    // local variable name a few lines below, and a bare substring check would
    // fail on it.
    expect(source).not.toMatch(/override\.approvalStatus/);
    expect(source).not.toMatch(/\.approvalStatus\s*===/);
    expect(source).toMatch(/override\.approvedBy && override\.approvalDate/);
  });

  it('both tables carry the nullable effectiveUntil these queries filter on', () => {
    expect(Object.keys(getTableColumns(userRoleAssignments))).toContain('effectiveUntil');
    expect(Object.keys(getTableColumns(permissionOverrides))).toContain('effectiveUntil');
  });

  it('users comes from the shared schema, not a dynamic import of server/db', () => {
    const source = codeOf('middleware', 'enhanced-rbac-middleware.ts');
    expect(source).not.toMatch(/await import\('\.\.\/db'\)\)\.users/);
    expect(source).toMatch(/import \{ users \} from '@shared\/schema'/);
  });
});
