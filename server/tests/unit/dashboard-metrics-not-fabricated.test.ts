/**
 * The dashboard widget endpoints answer with measurements or with nothing.
 *
 * server/routes-dashboard-layouts.ts is registered at routes-registry:428 and serves
 * the stat cards behind RoleBasedDashboard plus every widget CustomDashboard offers.
 * It used to answer ten of them with typed-in values: revenue '$125,432' at +12.5%,
 * six months of invented revenue drawn as a trend line, an activity feed naming a
 * customer and an invoice amount, four urgent incidents (one flagged critical), four
 * tasks with one already ticked, and a five-person sales leaderboard with names,
 * dollar attainment and ranks. Every `change` was a literal, including on the two
 * metrics that DO count real rows.
 *
 * Two of the real queries were broken as well: opportunities.stage is not a column
 * (it is stage_name), and `COALESCE(SUM(value), 0)` named a column that does not
 * exist either - and being raw SQL, neither tsc nor check:phantom-cols could see it.
 *
 * The three fabrication guards this repo already has all watch client/src, so none of
 * them could see any of this. That is why the assertion is here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(process.cwd(), 'server/routes-dashboard-layouts.ts'), 'utf8');

/** Strip comments: the notes above quote every literal they describe. */
const CODE = SOURCE.split('\n')
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('no fabricated values reach the dashboard', () => {
  it('none of the invented figures survive', () => {
    for (const literal of [
      '125,432',
      '$125,000',
      'Acme Corp',
      'John Smith',
      'Jane Doe',
      'Critical server issue',
      'Enterprise Contract',
      'Follow up with prospect',
      'Submit weekly report',
    ]) {
      expect(CODE, `fabricated literal ${literal}`).not.toContain(literal);
    }
  });

  it('no month-name revenue series remains', () => {
    expect(CODE).not.toMatch(/month:\s*'(Jan|Feb|Mar|Apr|May|Jun)'/);
  });

  it('no `change` is a numeric literal', () => {
    // A percentage change needs a prior period and nothing here computes one.
    expect(CODE).not.toMatch(/change:\s*-?\d/);
  });

  it('every "Mock data" marker is gone', () => {
    expect(CODE).not.toContain('Mock data');
  });
});

describe('the real queries name real columns', () => {
  it('uses stage_name, the column that exists', () => {
    expect(CODE).toContain('opportunities.stageName');
    expect(CODE).not.toMatch(/opportunities\.stage\b(?!Name)/);
  });

  it('sums a declared column rather than a bare `value`', () => {
    expect(CODE).not.toContain('SUM(value)');
    expect(CODE).toContain('SUM(${opportunities.amount})');
  });

  it('does not import a `contacts` export that @shared/schema does not have', () => {
    expect(CODE).not.toMatch(/import \{[^}]*\bcontacts\b[^}]*\} from '@shared\/schema'/);
  });
});

describe('an absence is named rather than shown as zero', () => {
  it('each unbacked answer says what is missing', () => {
    const unbacked = CODE.match(/unbacked/g) ?? [];
    expect(unbacked.length).toBeGreaterThanOrEqual(10);
  });
});
