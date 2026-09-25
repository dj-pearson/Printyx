import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  countCheck,
  deriveReadinessMetrics,
  UNMEASURED_READINESS,
  type ReadinessCheck,
} from '../../../shared/deployment-readiness';

/**
 * Round 186. The deployment readiness board claimed things nothing measured:
 * the page fell back to eighteen typed-in checks and a 78% score, the edge
 * function marked TLS, RBAC and backups "complete" with a fresh "last checked"
 * stamp for every tenant, read a table (`integrations`) that exists in no
 * schema, turned failed reads into zeros, and invented a launch date.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const FN = strip(read('supabase/functions/deployment-readiness/index.ts'));
const PAGE = strip(read('client/src/pages/DeploymentReadiness.tsx'));

const base = {
  id: 'x',
  category: 'Setup',
  name: 'X',
  description: 'x',
  priority: 'high' as const,
  noun: 'user',
  emptyStatus: 'warning' as const,
  now: '2026-09-23T00:00:00.000Z',
};

describe('countCheck', () => {
  it('reports a failed read as not checked, never as zero', () => {
    const c = countCheck({ ...base, count: null, error: 'boom' });
    expect(c.status).toBe('warning');
    expect(c.details).toBe('Could not be checked: boom');
    expect(c.details).not.toMatch(/\b0\b/);
  });

  it('distinguishes zero from some', () => {
    expect(countCheck({ ...base, count: 0 }).status).toBe('warning');
    expect(countCheck({ ...base, count: 0, emptyStatus: 'in-progress' }).status).toBe(
      'in-progress',
    );
    expect(countCheck({ ...base, count: 3 }).status).toBe('complete');
    expect(countCheck({ ...base, count: 1 }).details).toBe('1 user');
    expect(countCheck({ ...base, count: 2 }).details).toBe('2 users');
  });
});

describe('deriveReadinessMetrics', () => {
  const check = (status: ReadinessCheck['status'], priority: ReadinessCheck['priority']) =>
    ({ ...base, status, priority, lastChecked: base.now }) as ReadinessCheck;

  it('counts only high-priority incomplete checks as critical', () => {
    const m = deriveReadinessMetrics([
      check('complete', 'high'),
      check('warning', 'high'),
      check('incomplete', 'low'),
      check('complete', 'medium'),
    ]);
    expect(m).toMatchObject({
      overallReadiness: 50,
      criticalIssues: 1,
      completedChecks: 2,
      totalChecks: 4,
    });
  });

  it('answers null readiness with nothing to count, not 0%', () => {
    expect(deriveReadinessMetrics([]).overallReadiness).toBeNull();
  });

  it('carries no launch date and names what is not measured', () => {
    const m = deriveReadinessMetrics([check('complete', 'high')]);
    expect(m).not.toHaveProperty('estimatedLaunchDate');
    expect(m.unbacked).toEqual([...UNMEASURED_READINESS]);
    expect(m.unbacked.join(' ')).toMatch(/Backups/);
  });
});

describe('the edge function', () => {
  it('no longer asserts checks it does not perform', () => {
    for (const id of ["id: 'ssl'", "id: 'rbac'", "id: 'backups'"]) {
      expect(FN).not.toContain(id);
    }
    expect(FN).not.toMatch(/setDate\(/);
  });

  it('reads integrations from the real table', () => {
    expect(FN).toMatch(/from\('system_integrations'\)/);
    expect(FN).not.toMatch(/from\('integrations'\)/);
  });

  it('keeps the error of every count it reads', () => {
    for (const v of ['tenantRead', 'usersRead', 'integrationsRead']) {
      expect(FN).toMatch(new RegExp(`count: ${v}\\.error \\? null`));
    }
  });

  it('builds the roll-up from the shared module', () => {
    expect(FN).toContain("from '../../../shared/deployment-readiness.ts'");
    expect(FN).toMatch(/deriveReadinessMetrics\(checks\)/);
    expect(FN).not.toMatch(/function deriveMetrics/);
  });
});

describe('the page', () => {
  it('has no mock fallback', () => {
    expect(PAGE).not.toMatch(/mockChecks|mockMetrics/);
    expect(PAGE).toMatch(/const checks = readinessQuery\.data \?\? \[\];/);
  });

  it('has no deploy or test-run control and no launch estimate', () => {
    expect(PAGE).not.toContain('Deploy to Production');
    expect(PAGE).not.toContain('Run Final Tests');
    expect(PAGE).not.toContain('Est. Launch');
    expect(PAGE).not.toContain('View Details');
  });

  it('exports the real checklist and renders the unmeasured list', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) =>\s*exportToCSV\(checks, CHECKLIST_EXPORT_COLUMNS/);
    expect(PAGE).toMatch(/metrics\?\.unbacked \?\? \[\]/);
  });

  it('shows a load failure instead of an empty checklist', () => {
    expect(PAGE).toMatch(/readinessQuery\.isError &&/);
  });
});
