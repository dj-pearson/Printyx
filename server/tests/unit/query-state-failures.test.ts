/**
 * A failed request must not render as an empty one (CR-033), and one of these
 * fourteen let a customer sign for a delivery.
 *
 * `check:query-states` was RED ON MAIN with fourteen files, eight of them added
 * by earlier rounds of this same loop - my own debt, accumulated while the gate
 * sat red and nobody ran it. The guard's point is that a component rendering
 * identically on success and on failure tells the reader something false: "no
 * competitor recorded on this deal", "no playbooks yet", "no territories
 * defined" - each a claim about the business when the truth was a 500.
 *
 * THE ONE THAT MATTERED MOST is DeliveryAcceptance. Its checklist query
 * defaulted to `[]`, so a failed fetch produced an empty checklist, `blockers`
 * came back empty, and `canSubmit` went TRUE: the Accept button enabled itself
 * and a customer could sign for an installation whose checklist had never
 * loaded. The record that page writes is the evidence a machine was installed
 * and inspected. CR-033 is usually a failure reading as "no data yet"; here it
 * read as "nothing left to check".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('a signature cannot be collected against a checklist that never loaded', () => {
  const PAGE = strip(read('client/src/pages/DeliveryAcceptance.tsx'));

  it('has a corpus to check', () => {
    expect(PAGE).toContain('canSubmit');
    expect(PAGE).toContain('checklistBlockers');
  });

  it('the failed and loading states both block submission', () => {
    // Bound to the canSubmit expression, not the file: `checklistFailed`
    // appears in the error banner too, so a file-wide check stays green when
    // the gate itself drops it.
    const at = PAGE.indexOf('const canSubmit =');
    expect(at).toBeGreaterThan(-1);
    const expr = PAGE.slice(at, PAGE.indexOf(';', at));
    expect(expr).toContain('!checklistFailed');
    expect(expr).toContain('!checklistLoading');
    // And the original conditions survive - this must not have become weaker.
    expect(expr).toContain('blockers.length === 0');
    expect(expr).toContain('Boolean(signature)');
  });

  it('the failure is shown, not only blocked', () => {
    // A disabled button with no explanation is its own defect.
    expect(PAGE).toMatch(/checklistFailed && \(/);
    expect(PAGE).toContain('InlineQueryError');
  });

  it('an unanswered item is still not a pass', () => {
    // The three-state rule this page already had, checked so the fix above did
    // not disturb it.
    expect(PAGE).toMatch(/results\[item\.id\] \?\? item\.passed \?\? null/);
  });
});

describe('the panels that reported a failure as an empty business', () => {
  const CASES: [string, string][] = [
    ['client/src/components/crm/CompetitiveCard.tsx', 'competitive intelligence'],
    ['client/src/components/crm/PlaybookPanel.tsx', 'playbooks'],
    ['client/src/components/crm/DealInsightsPanel.tsx', 'the deal summary'],
    ['client/src/components/forecast/ForecastCategoryPanel.tsx', 'the forecast'],
    ['client/src/components/field/AcceptanceRecords.tsx', 'acceptance records'],
    ['client/src/components/purchasing/PlaceManufacturerOrderDialog.tsx', 'manufacturers'],
    ['client/src/pages/OpportunityRadar.tsx', 'the radar'],
    ['client/src/pages/SalesTerritories.tsx', 'territories'],
    ['client/src/pages/CompetitiveIntelligence.tsx', 'win/loss'],
    ['client/src/pages/SalesPlaybooks.tsx', 'playbooks'],
  ];

  it('each says the data could not be LOADED, in its own words', () => {
    // Walked per file, not counted: a total stays green while one reverts.
    for (const [file, label] of CASES) {
      const src = strip(read(file));
      expect({ file, handles: /\bisError\b/.test(src) }).toEqual({ file, handles: true });
      expect({ file, says: src.includes(`label="${label}"`) }).toEqual({ file, says: true });
    }
  });

  it('every one offers a retry, because the usual cause is transient', () => {
    for (const [file] of CASES) {
      const src = strip(read(file));
      expect({ file, retries: /onRetry=\{/.test(src) }).toEqual({ file, retries: true });
    }
  });

  it('the shared component says could not load, never "none"', () => {
    const SRC = read('client/src/components/ui/inline-query-error.tsx');
    expect(SRC).toContain('Could not load {label}');
    // It is destructive-coloured: this is a failure, not an empty state.
    expect(SRC).toContain('text-destructive');
  });
});

describe('the two deliberate fallbacks say they are fallbacks', () => {
  it('RecordPageLayout keeps the shipped layout AND admits to it', () => {
    // A failed config request falling back to the default is right; doing it
    // silently means an admin sees the stock page and assumes that is theirs.
    const SRC = strip(read('client/src/components/crm/RecordPageLayout.tsx'));
    expect(SRC).toMatch(/const usingDefaultLayout = layoutQuery\.isError;/);
    expect(SRC).toMatch(/usingDefaultLayout && \(/);
  });

  it('My Day surfaces it from the hook and the page renders it', () => {
    const HOOK = strip(read('client/src/components/crm/MyDayLayout.tsx'));
    expect(HOOK).toMatch(/usingDefaultLayout: query\.isError/);
    // A field nothing reads is the defect this session keeps finding in others'
    // code, so the consumer is checked too.
    const PAGE = strip(read('client/src/pages/TodayDashboard.tsx'));
    expect(PAGE).toContain('usingDefaultLayout');
    expect(PAGE).toMatch(/usingDefaultLayout && \(/);
  });
});

describe('the guard stopped reporting a file that handles its error well', () => {
  const GUARD = read('scripts/check-query-states.mjs');

  it('a READ error binding counts as handling', () => {
    // SystemMonitoring renders `{error && <p>Could not load system health.
    // {error.message}</p>}`, which is this guard's whole purpose done better
    // than an isError boolean - and it was reported as unhandled. A false
    // positive in a gate teaches people to baseline rather than to fix.
    expect(GUARD).toContain('usesErrorElsewhere');
    const SYSMON = strip(read('client/src/pages/SystemMonitoring.tsx'));
    expect(SYSMON).toMatch(/\{error && \(/);
  });

  it('destructuring error and ignoring it does NOT count', () => {
    // The half that keeps the widening honest.
    expect(GUARD).toMatch(/bindsError &&/);
    expect(GUARD).toMatch(/\.length >[\s\S]{0,80}\.length/);
  });

  it('the baseline shrank rather than absorbing the fourteen', () => {
    const baseline = JSON.parse(read('docs/query-states-baseline.json'));
    expect(baseline.count).toBe(baseline.allowed.length);
    expect(baseline.count).toBeLessThan(202);
    // None of the fourteen was quietly added to it.
    for (const file of [
      'client/src/pages/DeliveryAcceptance.tsx',
      'client/src/components/crm/CompetitiveCard.tsx',
      'client/src/pages/OpportunityRadar.tsx',
    ]) {
      expect({ file, baselined: baseline.allowed.includes(file) }).toEqual({
        file,
        baselined: false,
      });
    }
  });
});
