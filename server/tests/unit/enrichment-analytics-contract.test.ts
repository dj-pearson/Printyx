/**
 * An Analytics tab that could never render (SEC-EDGE-001, PA-040's shape).
 *
 * `DataEnrichment.tsx` reads `contacts.bySource`, `contacts.byStatus`,
 * `contacts.byLevel` and `companies.byIndustry`, and calls `.map`, `.reduce`
 * and `.find` on each - so it wants ARRAYS of `{ source|status|level|industry,
 * count }` nested under two keys.
 *
 * The endpoint sent `{ totalContacts, bySource: {src: n}, byStatus: {st: n} }`:
 * flat, as objects, and missing two of the four. Every read resolved to
 * undefined behind optional chaining, so the whole tab rendered "No data
 * available" and the three headline cards showed 0 - on a 200, with nothing
 * logged anywhere. Nothing in this repo compares the key names a page reads
 * against the ones its endpoint sends, which is why it survived.
 *
 * Both missing breakdowns turned out to be REAL columns, so all four are
 * derived rather than dropped - and `management_level`, which no importer
 * fills, is named in `unbacked` instead of quietly reading "unknown" forever.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { enrichedContacts, enrichedCompanies } from '../../../shared/schema';
import {
  EDITABLE_ENRICHED_CONTACT_COLUMNS,
  enrichedContactPatch,
} from '../../../supabase/functions/_shared/enriched-contact.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const FN = strip(read('supabase/functions/enrichment/index.ts'));
const PAGE = strip(read('client/src/pages/DataEnrichment.tsx'));

/** The analytics branch only, so a match elsewhere in the file cannot stand in. */
const ANALYTICS = FN.slice(
  FN.indexOf("resource === 'analytics'"),
  FN.indexOf("resource === 'import'"),
);

