import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  averageScore,
  toHealthViews,
  type CustomerHealthRow,
} from '../../../shared/customer-health-view';

/**
 * Round 192. CustomerSuccessManagement was written against a mock shape
 * (metrics, scoreBreakdown, alerts, dollar-valued opportunities) no column
 * holds, so the first real customer_health_scores row crashed it on
 * `score.metrics.satisfactionScore.toFixed(1)`. It reads real rows through
 * shared/customer-health-view.ts now.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(read('client/src/pages/CustomerSuccessManagement.tsx'));

const row = (over: Partial<CustomerHealthRow> = {}): CustomerHealthRow => ({
  customer_id: 'c1',
  customer_name: 'Acme Print',
  overall_score: 72,
  health_status: 'healthy',
  trend: 'stable',
  usage_score: 80,
  engagement_score: 60,
  support_score: 70,
  payment_score: 90,
  satisfaction_score: 50,
  days_since_last_service: 12,
  open_tickets_count: 2,
  overdue_invoices_count: 0,
  nps_score: null,
  csat: '4.20',
  risk_factors: ['Low engagement'],
  strength_factors: [],
  recommendations: ['Schedule a QBR'],
  calculated_at: '2026-09-20T00:00:00Z',
  next_calculation_due: null,
  ...over,
});

describe('toHealthViews', () => {
  it('keeps only the latest score per customer, whatever the order', () => {
    const views = toHealthViews([
      row({ overall_score: 40, calculated_at: '2026-08-01T00:00:00Z' }),
      row({ overall_score: 72, calculated_at: '2026-09-20T00:00:00Z' }),
      row({ customer_id: 'c2', calculated_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(views).toHaveLength(2);
    expect(views.find((v) => v.customerId === 'c1')?.overallScore).toBe(72);
  });

  it('maps the five factor columns and keeps a real zero', () => {
    const [v] = toHealthViews([row({ support_score: 0 })]);
    expect(v.factors.map((f) => [f.label, f.score])).toEqual([
      ['Usage', 80],
      ['Engagement', 60],
      ['Support', 0],
      ['Payment', 90],
      ['Satisfaction', 50],
    ]);
    expect(v.signals.overdueInvoices).toBe(0);
    expect(v.signals.nps).toBeNull();
    expect(v.signals.csat).toBe(4.2);
  });

  it('flags at-risk statuses and names an unresolved customer', () => {
    const [v] = toHealthViews([row({ health_status: 'critical', customer_name: null })]);
    expect(v.atRisk).toBe(true);
    expect(v.customerName).toBe('Customer c1');
  });

  it('averages only scores that exist', () => {
    expect(averageScore(toHealthViews([]))).toBeNull();
    expect(
      averageScore(
        toHealthViews([
          row({ overall_score: 60 }),
          row({ customer_id: 'c2', overall_score: null }),
        ]),
      ),
    ).toBe(60);
  });
});

describe('the page and endpoint', () => {
  it('reads real rows through the view, not the mock shape', () => {
    expect(PAGE).toContain('toHealthViews(');
    for (const mock of [
      'score.metrics',
      'scoreBreakdown',
      'score.alerts',
      'score.opportunities',
      'accountManager',
      'churnProbability',
    ]) {
      expect(PAGE, mock).not.toContain(mock);
    }
  });

  it('the endpoint resolves customer names for the list', () => {
    const fn = strip(read('supabase/functions/customer-success/handlers/health-scores.ts'));
    expect(fn).toMatch(/customer_name: names\.get\(r\.customer_id as string\) \?\? null/);
  });

  it('the card actions go somewhere', () => {
    expect(PAGE).toMatch(
      /onOpen=\{\(\) => setLocation\(`\/customers\/\$\{score\.customerId\}`\)\}/,
    );
    expect(PAGE).toMatch(/onTask=\{\(\) => setLocation\('\/tasks\?action=new'\)\}/);
    for (const dead of ['Schedule Call', 'Schedule Meeting', 'Take Action']) {
      expect(PAGE, dead).not.toContain(dead);
    }
  });
});
