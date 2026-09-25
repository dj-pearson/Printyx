import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  severityCounts,
  NOT_MEASURED,
  SECURITY_EVENT_COLUMNS,
} from '@/pages/admin/RootAdminSecurity';

const root = resolve(__dirname, '../../..');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const PAGE = strip(
  readFileSync(resolve(root, 'client/src/pages/admin/RootAdminSecurity.tsx'), 'utf8'),
);
const FN = readFileSync(resolve(root, 'supabase/functions/root-admin/index.ts'), 'utf8');

describe('Root admin security page (round 218)', () => {
  it('counts severities and keeps an unknown one rather than dropping it', () => {
    const e = (severity: string | null) => ({
      id: 'x',
      type: 't',
      severity,
      tenant: 'a',
      message: 'm',
      timestamp: '2026-01-01',
    });
    expect(severityCounts([e('critical'), e('HIGH'), e('high'), e(null)])).toEqual({
      critical: 1,
      high: 2,
      unspecified: 1,
    });
    expect(severityCounts([])).toEqual({});
  });

  it('reads the three root-admin endpoints and none of the admin ones that 404', () => {
    for (const k of [
      '/api/root-admin/overview',
      '/api/root-admin/security-alerts',
      '/api/root-admin/audit-logs',
    ]) {
      expect(PAGE).toContain(`'${k}'`);
    }
    expect(PAGE).not.toMatch(/\/api\/admin\/(security|audit-logs)/);
  });

  it('each endpoint the page reads is a branch of the root-admin function', () => {
    for (const ep of ['overview', 'security-alerts', 'audit-logs']) {
      expect(FN).toMatch(new RegExp(`req\\.method === 'GET' && endpoint === '${ep}'`));
    }
  });

  it('carries none of the invented threats, scores or dead controls', () => {
    for (const s of [
      '192.168.1.100',
      'AI-powered',
      'Threat Detection',
      'Security Score',
      'Block Suspicious IP',
      'Generate Security Report',
      'Configure Threat Rules',
    ]) {
      expect(PAGE).not.toContain(s);
    }
  });

  it('names what is not measured instead of scoring it', () => {
    expect(NOT_MEASURED.length).toBeGreaterThanOrEqual(3);
    expect(NOT_MEASURED.join(' ')).toMatch(/IP block/i);
    expect(SECURITY_EVENT_COLUMNS.map((c) => c.key)).toEqual([
      'timestamp',
      'tenant',
      'type',
      'severity',
      'message',
    ]);
  });

  it('a failed security-alerts read answers 500, not an empty list', () => {
    const at = FN.indexOf("endpoint === 'security-alerts'");
    const branch = FN.slice(at, FN.indexOf("endpoint === 'users'", at));
    expect(branch).toMatch(/error: alertsError/);
    const bail = branch.indexOf('if (alertsError)');
    expect(bail).toBeGreaterThan(0);
    expect(branch.slice(bail, branch.indexOf('const rows', bail))).toMatch(/, 500, req\)/);
  });
});