describe('the endpoint sends the keys the page reads', () => {
  it('has both corpora', () => {
    expect(ANALYTICS.length).toBeGreaterThan(500);
    expect(PAGE).toContain('analyticsData');
  });

  it('every key the page reads is sent, nested the way it reads it', () => {
    // Derived from the page rather than pinned: the point is that the two
    // agree, so the assertion asks the page what it wants.
    const reads = [...PAGE.matchAll(/analyticsData\?\.(\w+)\?\.(\w+)/g)].map(
      (m) => [m[1], m[2]] as const,
    );
    expect(reads.length).toBeGreaterThanOrEqual(4);
    const pairs = [...new Set(reads.map(([a, b]) => `${a}.${b}`))];
    expect(pairs.sort()).toEqual([
      'companies.byIndustry',
      'contacts.byLevel',
      'contacts.bySource',
      'contacts.byStatus',
    ]);
    for (const [group, key] of reads) {
      const groupAt = ANALYTICS.indexOf(`${group}: {`);
      expect({ group, sent: groupAt > -1 }).toEqual({ group, sent: true });
      expect({ key, sent: new RegExp(`${key}: tally\\(`).test(ANALYTICS) }).toEqual({
        key,
        sent: true,
      });
    }
  });

  it('each breakdown is an ARRAY of the item shape the page destructures', () => {
    // The page does item.source / item.status / item.level / item.industry
    // plus item.count, and .map/.reduce/.find - an object map satisfies none
    // of that.
    expect(ANALYTICS).toMatch(/\.map\(\(\[value, count\]\) => \(\{ \[key\]: value, count \}\)\)/);
    for (const [column, key] of [
      ['enrichment_source', 'source'],
      ['prospecting_status', 'status'],
      ['management_level', 'level'],
      ['primary_industry', 'industry'],
    ]) {
      expect({ key, tallied: ANALYTICS.includes(`'${column}', '${key}'`) }).toEqual({
        key,
        tallied: true,
      });
    }
  });

  it('every column it tallies is real', () => {
    // check:phantom-cols cannot resolve a column passed into a helper, so
    // drizzle's table config is the authority.
    const contactCols = new Set(getTableConfig(enrichedContacts).columns.map((c) => c.name));
    const companyCols = new Set(getTableConfig(enrichedCompanies).columns.map((c) => c.name));
    for (const c of ['enrichment_source', 'prospecting_status', 'management_level']) {
      expect({ c, real: contactCols.has(c) }).toEqual({ c, real: true });
    }
    expect(companyCols.has('primary_industry')).toBe(true);
    // The old spelling is what made this branch a 42703 before.
    expect(contactCols.has('source')).toBe(false);
    expect(contactCols.has('status')).toBe(false);
  });

  it('the tallies are paged, so a total is not the first page', () => {
    // COP-I01 on an aggregate: nothing on screen could show the count had been
    // capped at PostgREST's default page size.
    const pagedReads = [...ANALYTICS.matchAll(/fetchAllRows<Record<string, any>>\(/g)];
    expect(pagedReads).toHaveLength(2);
    expect(ANALYTICS).not.toMatch(/\.limit\(/);
  });

  it('names the column no importer fills instead of charting "unknown"', () => {
    // Anchored on the KEY as emitted. `toContain('unbacked')` is a substring
    // match: renaming the key to `unbackedX` still contains it, and the mutant
    // that did exactly that survived. Same overlap trap as `subject:` inside
    // `activity_subject:`.
    expect(ANALYTICS).toMatch(/\bunbacked: \[/);
    expect(ANALYTICS).toMatch(/management_level is a real column that the importers never fill/);
    // And that claim is checked, not asserted: the importer really does omit it.
    const MAPPER = strip(read('supabase/functions/_shared/enriched-contact.ts'));
    const row = MAPPER.slice(MAPPER.indexOf('export function toEnrichedContactRow('));
    expect(row).not.toMatch(/management_level:/);
  });
});

describe('the contact update maps columns instead of spreading the body', () => {
  it('every editable column is real, and none belongs to the server', () => {
    const columns = new Set(getTableConfig(enrichedContacts).columns.map((c) => c.name));
    for (const c of EDITABLE_ENRICHED_CONTACT_COLUMNS) {
      expect({ c, real: columns.has(c) }).toEqual({ c, real: true });
    }
    // COP-M01: a body naming tenant_id moves the row to another tenant.
    for (const forbidden of [
      'tenant_id',
      'id',
      'created_at',
      'zoominfo_contact_id',
      'apollo_contact_id',
      'enrichment_source',
    ]) {
      expect({
        forbidden,
        editable: EDITABLE_ENRICHED_CONTACT_COLUMNS.includes(forbidden as never),
      }).toEqual({ forbidden, editable: false });
    }
  });

  it('takes only what the caller sent, in either spelling', () => {
    expect(enrichedContactPatch({ jobTitle: 'VP Ops' })).toEqual({ job_title: 'VP Ops' });
    expect(enrichedContactPatch({ job_title: 'VP Ops' })).toEqual({ job_title: 'VP Ops' });
    // A partial form must not null the columns it omitted.
    expect(Object.keys(enrichedContactPatch({ email: 'a@b.c' }))).toEqual(['email']);
  });

  it('refuses the columns the caller must not set', () => {
    expect(enrichedContactPatch({ tenant_id: 'other', id: 'x', email: 'a@b.c' })).toEqual({
      email: 'a@b.c',
    });
  });

  it('an empty patch is a 400, not a 200 that bumps updated_at', () => {
    expect(enrichedContactPatch({ nonsense: 1 })).toEqual({});
    expect(FN).toContain('EMPTY_PATCH');
  });

  it('the update is still tenant-filtered', () => {
    const at = FN.indexOf('const patch = enrichedContactPatch(body);');
    expect(at).toBeGreaterThan(-1);
    expect(FN.slice(at, at + 700)).toContain("eq('tenant_id', tenantId)");
  });
});

describe('the verdict is recorded with the paths behind it', () => {
  const triage = JSON.parse(read('docs/edge-rbac-triage.json')) as {
    counts: Record<string, number>;
    triage: { fn: string; verdict: string; reason?: string; pathsRead?: string }[];
  };

  it('is filed open-by-design with the reasoning', () => {
    const entry = triage.triage.find((e) => e.fn === 'enrichment');
    expect(entry?.verdict).toBe('open-by-design');
    expect((entry?.pathsRead ?? '').length).toBeGreaterThan(80);
  });

  it('the counts block still matches the entries it summarises', () => {
    const actual: Record<string, number> = {};
    for (const e of triage.triage) actual[e.verdict] = (actual[e.verdict] ?? 0) + 1;
    expect(triage.counts).toEqual(actual);
    // Round 91 emptied the unexamined worklist by settling the last entry
    // (handoff-task-templates). The floor here used to be `> 0`, guarding
    // against clearing the list by GUESSING verdicts rather than reading the
    // handlers. That property does not depend on the list being non-empty, so
    // it is asserted once over every entry in
    // server/tests/unit/edge-rbac-triage-integrity.test.ts.
    expect(triage.counts.unexamined ?? 0).toBe(0);
  });
});
