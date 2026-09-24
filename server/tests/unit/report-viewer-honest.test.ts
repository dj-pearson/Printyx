import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reportQueryString } from '@/components/reports/ReportViewer';

const root = resolve(__dirname, '../../..');
// Line comments FIRST: the handler has a line comment containing
// `/reports/{persona}/*`, and a block-first strip reads that `/*` as an opener
// and deletes the code after it (the trap CLAUDE.md records for round 131).
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const VIEWER = strip(
  readFileSync(resolve(root, 'client/src/components/reports/ReportViewer.tsx'), 'utf8'),
);
const HANDLER = strip(
  readFileSync(resolve(root, 'supabase/functions/reports/handlers/reporting.ts'), 'utf8'),
);

describe('report viewer (round 232)', () => {
  it('sends its filters as a query string, dropping empties', () => {
    const q = new URLSearchParams(
      reportQueryString({
        status: 'open',
        page: 2,
        sortDirection: 'desc',
        search: '',
        missing: null,
        nested: { a: 1 },
        dateRange: { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-30T00:00:00Z') },
      }),
    );
    expect(Object.fromEntries(q)).toEqual({
      status: 'open',
      page: '2',
      sortDirection: 'desc',
      from_date: '2026-09-01T00:00:00.000Z',
      to_date: '2026-09-30T00:00:00.000Z',
    });
  });

  it('no longer passes a params option apiRequest does not have', () => {
    expect(VIEWER).not.toMatch(/params:\s*\{/);
    expect(VIEWER).toMatch(/\/data\?\$\{reportQueryString\(filters\)\}/);
  });

  it('the data path answers 501 with a reason instead of an unrouted 404', () => {
    const at = HANDLER.indexOf("method === 'GET' && sub === 'reports' && sub2 && sub3 === 'data'");
    expect(at).toBeGreaterThan(0);
    const branch = HANDLER.slice(at, HANDLER.indexOf('if (method', at + 10));
    expect(branch).toMatch(/errorResponse\(\s*501,/);
    expect(HANDLER).toContain("'REPORT_EXECUTION_NOT_AVAILABLE'");
  });
});
