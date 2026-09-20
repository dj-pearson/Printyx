/**
 * The managed-services catalogue: a gate, two missing handlers and a toast that
 * lied (SEC-EDGE-001).
 *
 * THE GATE is the third of the catalogue family. product-models and
 * software-products both require `operations.inventory.manage` for a write;
 * managed-services was open to every tenant member, and adding, editing,
 * importing or deleting one of these products changes what every rep can put on
 * a quote and at what price. Reads stay open because the quote builder's
 * ProductTypeSelector fills its picker from `GET /`.
 *
 * THE TWO DEFECTS are both prod-only, because `/api/managed-services` is not in
 * crmProxies. The edge function had NO `/:id` branch, so the routed page's
 * PATCH and DELETE fell through to its 404 while Express served working
 * handlers on every developer machine. And the page's bulk delete wrapped each
 * call in `catch {}` and then reported `Deleted ${ids.length}` regardless - so a
 * rep could select twenty products in production, be told all twenty were gone,
 * and have none deleted.
 *
 * FOUR OF THE FIVE TABLES DO NOT EXIST. The contract, usage, meter-reading,
 * billing and dashboard branches all run over relations in no schema and no
 * migration, and no client calls any of them. They answer 503 now instead of a
 * 500 that reads as an outage - or, for /usage and /dashboard, a discarded
 * error behind a 200 of zeroes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Comments blanked: the file explains each defect it fixes, and an absence
 *  assertion that matches its own explanation reports the fix as the bug. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const FN = strip(read('supabase/functions/managed-services/index.ts'));
// Stripped too: the page now carries a comment quoting the `catch {}` it
// replaced, and an absence assertion over the raw file matches its own
// explanation. Sixth time this trap has fired in this session.
const PAGE = strip(read('client/src/pages/ManagedServices.tsx'));
const NAV = read('client/src/lib/navigation-permissions.ts');

describe('the write gate matches its siblings and spares the quote picker', () => {
  it('has a corpus to check', () => {
    expect(FN.length).toBeGreaterThan(3000);
    expect(FN).toContain("from('managed_services')");
  });

  it('uses the same permission the other two catalogue functions use', () => {
    const siblings = [
      'supabase/functions/product-models/index.ts',
      'supabase/functions/software-products/index.ts',
    ].map((p) => read(p));
    for (const src of siblings) {
      expect(src).toContain("WRITE_PERMISSION = 'operations.inventory.manage'");
    }
    expect(FN).toContain("WRITE_PERMISSION = 'operations.inventory.manage'");
    // And the page that manages this catalogue names it too.
    const at = NAV.indexOf("'/import/products'");
    expect(at).toBeGreaterThan(-1);
    expect(NAV.slice(at, at + 140)).toContain('operations.inventory.manage');
  });

  it('gates every write and no read', () => {
    const gate = FN.indexOf("req.method !== 'GET'");
    expect(gate).toBeGreaterThan(-1);
    expect(FN.slice(gate, gate + 200)).toContain(
      'denyWithoutPermission(admin, user, WRITE_PERMISSION)',
    );
    for (const branch of [
      "req.method === 'POST' && pathParts[0] === 'import'",
      "req.method === 'POST' && !endpoint",
      "(req.method === 'PATCH' || req.method === 'PUT') && serviceId",
      "req.method === 'DELETE' && serviceId",
    ]) {
      const at = FN.indexOf(branch);
      expect({ branch, found: at > -1 }).toEqual({ branch, found: true });
      expect({ branch, gated: gate < at }).toEqual({ branch, gated: true });
    }
    // The list read the quote builder depends on must stay above no gate.
    expect(FN).toMatch(/req\.method === 'GET' && !endpoint/);
  });
});

describe('the handlers the page was already calling now exist', () => {
  it('an id branch that does not swallow the named sub-resources', () => {
    // Without the reserved set, /contracts would be read as a product id and
    // the contract branches below would never run.
    // Bound to the SET LITERAL, not to the file. Every one of these words also
    // appears in its own branch condition, so a file-wide presence check stayed
    // green with 'contracts' deleted from the set - and the id branches sit
    // above the contract ones, so a PUT to /contracts/:id would then be read as
    // a product edit. A presence check is not a membership check.
    const at = FN.indexOf('RESERVED_SEGMENTS = new Set([');
    expect(at).toBeGreaterThan(-1);
    const literal = FN.slice(at, FN.indexOf(']);', at));
    for (const seg of ['import', 'contracts', 'usage', 'meter-reading', 'dashboard', 'billing']) {
      expect({ seg, reserved: literal.includes(`'${seg}'`) }).toEqual({ seg, reserved: true });
    }
    expect(FN).toMatch(/const serviceId =[\s\S]{0,120}RESERVED_SEGMENTS\.has\(endpoint\)/);
  });

  it('the update maps columns explicitly and never spreads the body', () => {
    // COP-M01: a spread lets the caller name every column, tenant_id included,
    // and the tenant filter decides WHICH row is written, not what goes in it.
    const at = FN.indexOf("(req.method === 'PATCH' || req.method === 'PUT') && serviceId");
    const branch = FN.slice(at, FN.indexOf("req.method === 'DELETE' && serviceId"));
    expect(branch).not.toMatch(/\.\.\.body/);
    expect(branch).toContain("set('product_code'");
    expect(branch).toContain("set('payment_type'");
  });

  it('an empty patch is a 400, not a 200 that bumps updated_at', () => {
    const at = FN.indexOf('EMPTY_PATCH');
    expect(at).toBeGreaterThan(-1);
    expect(FN.slice(Math.max(0, at - 300), at)).toMatch(/Object\.keys\(patch\)\.length === 1/);
  });

  it('both writes are bound by tenant, not by the id alone', () => {
    for (const verb of ['.update(patch)', '.delete()']) {
      const at = FN.indexOf(verb);
      expect({ verb, found: at > -1 }).toEqual({ verb, found: true });
      const chain = FN.slice(at, at + 200);
      expect({ verb, scoped: chain.includes("eq('tenant_id', tenantId)") }).toEqual({
        verb,
        scoped: true,
      });
    }
  });

  it('a delete that matched nothing is a 404, not a silent success', () => {
    const at = FN.indexOf("req.method === 'DELETE' && serviceId");
    const branch = FN.slice(at, at + 1200);
    expect(branch).toContain(".select('id')");
    expect(branch).toMatch(/removed\.length === 0/);
    expect(branch).toContain("error: 'Managed service not found'");
  });
});

describe('the page reports what actually happened', () => {
  it('bulk delete counts successes and failures instead of assuming', () => {
    /**
     * ASSERTED AS A PROPERTY, NOT A SHAPE. The first version of this pinned the
     * inline implementation (`let deleted = 0`), and three sibling pages turned
     * out to carry the identical swallowed loop - so the fix became one shared
     * helper and this test failed on a change that was strictly better. What
     * matters is that the page counts what happened and keeps the failures
     * selected, wherever the counting lives; client/src/lib/bulk-delete.ts owns
     * the rules and server/tests/unit/professional-services-catalogue.test.ts
     * exercises them with real inputs.
     */
    expect(PAGE).not.toMatch(/catch \{\}/);
    expect(PAGE).toMatch(/await bulkDelete\(ids,/);
    expect(PAGE).toMatch(/bulkDeleteToast\(outcome, 'managed services'\)/);
    // The failures stay selected so a retry does not mean finding them again.
    expect(PAGE).toMatch(/setSelectedIds\(new Set\(outcome\.failed\)\)/);
  });

  it('a partial or total failure does not render as success', () => {
    const at = PAGE.indexOf('const handleBulkDelete');
    const body = PAGE.slice(at, PAGE.indexOf('\n  };', at));
    // Bulk mode only closes on a clean run; a partial failure leaves the user
    // in the selection they still have to deal with.
    expect(body).toMatch(/outcome\.failed\.length === 0/);
    expect(body).toMatch(/setBulkMode\(false\)/);
  });

  it('the Edit button opens the form instead of setting state nothing reads', () => {
    expect(PAGE).toContain('onClick={() => startEdit(service)}');
    expect(PAGE).toMatch(/const startEdit = \(service: ManagedService\) => \{/);
    expect(PAGE).toContain("apiRequest(`/api/managed-services/${id}`, 'PATCH', data)");
    // onSubmit has to branch, or editing creates a duplicate.
    expect(PAGE).toMatch(/if \(selectedService\) \{\s*updateServiceMutation\.mutate/);
  });

  it('Add clears the edit target, or it patches the row you last edited', () => {
    // Bound to the FUNCTION BODY, stopping at its closing brace. A fixed
    // 200-character window ran straight past startCreate into closeDialog,
    // which also clears the target - so the mutant that deleted the line from
    // startCreate survived. Same trap as the 260-character branch window in
    // round 74.
    const at = PAGE.indexOf('const startCreate = () => {');
    expect(at).toBeGreaterThan(-1);
    const body = PAGE.slice(at, PAGE.indexOf('\n  };', at));
    expect(body).toContain('setSelectedService(null)');
    expect(body).toContain('setDialogOpen(true)');
    expect(PAGE).toContain('onAddClick={startCreate}');
    expect(PAGE).toContain('<Button onClick={startCreate}>');
  });

  it('a failed mutation shows the reason the server gave', () => {
    // apiRequest throws a plain Error carrying the message; discarding it left
    // every failure looking identical (CRM-008).
    expect(PAGE).toMatch(/error\.message \|\| 'Failed to create managed service'/);
    expect(PAGE).toMatch(/error\.message \|\| 'Failed to update managed service'/);
  });
});

