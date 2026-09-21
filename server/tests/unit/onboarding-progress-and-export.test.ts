/**
 * The first two screens a new tenant sees, and an export that named formats it
 * could not produce (round 133).
 *
 * `/api/onboarding` is not proxied, so `getting-started` and `wizard-state` -
 * Express-only - 404'd for every deployed user, and the wizard's store was a
 * module-scope `Map`, so its progress did not survive a restart in dev either.
 * Both are one row in `onboarding_progress` now, and both paths are proxied so
 * dev runs what production runs.
 *
 * The export declared `application/pdf` on HTML and an xlsx content type on
 * `JSON.stringify`, and its CSV named two columns `onboarding_equipment` does
 * not have.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ONBOARDING_EXPORT_HEADERS, buildChecklistExportRows } from '@shared/onboarding-export';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/(?<![:/])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const EDGE = read('supabase/functions/onboarding/index.ts');
const EDGE_CODE = stripComments(EDGE);
const MIGRATION = read('drizzle/migrations/0000_fuzzy_blizzard.sql');

/** Columns a table really has, from the chain rather than the declaration. */
function columnsOf(table: string): Set<string> {
  const at = MIGRATION.indexOf(`CREATE TABLE "${table}" (`);
  expect({ table, found: at > -1 }).toEqual({ table, found: true });
  const body = MIGRATION.slice(at, MIGRATION.indexOf('\n);', at));
  return new Set([...body.matchAll(/^\t"([a-z0-9_]+)"/gm)].map((m) => m[1]));
}

describe('the export names columns that exist', () => {
  it('equipmentType and location are on no onboarding table', () => {
    // The old CSV and PDF both had a "Type" and a "Location" column, so both
    // were blank on every row. tsc could not see it: the generators took `any`.
    const equipment = columnsOf('onboarding_equipment');
    expect(equipment.size).toBeGreaterThan(10);
    for (const phantom of ['equipment_type', 'location']) {
      expect({ phantom, exists: equipment.has(phantom) }).toEqual({ phantom, exists: false });
    }
    for (const real of ['manufacturer', 'model', 'serial_number', 'building_location']) {
      expect({ real, exists: equipment.has(real) }).toEqual({ real, exists: true });
    }
  });

  it('every emitted equipment value comes from a real column', () => {
    const equipment = columnsOf('onboarding_equipment');
    const src = read('shared/onboarding-export.ts');
    // Derived: each snake_case identifier the row builder reads off an item.
    const builder = src.slice(src.indexOf('return equipment.map'));
    // Anchored on BOTH sides: `item.serialNumber` otherwise yields "serial",
    // and the test then reports a correct file as naming a phantom column.
    const named = [...builder.matchAll(/item\.([a-z][a-z0-9_]*)(?![A-Za-z0-9_])/g)].map(
      (m) => m[1],
    );
    expect(named.length).toBeGreaterThan(5);
    for (const name of named) {
      expect({ name, real: equipment.has(name) }).toEqual({ name, real: true });
    }
  });

  it('the checklist half reads real columns too', () => {
    const checklist = columnsOf('equipment_onboarding_checklists');
    for (const real of [
      'checklist_title',
      'status',
      'customer_data',
      'installation_type',
      'scheduled_install_date',
    ]) {
      expect({ real, exists: checklist.has(real) }).toEqual({ real, exists: true });
    }
  });
});

