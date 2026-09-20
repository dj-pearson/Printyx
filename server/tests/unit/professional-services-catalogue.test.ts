/**
 * Two domains shared one prefix and the wrong one answered (SEC-EDGE-001).
 *
 * Every caller of `/api/professional-services` wants the product CATALOGUE:
 * ProfessionalServices.tsx lists and creates catalogue rows, and the quote
 * builder's ProductTypeSelector fills its "Installation, training, consulting"
 * picker from it. Express serves exactly that, off the real
 * `professional_services` table.
 *
 * The edge function served PROJECTS instead, off `professional_services_projects`
 * and `project_tasks` - neither of which exists in any Drizzle schema or
 * migration. The prefix is not proxied, so dev ran Express and worked while
 * production ran this and did not, and the list branch SWALLOWED the
 * missing-table error and answered `[]` at 200. The failure looked like a
 * dealer who had never configured any professional services, and a rep could
 * not add installation or training to a quote with nothing saying why.
 *
 * The sharpest statement of it: `POST /import` already wrote the REAL catalogue
 * table through the shared spec, so one function imported a CSV successfully
 * and then listed nothing.
 *
 * AND THE BULK DELETE LIED ON FOUR PAGES. ManagedServices, ProfessionalServices,
 * Supplies and EnhancedProductAccessories each looped a DELETE with `catch {}`
 * and then reported `Deleted ${ids.length}` regardless. One helper now, so the
 * fifth page inherits the rules instead of the defect.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { professionalServices } from '../../../shared/schema';
import { bulkDelete, bulkDeleteToast } from '../../../client/src/lib/bulk-delete';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments blanked on both sides: these files describe the defects they fix. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const FN = strip(read('supabase/functions/professional-services/index.ts'));
const SELECTOR = read('client/src/components/quote-builder/ProductTypeSelector.tsx');

describe('the prefix now serves the catalogue its callers ask for', () => {
  it('has a corpus to check', () => {
    expect(FN.length).toBeGreaterThan(3000);
  });

  it('the quote builder really does point its picker here', () => {
    // The whole repoint rests on this. If the selector used another prefix,
    // serving projects here would have been defensible.
    const at = SELECTOR.indexOf("endpoint: '/api/professional-services'");
    expect(at).toBeGreaterThan(-1);
    expect(SELECTOR.slice(Math.max(0, at - 300), at)).toContain('Professional Services');
  });

  it('the bare prefix and /:id read the real catalogue table', () => {
    // Bound to each branch: a file-wide presence check passes while one of the
    // two still points at the phantom projects table.
    for (const branch of [
      "req.method === 'GET' && !segment",
      "req.method === 'GET' && serviceId",
    ]) {
      const at = FN.indexOf(branch);
      expect({ branch, found: at > -1 }).toEqual({ branch, found: true });
      const body = FN.slice(at, at + 400);
      expect({ branch, table: body.includes("from('professional_services')") }).toEqual({
        branch,
        table: true,
      });
    }
  });

  it('create, update and delete write the catalogue too', () => {
    for (const branch of [
      "req.method === 'POST' && !segment",
      "(req.method === 'PATCH' || req.method === 'PUT') && serviceId",
      "req.method === 'DELETE' && serviceId",
    ]) {
      const at = FN.indexOf(branch);
      expect({ branch, found: at > -1 }).toEqual({ branch, found: true });
      const body = FN.slice(at, at + 900);
      expect({ branch, table: body.includes("from('professional_services')") }).toEqual({
        branch,
        table: true,
      });
    }
  });

  it('every column the patch map names is a real one', () => {
    // check:phantom-cols cannot resolve a column applied through a helper, so
    // drizzle's own table config is the authority (the same treatment
    // portal-service needed one round earlier).
    const columns = new Set(getTableConfig(professionalServices).columns.map((c) => c.name));
    const at = FN.indexOf('function cataloguePatch(');
    expect(at).toBeGreaterThan(-1);
    const body = FN.slice(at, FN.indexOf('\n}', at));
    const named = [...body.matchAll(/set\('([a-z0-9_]+)'/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(20);
    expect(named.filter((c) => !columns.has(c))).toEqual([]);
  });

  it('writes are tenant-bound and a miss is a 404', () => {
    for (const verb of ['.update(patch)', '.delete()']) {
      const at = FN.indexOf(verb);
      expect({ verb, found: at > -1 }).toEqual({ verb, found: true });
      expect({
        verb,
        scoped: FN.slice(at, at + 200).includes("eq('tenant_id', tenantId)"),
      }).toEqual({ verb, scoped: true });
    }
    expect(FN).toContain("error: 'Professional service not found'");
  });

  it('is gated like the rest of the catalogue family', () => {
    expect(FN).toContain("WRITE_PERMISSION = 'operations.inventory.manage'");
    const gate = FN.indexOf("req.method !== 'GET'");
    expect(gate).toBeGreaterThan(-1);
    for (const branch of [
      "req.method === 'POST' && !segment",
      "req.method === 'DELETE' && serviceId",
    ]) {
      expect(gate).toBeLessThan(FN.indexOf(branch));
    }
  });
});

describe('the project half is kept, moved, and stops pretending', () => {
  it('lives under /projects so the catalogue can own the prefix', () => {
    expect(FN).toMatch(/const isProjects = segment === 'projects';/);
    // Every project branch is keyed on it - a total is not a property.
    const projectBranches = [...FN.matchAll(/from\('professional_services_projects'\)/g)];
    expect(projectBranches.length).toBeGreaterThanOrEqual(4);
  });

  it('reserved segments keep /import and /projects out of the id branch', () => {
    // Bound to the SET LITERAL: both words appear in their own branch
    // conditions, so a file-wide check stays green when one is removed.
    const at = FN.indexOf('RESERVED_SEGMENTS = new Set([');
    expect(at).toBeGreaterThan(-1);
    const literal = FN.slice(at, FN.indexOf(']);', at));
    for (const seg of ['import', 'projects']) {
      expect({ seg, reserved: literal.includes(`'${seg}'`) }).toEqual({ seg, reserved: true });
    }
  });

  it('a missing relation is 503, never an empty list', () => {
    // An empty array is a measurement - "this dealer runs no projects" - and
    // the table does not exist, so it was never true.
    expect(FN).toMatch(/function projectsUnavailable\(/);
    expect(
      FN.slice(
        FN.indexOf('function projectsUnavailable('),
        FN.indexOf('function projectsUnavailable(') + 600,
      ),
    ).toContain("code: 'RELATION_MISSING'");
    /**
     * WALKED PER BRANCH, not counted. The first version asserted
     * `isMissingTableError` appeared at least seven times, and removing the one
     * on the project LIST - the branch whose swallowed `[]` was the original
     * defect - left eight minus one, which still passed. A total is not a
     * property, for the fourth time this session.
     */
    const projectErrors = [
      "error: 'Failed to fetch projects'",
      "error: 'Failed to fetch active projects'",
      "error: 'Project not found'",
      "error: 'Failed to create project'",
      "error: 'Failed to update project'",
      "error: 'Failed to create task'",
      "error: 'Failed to log time'",
      "error: 'Failed to delete project'",
    ];
    for (const msg of projectErrors) {
      const at = FN.indexOf(msg);
      expect({ msg, found: at > -1 }).toEqual({ msg, found: true });
      const before = FN.slice(Math.max(0, at - 260), at);
      expect({ msg, checked: before.includes('isMissingTableError(error)') }).toEqual({
        msg,
        checked: true,
      });
    }
    // And no project branch may answer an empty list instead.
    expect(FN).not.toMatch(/return createCorsResponse\(\[\], 200, req\);/);
  });

  it('the project update maps columns instead of spreading the body', () => {
    expect(FN).not.toMatch(/\.update\(\{ \.\.\.body/);
    expect(FN).toMatch(/function projectPatch\(/);
  });
});

describe('bulkDelete reports what happened, on every page that had the copy', () => {
  it('counts successes rather than attempts', async () => {
    const outcome = await bulkDelete(['a', 'b', 'c'], async (id) => {
      if (id === 'b') throw new Error('404');
    });
    expect(outcome).toEqual({ deleted: ['a', 'c'], failed: ['b'] });
  });

  it('carries on past a failure rather than aborting the loop', async () => {
    // Stopping at the first failure leaves the user unable to tell what went.
    const seen: string[] = [];
    await bulkDelete(['a', 'b', 'c'], async (id) => {
      seen.push(id);
      throw new Error('nope');
    });
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('a total failure is not a success', () => {
    const t = bulkDeleteToast({ deleted: [], failed: ['a', 'b'] }, 'services');
    expect(t.title).toBe('Nothing deleted');
    expect(t.variant).toBe('destructive');
  });

  it('a partial failure is not a success either', () => {
    const t = bulkDeleteToast({ deleted: ['a'], failed: ['b'] }, 'services');
    expect(t.title).toBe('Partly deleted');
    expect(t.variant).toBe('destructive');
    expect(t.description).toContain('1 of 2');
  });

  it('a clean run says so, with the real count', () => {
    const t = bulkDeleteToast({ deleted: ['a', 'b'], failed: [] }, 'supplies');
    expect(t).toEqual({ title: 'Deleted', description: 'Deleted 2 supplies.' });
  });

  it('all four pages use it, and none still swallows', () => {
    const pages = [
      'client/src/pages/ManagedServices.tsx',
      'client/src/pages/ProfessionalServices.tsx',
      'client/src/pages/Supplies.tsx',
      'client/src/pages/EnhancedProductAccessories.tsx',
    ];
    for (const p of pages) {
      const src = strip(read(p));
      expect({ p, uses: src.includes('await bulkDelete(') }).toEqual({ p, uses: true });
      expect({ p, toast: src.includes('bulkDeleteToast(outcome,') }).toEqual({ p, toast: true });
      // The failures stay selected so a retry does not mean finding them again.
      expect({ p, keeps: src.includes('setSelectedIds(new Set(outcome.failed))') }).toEqual({
        p,
        keeps: true,
      });
      expect({ p, swallows: /catch \{\}/.test(src) }).toEqual({ p, swallows: false });
    }
  });
});

describe('the verdict is recorded with the paths behind it', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json')) as {
    counts: Record<string, number>;
    triage: { fn: string; verdict: string; reason?: string; pathsRead?: string }[];
  };

  it('is filed gated-branch with the paths that were read', () => {
    const entry = triage.triage.find((e) => e.fn === 'professional-services');
    expect(entry?.verdict).toBe('gated-branch');
    expect((entry?.pathsRead ?? '').length).toBeGreaterThan(80);
  });

  it('the counts block still matches the entries it summarises', () => {
    const actual: Record<string, number> = {};
    for (const e of triage.triage) actual[e.verdict] = (actual[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(actual);
    expect(triage.counts.unexamined).toBeGreaterThan(0);
    expect(triage.counts.unexamined).toBeLessThan(20);
  });
});
