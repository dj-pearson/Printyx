import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { coachingReasons, formatGrowth, oneOnOneBody } from '@/lib/rep-coaching';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const stripSql = (s: string) => s.replace(/--.*$/gm, '');
const stripTs = (s: string) =>
  s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const SQL = stripSql(read('drizzle/functions/sales-pipeline.sql'));
const PAGE = stripTs(read('client/src/pages/SalesPipelineWorkflow.tsx'));

describe('sales pipeline goals are not invented (round 226)', () => {
  it('the rep and tenant functions answer null for goals, not a typed-in target', () => {
    expect(SQL).not.toMatch(/\b50000\b|\b200000\b/);
    expect(SQL).toMatch(/'revenue_goal', NULL/);
    expect(SQL).toMatch(/'deals_goal', NULL/);
    expect(SQL).toMatch(/'goal_achievement', NULL/);
    expect(SQL).toMatch(/v_goal_achievement := NULL;/);
  });

  it('no closed deal is no sales cycle, and no previous month is no growth', () => {
    // The old defaults were 30 days and 0%.
    expect(SQL).not.toMatch(/\),\s*30\s*\)/);
    const growth = SQL.slice(
      SQL.indexOf('v_growth_rate := CASE'),
      SQL.indexOf('END;', SQL.indexOf('v_growth_rate := CASE')),
    );
    expect(growth).toMatch(/ELSE NULL/);
  });

  it('the page ranks nobody against a goal', () => {
    expect(PAGE).not.toMatch(/goal_achievement\s*[<>]=?/);
    expect(PAGE).not.toContain('getPerformanceStatus');
    expect(PAGE).not.toMatch(/% of goal/);
  });
});

describe('coaching reasons (round 226)', () => {
  it('flags low activity and low conversion, and nothing else', () => {
    expect(coachingReasons({ activity_score: 60, total_leads: 50, deals_closed: 1 })).toEqual([
      { kind: 'activity', score: 60 },
      { kind: 'conversion', pct: 2 },
    ]);
    expect(coachingReasons({ activity_score: 100, total_leads: 10, deals_closed: 3 })).toEqual([]);
  });

  it('a rep with no leads has no conversion rate to be bad at', () => {
    expect(coachingReasons({ activity_score: 100, total_leads: 0, deals_closed: 0 })).toEqual([]);
  });

  it('growth is signed, and absent when there was nothing to compare', () => {
    expect(formatGrowth(12.5)).toBe('+12.5%');
    expect(formatGrowth(-4)).toBe('-4%');
    expect(formatGrowth(null)).toBeNull();
  });
});

describe('Schedule 1:1 and Review Pipeline do something (round 226)', () => {
  it('builds a calendar event naming the rep, or nothing without a date', () => {
    const rep = { rep_id: 'u1', rep_name: 'Dana R' };
    const b = oneOnOneBody(rep, '2026-10-01', '09:30', 30)!;
    expect(b.title).toBe('1:1 with Dana R');
    expect(new Date(b.endTime).getTime() - new Date(b.startTime).getTime()).toBe(30 * 60_000);
    expect(b).toMatchObject({ relatedEntityType: 'user', relatedEntityId: 'u1' });
    expect(oneOnOneBody(rep, '', '09:30', 30)).toBeNull();
    expect(oneOnOneBody(rep, '2026-10-01', '09:30', 0)).toBeNull();
  });

  it('the page posts it and filters the pipeline to the rep', () => {
    expect(PAGE).toMatch(/apiRequest\('\/api\/meetings\/calendar\/events', 'POST', body\)/);
    expect(PAGE).toMatch(/onClick=\{\(\) => setOneOnOneRep\(rep\)\}/);
    expect(PAGE).toMatch(/setSelectedRep\(rep\.rep_id\);\s*setViewMode\('pipeline'\);/);
  });
});
