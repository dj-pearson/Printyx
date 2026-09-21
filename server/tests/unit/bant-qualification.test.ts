/**
 * WF-S-09: BANT ships, and the two defects that would have shipped with it.
 *
 * The story's decision was build-or-delete. Build, because the back end is
 * real: five endpoints over `bant_qualification_criteria` and
 * `lead_qualification_history`, both created by migration 0000 with no later
 * DROP, both keyed on `business_records.id` - the SAME table LeadDetail's
 * `/api/leads/:id` reads, so WF-S-01's companies/business_records split does
 * not reach the record page. `/api/lead-scoring` was already in crmProxies with
 * a comment naming BANTAssessment as its caller.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scoreBant, statusForScore, statusLabel, statusTone } from '@shared/bant-score';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('scoreBant', () => {
  it('scores nothing when nothing was established', () => {
    const s = scoreBant({});
    expect(s).toMatchObject({
      budgetScore: 0,
      authorityScore: 0,
      needScore: 0,
      timelineScore: 0,
      total: 0,
      status: 'unqualified',
    });
  });

  it('an identified budget scores even before it is approved, and more once it is', () => {
    expect(scoreBant({ budgetIdentified: true }).budgetScore).toBe(15);
    expect(scoreBant({ budgetIdentified: true, budgetApproved: true }).budgetScore).toBe(25);
    // Approved without identified is not a state the form can reach, and it
    // must not score: the pillar was never established.
    expect(scoreBant({ budgetApproved: true }).budgetScore).toBe(0);
  });

  it('authority is all or nothing', () => {
    expect(scoreBant({ decisionMakerIdentified: true }).authorityScore).toBe(25);
    expect(scoreBant({ decisionMakerIdentified: false }).authorityScore).toBe(0);
  });

  it('need and timeline band on their free-text detail', () => {
    expect(scoreBant({ needIdentified: true, needUrgency: 'critical' }).needScore).toBe(25);
    expect(scoreBant({ needIdentified: true, needUrgency: 'high' }).needScore).toBe(20);
    expect(scoreBant({ needIdentified: true, needUrgency: 'someday' }).needScore).toBe(15);
    expect(scoreBant({ needIdentified: true }).needScore).toBe(15);
    expect(
      scoreBant({ timelineIdentified: true, decisionTimeline: 'immediate' }).timelineScore,
    ).toBe(25);
    expect(scoreBant({ timelineIdentified: true, decisionTimeline: '30_days' }).timelineScore).toBe(
      20,
    );
    expect(scoreBant({ timelineIdentified: true, decisionTimeline: 'q3' }).timelineScore).toBe(15);
  });

  it('a pillar that was not identified scores zero however much detail it carries', () => {
    expect(scoreBant({ needUrgency: 'critical' }).needScore).toBe(0);
    expect(scoreBant({ decisionTimeline: 'immediate' }).timelineScore).toBe(0);
  });

  it('matches on case and whitespace, because these are free-text columns', () => {
    expect(scoreBant({ needIdentified: true, needUrgency: '  CRITICAL ' }).needScore).toBe(25);
    expect(
      scoreBant({ timelineIdentified: true, decisionTimeline: 'Immediate' }).timelineScore,
    ).toBe(25);
    // A non-string (a null column read straight off the row) is not a match.
    expect(scoreBant({ needIdentified: true, needUrgency: null }).needScore).toBe(15);
  });

  it('a full assessment totals 100 and grades highly qualified', () => {
    const s = scoreBant({
      budgetIdentified: true,
      budgetApproved: true,
      decisionMakerIdentified: true,
      needIdentified: true,
      needUrgency: 'critical',
      timelineIdentified: true,
      decisionTimeline: 'immediate',
    });
    expect(s.total).toBe(100);
    expect(s.status).toBe('highly_qualified');
  });

  it('grades on the documented boundaries, not near them', () => {
    expect(statusForScore(0)).toBe('unqualified');
    expect(statusForScore(24)).toBe('unqualified');
    expect(statusForScore(25)).toBe('partially_qualified');
    expect(statusForScore(49)).toBe('partially_qualified');
    expect(statusForScore(50)).toBe('qualified');
    expect(statusForScore(74)).toBe('qualified');
    expect(statusForScore(75)).toBe('highly_qualified');
    expect(statusForScore(100)).toBe('highly_qualified');
  });
});

describe('statusLabel', () => {
  it('labels the stored vocabulary', () => {
    expect(statusLabel('highly_qualified')).toBe('Highly Qualified');
    expect(statusLabel('partially_qualified')).toBe('Partially Qualified');
    expect(statusLabel('qualified')).toBe('Qualified');
    expect(statusLabel('unqualified')).toBe('Unqualified');
  });

  it('a missing status is "Not assessed", not an empty badge', () => {
    expect(statusLabel(null)).toBe('Not assessed');
    expect(statusLabel(undefined)).toBe('Not assessed');
    expect(statusLabel('')).toBe('Not assessed');
  });

  it('an unrecognised status is shown as itself rather than dropped', () => {
    // A vocabulary that grows on the server should be visible, not silent -
    // the same rule the activity timeline applies to an unknown activity type.
    expect(statusLabel('re_qualified')).toBe('re qualified');
    expect(statusTone('re_qualified')).toBe('bg-muted text-muted-foreground');
  });
});

describe('one module, both hosts', () => {
  const EDGE = stripComments(read('supabase/functions/lead-scoring/handlers/bant.ts'));
  const FORM = stripComments(read('client/src/components/leads/BANTAssessment.tsx'));

  it('the edge handler derives its stored scores from shared/bant-score', () => {
    // Bound to the property, not the depth: this pinned `../../../shared/`,
    // which is what a handler ONE directory higher needs. From
    // `<fn>/handlers/` it resolves to `supabase/shared/` - nothing - and
    // server.ts omits a function whose import throws, so the whole of
    // /api/lead-scoring answered 404 in production. check:edge-boot caught it.
    const spec = /from '((?:\.\.\/)+shared\/bant-score\.ts)'/.exec(EDGE);
    expect(spec).not.toBeNull();
    expect(
      existsSync(join(process.cwd(), 'supabase/functions/lead-scoring/handlers', spec![1])),
    ).toBe(true);
    // Bound to the call, not to the import: an import that nothing calls is the
    // shape COP-B04 found in the opportunity radar.
    expect(EDGE).toMatch(/\}\s*=\s*scoreBant\(\{/);
  });

  it('the form previews with the same function rather than a copy', () => {
    expect(FORM).toMatch(/from '@shared\/bant-score'/);
    expect(FORM).toMatch(/scoreBant\(formData\)/);
    // And the arithmetic is GONE from the component - a second copy that
    // happens to agree today is the drift this module exists to prevent.
    expect(FORM).not.toMatch(/calculateEstimatedScore/);
    expect(FORM).not.toMatch(/total >= 75/);
  });

  it('neither side re-derives a label from a score', () => {
    // A row written before a threshold moved keeps the status it was saved
    // with; relabelling it from the number would rewrite history.
    expect(FORM).toMatch(/statusLabel\(estimatedScores\.status\)/);
  });
});

describe('the reads the form actually calls are camelised', () => {
  const EDGE = stripComments(read('supabase/functions/lead-scoring/handlers/bant.ts'));

  it('GET /bant/:leadId maps the row before answering', () => {
    const at = EDGE.indexOf("method === 'GET' && first === 'bant' && second");
    expect(at).toBeGreaterThan(-1);
    const branch = EDGE.slice(at, EDGE.indexOf('return null;', at));
    expect(branch).toMatch(/jsonResponse\(toCamelShallow\(data\)/);
  });

  it('the POST answers the saved row camelised too', () => {
    // This is what the success toast reads. It used to be a raw snake row, so
    // `data.qualificationStatus.replace(...)` threw AFTER the write landed.
    expect(EDGE).toMatch(/jsonResponse\(saved \? toCamelShallow\(saved\) : saved/);
  });

  it('shallow, not deep - pain_points and blockers are jsonb', () => {
    expect(EDGE).toMatch(/toCamelShallow/);
    expect(EDGE).not.toMatch(/[^A-Za-z]toCamel\(/);
  });

  it('the write path still maps camel to snake, which always worked', () => {
    // The story is a mapper-less READ next to a correct write; the fix must not
    // disturb the half that was right.
    expect(EDGE).toMatch(/r\.budget_amount = src\('budgetAmount', 'budget_amount'\)/);
    expect(EDGE).toMatch(/r\.pain_points = src\('painPoints', 'pain_points'\)/);
  });
});

describe('BANT is reachable from the lead record', () => {
  const LAYOUT = read('shared/record-layout.ts');
  const PAGE = read('client/src/pages/LeadDetail.tsx');

  it('the layout declares a qualification section', () => {
    expect(LAYOUT).toMatch(/sectionId: 'lead-qualification'/);
  });

  it('and LeadDetail supplies a slot for it', () => {
    // A section the layout names with no slot renders as nothing at all and is
    // reported in `unrenderable` - the catalogue-versus-slots check COP-B01
    // AC6 records for My Day's card ids, applied to a layout section.
    expect(PAGE).toMatch(/'lead-qualification': <BANTAssessment leadId=/);
  });

  it('every section the leads layout names has a slot on the page', () => {
    const block = LAYOUT.slice(LAYOUT.indexOf('leads: ['), LAYOUT.indexOf('contacts: []'));
    const declared = [...block.matchAll(/sectionId: '([^']+)'/g)].map((m) => m[1]);
    // timeline() builds its sectionId from an argument, so collect that too.
    for (const m of block.matchAll(/timeline\('([^']+)'\)/g)) declared.push(m[1]);
    expect(declared.length).toBeGreaterThan(3);
    const slotted = [...PAGE.matchAll(/'(lead-[a-z-]+)':/g)].map((m) => m[1]);
    // Property sections render from propertyFields and need no slot; only the
    // ones with an EMPTY propertyFields list depend on one.
    const needsSlot = declared.filter((id) => {
      const at = block.indexOf(`sectionId: '${id}'`);
      if (at < 0) return true; // built by timeline(), which is slot-driven
      const body = block.slice(at, block.indexOf('},', at));
      return /propertyFields: \[\]/.test(body);
    });
    for (const id of needsSlot) {
      expect({ id, slotted: slotted.includes(id) }).toEqual({ id, slotted: true });
    }
  });

  it('the glance card says "Could not load" rather than "Not assessed" on failure', () => {
    // CR-033 pointed at a qualification state: "not assessed" is a fact a rep
    // acts on, and a failed read must not be able to assert it.
    // Stripped: the comment above that branch quotes "Not assessed" in prose
    // explaining what must NOT render, so an ordering check against the raw
    // source reports its own explanation as the defect. Eighth time.
    const src = stripComments(PAGE);
    const at = src.indexOf('BANT</span>');
    expect(at).toBeGreaterThan(-1);
    const row = src.slice(at, at + 700);
    expect(row).toMatch(/bantFailed \?/);
    expect(row.indexOf('Could not load')).toBeLessThan(row.indexOf('Not assessed'));
  });

  it('the glance card and the form read one cache entry', () => {
    expect(PAGE).toMatch(/useBantAssessment\(id\)/);
    const FORM = read('client/src/components/leads/BANTAssessment.tsx');
    expect(FORM).toMatch(/export function useBantAssessment\(/);
  });
});

describe('the form no longer loses what it loaded', () => {
  const FORM = stripComments(read('client/src/components/leads/BANTAssessment.tsx'));

  it('hydrates once per lead, behind a ref', () => {
    // A plain useEffect([bantData]) re-runs on every refetch and discards what
    // the rep has typed since (QUALITY-002's WhiteLabelDashboard finding).
    expect(FORM).toMatch(/hydratedFor\.current === leadId/);
    expect(FORM).toMatch(/hydratedFor\.current = leadId;/);
  });

  it('a save re-arms it, because the server owns the scores', () => {
    const at = FORM.indexOf('onSuccess: (data) => {');
    expect(at).toBeGreaterThan(-1);
    const body = FORM.slice(at, FORM.indexOf('onError:', at));
    expect(body).toMatch(/hydratedFor\.current = null;/);
    expect(body).toMatch(/statusLabel\(data\?\.qualificationStatus\)/);
    // The crash: .replace on a key the endpoint did not send.
    expect(body).not.toMatch(/qualificationStatus\.replace/);
  });

  it('a failed read renders an error, never a blank form that reads as unqualified', () => {
    expect(FORM).toMatch(/isError \?/);
    expect(FORM).toMatch(/InlineQueryError/);
  });

  it('it no longer invalidates a key nothing queries', () => {
    // ['lead-intelligence', leadId] had no query behind it anywhere.
    expect(FORM).not.toMatch(/'lead-intelligence'/);
  });
});

describe('what stays unbacked, said out loud', () => {
  it('the lead LIST cannot carry a BANT column yet, and the registry does not pretend it can', () => {
    // AC2 asks for score and grade as sortable columns on the lead list. The
    // list reads /api/business-records, whose own header calls it "a
    // backwards-compatible wrapper that delegates to the companies table", and
    // BANT keys on business_records.id - so the column could never hold a
    // value. COP-M01's rule: remove an unbacked column rather than ship one
    // that reads as "no data yet".
    const REGISTRY = read('client/src/lib/crm-object-registry.ts');
    expect(REGISTRY).toMatch(/apiEndpoint: '\/api\/business-records'/);
    expect(REGISTRY).not.toMatch(/totalBantScore|qualificationStatus/);
    const BR = read('supabase/functions/business-records/index.ts');
    expect(BR).toMatch(/delegates to the companies table/);
  });
});
