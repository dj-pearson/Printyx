/**
 * CSV exports for the platform analytics pages (UI-DEAD-BUTTONS-001).
 *
 * The Export buttons on PlatformAnalytics and PlatformCohortAnalysis had no
 * handler. They export what each page actually shows, from the same query
 * data. A figure the platform does not measure (the endpoint answered null)
 * is written as an EMPTY cell, never as 0: a zero summed in a spreadsheet is a
 * claim, an empty cell is not.
 */

export interface MetricRow {
  section: string;
  metric: string;
  value: number | string | null;
}

type Num = number | null | undefined;

const row = (section: string, metric: string, value: Num): MetricRow => ({
  section,
  metric,
  value: value ?? null,
});

export interface PlatformAnalyticsData {
  revenue?: {
    mrr?: Num;
    arr?: Num;
    arpa?: Num;
    activeTenants?: Num;
    newCustomers?: Num;
    churnedCustomers?: Num;
    churnRate?: Num;
    grr?: Num;
    ltv?: Num;
    nrr?: Num;
  };
  conversion?: {
    leadConversionRate?: Num;
    funnelData?: { stage: string; count: number; percentage: number }[];
  };
  pipeline?: {
    totalValue?: Num;
    weightedValue?: Num;
    winRate?: Num;
    avgSalesCycle?: Num;
    coverage?: Num;
  };
  performance?: {
    sourceData?: { source: string; leads: number; conversions: number; rate: number }[];
    activityTotals?: object;
  };
  growth?: {
    revenueData?: { month: string; mrr: number; arr: number }[];
  };
}

export function platformMetricRows(d: PlatformAnalyticsData): MetricRow[] {
  const r = d.revenue ?? {};
  const p = d.pipeline ?? {};
  const rows: MetricRow[] = [
    row('Revenue', 'MRR', r.mrr),
    row('Revenue', 'ARR', r.arr),
    row('Revenue', 'ARPA', r.arpa),
    row('Revenue', 'Active tenants', r.activeTenants),
    row('Revenue', 'New customers', r.newCustomers),
    row('Revenue', 'Churned customers', r.churnedCustomers),
    row('Revenue', 'Churn rate %', r.churnRate),
    row('Revenue', 'Gross revenue retention %', r.grr),
    row('Revenue', 'LTV', r.ltv),
    row('Revenue', 'Net revenue retention %', r.nrr),
    row('Conversion', 'Lead conversion rate %', d.conversion?.leadConversionRate),
    row('Pipeline', 'Total value', p.totalValue),
    row('Pipeline', 'Weighted value', p.weightedValue),
    row('Pipeline', 'Win rate %', p.winRate),
    row('Pipeline', 'Average sales cycle (days)', p.avgSalesCycle),
    row('Pipeline', 'Coverage', p.coverage),
  ];
  for (const f of d.conversion?.funnelData ?? []) {
    rows.push(row('Funnel', f.stage, f.count));
  }
  for (const s of d.performance?.sourceData ?? []) {
    rows.push(row('Lead source', `${s.source} leads`, s.leads));
    rows.push(row('Lead source', `${s.source} conversions`, s.conversions));
  }
  for (const [k, v] of Object.entries(d.performance?.activityTotals ?? {})) {
    if (typeof v === 'number') rows.push(row('Activity', k, v));
  }
  for (const g of d.growth?.revenueData ?? []) {
    rows.push(row('Growth', `${g.month} MRR`, g.mrr));
  }
  return rows;
}

export const METRIC_EXPORT_COLUMNS = [
  { key: 'section' as const, label: 'Section' },
  { key: 'metric' as const, label: 'Metric' },
  { key: 'value' as const, label: 'Value' },
];
