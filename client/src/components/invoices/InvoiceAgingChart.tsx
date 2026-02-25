/**
 * Invoice Aging Analysis
 *
 * FN-002: Shows aging breakdown for AR management.
 */

import { Badge } from '@/components/ui/badge';

interface AgingBucket {
  label: string;
  count: number;
  total: number;
  color: string;
}

interface InvoiceAgingChartProps {
  current: number;
  thirtyDays: number;
  sixtyDays: number;
  ninetyDays: number;
  overNinety: number;
}

export function InvoiceAgingChart({
  current,
  thirtyDays,
  sixtyDays,
  ninetyDays,
  overNinety,
}: InvoiceAgingChartProps) {
  const total = current + thirtyDays + sixtyDays + ninetyDays + overNinety;

  const buckets: AgingBucket[] = [
    { label: 'Current', count: 0, total: current, color: 'bg-green-500' },
    { label: '1-30 Days', count: 0, total: thirtyDays, color: 'bg-yellow-500' },
    { label: '31-60 Days', count: 0, total: sixtyDays, color: 'bg-orange-500' },
    { label: '61-90 Days', count: 0, total: ninetyDays, color: 'bg-red-400' },
    { label: '90+ Days', count: 0, total: overNinety, color: 'bg-red-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">AR Aging Summary</h4>
        <span className="text-sm text-gray-500">
          Total: <strong>${total.toLocaleString()}</strong>
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
        {buckets.map((bucket) => {
          const pct = total > 0 ? (bucket.total / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={bucket.label}
              className={`${bucket.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${bucket.label}: $${bucket.total.toLocaleString()} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-5 gap-2 text-xs">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="text-center">
            <div className={`h-2 w-full rounded-full ${bucket.color} mb-1`} />
            <div className="font-medium text-gray-700">{bucket.label}</div>
            <div className="text-gray-500">${bucket.total.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