describe('the rows it builds', () => {
  const checklist = {
    checklist_title: 'Acme HQ install',
    status: 'scheduled',
    customer_data: { companyName: 'Acme', primaryContact: 'Dana' },
    installation_type: 'new_installation',
    scheduled_install_date: '2026-10-01',
  };

  it('one row per equipment item, each as wide as the header', () => {
    const rows = buildChecklistExportRows(checklist, [
      { manufacturer: 'Xerox', model: 'C8030', serial_number: 'SN1' },
      { manufacturer: 'HP', model: 'M480', serial_number: 'SN2' },
    ]);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toHaveLength(ONBOARDING_EXPORT_HEADERS.length);
    expect(rows[0][0]).toBe('Acme HQ install');
    expect(rows[0][2]).toBe('Acme');
    expect(rows[1][7]).toBe('M480');
  });

  it('a checklist with NO equipment still exports its own details', () => {
    // A checklist raised and not yet filled in is a real state; an empty file
    // reads as a failed export.
    const rows = buildChecklistExportRows(checklist, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(ONBOARDING_EXPORT_HEADERS.length);
    expect(rows[0][0]).toBe('Acme HQ install');
    expect(rows[0][6]).toBe('');
  });

  it('a null is an empty cell, never "null" and never "N/A"', () => {
    // A placeholder is a value somebody will filter on.
    const rows = buildChecklistExportRows(
      { checklist_title: 'X', status: null, customer_data: null },
      [{ manufacturer: 'Xerox', model: null, serial_number: undefined }],
    );
    expect(rows[0][1]).toBe('');
    expect(rows[0][2]).toBe('');
    expect(rows[0][7]).toBe('');
    expect(rows[0].join('')).not.toContain('null');
    expect(rows[0].join('')).not.toContain('N/A');
  });

  it('a boolean reads as Yes/No rather than true/false', () => {
    const rows = buildChecklistExportRows(checklist, [
      { manufacturer: 'X', is_replacement: true, is_installed: false },
    ]);
    expect(rows[0][14]).toBe('Yes');
    expect(rows[0][15]).toBe('No');
  });

  it('a missing boolean is No, not blank - the column is a fact about the row', () => {
    const rows = buildChecklistExportRows(checklist, [{ manufacturer: 'X' }]);
    expect(rows[0][14]).toBe('No');
    expect(rows[0][15]).toBe('No');
  });

  it('both spellings of a jsonb field resolve', () => {
    const snake = buildChecklistExportRows(
      { checklist_title: 'X', customer_data: { company_name: 'Acme' } },
      [],
    );
    expect(snake[0][2]).toBe('Acme');
  });
});

describe('the CSV goes through the one escaper', () => {
  it('the edge function uses toCsv rather than a hand-rolled join', () => {
    // The old generator wrapped every field in quotes without doubling an
    // embedded one, so a company name containing a quote broke the row.
    expect(EDGE_CODE).toContain("from '../_shared/csv.ts'");
    expect(EDGE_CODE).toContain('toCsv([');
    expect(EDGE_CODE).not.toMatch(/\.map\(\(field\) => `"\$\{field\}"`\)/);
  });

  it('and answers text/csv with a csv filename', () => {
    const at = EDGE_CODE.indexOf("subResource === 'export'");
    const branch = EDGE_CODE.slice(at, EDGE_CODE.indexOf('Invalid onboarding endpoint', at));
    expect(branch).toContain("'Content-Type': 'text/csv; charset=utf-8'");
    expect(branch).toMatch(/filename="checklist-\$\{checklistId\}\.csv"/);
  });
});

describe('the two Express-only progress endpoints moved', () => {
  it('the edge function serves both flows over onboarding_progress', () => {
    expect(EDGE_CODE).toContain("'getting_started'");
    expect(EDGE_CODE).toContain("'setup_wizard'");
    expect(EDGE_CODE).toContain("from('onboarding_progress')");
  });

  it('it does NOT upsert - there is no unique constraint to conflict on', () => {
    // PostgREST resolves on_conflict against a unique index; (tenant_id,
    // user_id, flow_type) has none in migration 0000, so an upsert would be a
    // 42P10 on every database.
    const table = MIGRATION.indexOf('CREATE TABLE "onboarding_progress" (');
    const body = MIGRATION.slice(table, MIGRATION.indexOf('\n);', table));
    expect(body).not.toContain('UNIQUE');
    expect(EDGE_CODE).not.toMatch(/onConflict:\s*'tenant_id,user_id,flow_type'/);
  });

  it('the read tie-breaks, so a duplicate row cannot answer arbitrarily', () => {
    const at = EDGE_CODE.indexOf("from('onboarding_progress')");
    const branch = EDGE_CODE.slice(at, at + 700);
    expect(branch).toContain("order('updated_at', { ascending: false })");
    expect(branch).toContain('limit(1)');
  });

  it('both reads and writes are scoped to the caller, not just the tenant', () => {
    const occurrences = [...EDGE_CODE.matchAll(/from\('onboarding_progress'\)/g)];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
    for (const m of occurrences) {
      const chain = EDGE_CODE.slice(m.index, EDGE_CODE.indexOf(';', m.index));
      // The insert carries the pair in its payload instead of a filter.
      const scoped = /eq\('user_id', user\.id\)/.test(chain) || /user_id: user\.id/.test(chain);
      expect({ chain: chain.slice(0, 60), scoped }).toEqual({
        chain: chain.slice(0, 60),
        scoped: true,
      });
    }
  });

  it('a step ticked twice does not read as two steps done', () => {
    expect(EDGE_CODE).toContain('new Set(rawSteps.map');
  });

  it('the Express handlers are gone, including the in-memory Map', () => {
    const src = read('server/routes-onboarding.ts');
    const code = stripComments(src);
    expect(code).not.toContain('wizardStateStore');
    expect(code).not.toMatch(/app\.get\('\/api\/onboarding\/wizard-state'/);
    expect(code).not.toMatch(/app\.get\('\/api\/onboarding\/getting-started'/);
    // The reason survives where the next reader is.
    expect(src).toContain('new Map()');
  });

  it('and both paths are proxied, so dev runs what production runs', () => {
    const proxy = read('server/middleware/edge-function-proxy.ts');
    expect(proxy).toContain(
      "'/api/onboarding/getting-started': { fn: 'onboarding', pathPrefix: '/getting-started' }",
    );
    expect(proxy).toContain(
      "'/api/onboarding/wizard-state': { fn: 'onboarding', pathPrefix: '/wizard-state' }",
    );
    // NOT the whole prefix: Express still owns sections/:id and tasks/:id.
    expect(proxy).not.toMatch(/^\s*'\/api\/onboarding':/m);
    const express = stripComments(read('server/routes-onboarding.ts'));
    expect(express).toContain("'/api/onboarding/sections/:id'");
  });
});

describe('the export the page offers is the export the tree can produce', () => {
  const page = () => stripComments(read('client/src/pages/EnhancedOnboardingForm.tsx'));

  it('Excel is not offered - there is no xlsx writer', () => {
    // It used to send JSON.stringify under a spreadsheet content type.
    expect(page()).not.toContain("handleExport('excel')");
    expect(page()).not.toContain('Export as Excel');
  });

  it('the CSV download is authenticated, not an <a href> navigation', () => {
    // A plain navigation carries no Bearer token, and in production a relative
    // href resolves against the static origin.
    const src = page();
    expect(src).toContain('fetchAuthedBlob(');
    expect(src).toContain('triggerBlobDownload(');
    expect(src).not.toMatch(/link\.href = exportUrl/);
  });

  it('the PDF uses the function branch that renders a real one', () => {
    expect(page()).toContain('/generate-pdf');
  });

  it('a failed export says so rather than claiming it started', () => {
    // The old handler toasted "Your PDF export is downloading..." before any
    // request had been made.
    const src = page();
    expect(src).not.toContain('Export Started');
    expect(src).toContain("title: 'Export failed'");
  });

  it('server/routes-export.ts is gone', () => {
    expect(existsSync(join(repo, 'server/routes-export.ts'))).toBe(false);
    const registry = stripComments(read('server/routes-registry.ts'));
    expect(registry).not.toContain('exportChecklistPDF');
    expect(registry).not.toMatch(/\/api\/onboarding\/export/);
  });
});