describe('the half built on tables that do not exist says so', () => {
  it('answers 503 rather than 500 when the relation is missing', () => {
    expect(FN).toMatch(/function relationMissing\(/);
    const helper = FN.slice(FN.indexOf('function relationMissing('));
    expect(helper.slice(0, 700)).toContain("code: 'RELATION_MISSING'");
    expect(helper.slice(0, 700)).toContain('503');
  });

  it('every branch over a phantom table checks for it', () => {
    // Bound to each branch, not counted: a total passes while one is left to
    // report an outage.
    const branches = [
      "error: 'Failed to fetch contracts'",
      "error: 'Contract not found'",
      "error: 'Failed to create contract'",
      "error: 'Failed to update contract'",
      "error: 'Failed to record meter reading'",
      "error: 'Failed to generate billing'",
      "error: 'Failed to delete contract'",
    ];
    for (const b of branches) {
      const at = FN.indexOf(b);
      expect({ b, found: at > -1 }).toEqual({ b, found: true });
      const before = FN.slice(Math.max(0, at - 220), at);
      expect({ b, checked: before.includes('isMissingTableError(error)') }).toEqual({
        b,
        checked: true,
      });
    }
  });

  it('usage and dashboard stopped discarding their errors', () => {
    // These returned 200 with an empty array and a screen of zeroes - the
    // symptom is not an error, it is a business with no contracts.
    expect(FN).toMatch(/readingsError/);
    expect(FN).toMatch(/isMissingTableError\(readingsError\)/);
    const dash = FN.slice(FN.indexOf("endpoint === 'dashboard'"));
    expect(dash.slice(0, 1800)).toMatch(
      /const failure = \[contracts\.error, devices\.error, billing\.error\]\.find\(Boolean\)/,
    );
    // alertCount is null, not 0: nothing measures it.
    expect(dash.slice(0, 2200)).toMatch(/alertCount: null/);
  });

  it('the month filter is applied, not merely read', () => {
    // It was pulled off the query string and never used, so asking for one
    // month returned the most recent hundred readings from any month.
    const at = FN.indexOf("endpoint === 'usage'");
    const branch = FN.slice(at, FN.indexOf('Failed to fetch usage'));
    expect(branch).toMatch(/query = query\.gte\('reading_date'/);
    expect(branch).toMatch(/query = query\.lt\('reading_date'/);
    // DATE-LOCAL-002: a calendar-date column wants a snapped, exclusive bound.
    expect(branch).toContain('startOfUtcDay(start)');
    expect(branch).toContain('addMonths(from, 1)');
  });
});

describe('the verdict is recorded with the paths behind it', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json')) as {
    counts: Record<string, number>;
    triage: { fn: string; verdict: string; reason?: string; pathsRead?: string }[];
  };

  it('is filed gated-branch with the paths that were read', () => {
    const entry = triage.triage.find((e) => e.fn === 'managed-services');
    expect(entry?.verdict).toBe('gated-branch');
    expect((entry?.pathsRead ?? '').length).toBeGreaterThan(80);
  });

  it('the counts block still matches the entries it summarises', () => {
    const actual: Record<string, number> = {};
    for (const e of triage.triage) actual[e.verdict] = (actual[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(actual);
    expect(triage.counts.unexamined).toBeGreaterThan(0);
    expect(triage.counts.unexamined).toBeLessThan(22);
  });
});
