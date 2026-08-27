import { Target } from 'lucide-react';
import type { ScopedQuotaReport } from '@/types/scoped-sales-reports';

/**
 * CR-034: this component CRASHED the supervisor dashboard's Quota tab.
 *
 * It took `{ quotas, summary, insights }: any` and called
 * `summary.overallAttainment.toFixed(0)` and `summary.locationsOnTrack`. The
 * quota endpoint returns a summary object of
 * { totalQuota, totalActual, averageAttainment } — so `summary` is truthy, the
 * `{summary && ...}` guard passes, `overallAttainment` is undefined and
 * `.toFixed` throws a TypeError during render. It was not a blank card; the tab
 * threw. `quotas`, `insights.attainmentDistribution` and every field on the
 * progress rows (locationId, locationName, attainmentPercent, actualRevenue,
 * quotaAmount, forecast) are equally absent.
 *
 * The endpoint has no non-degraded path at all: scoped-sales.ts answers `quota`
 * with degradedQuota() unconditionally, because there is no sales_quotas table.
 * So the honest render is one that says so.
 */
interface LocationQuotaTrackerProps {
  report?: ScopedQuotaReport;
}

export default function LocationQuotaTracker({ report }: LocationQuotaTrackerProps) {
  const hasQuotas = (report?.regions?.length ?? 0) > 0 && !report?.degraded?.salesQuotasTable;

  if (!hasQuotas) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Target className="h-10 w-10 mb-3 text-muted-foreground opacity-40" />
        <p className="font-medium">Quota tracking is not set up</p>
        <p className="text-sm text-muted-foreground max-w-md mt-1">
          No quotas have been defined for these locations, so attainment cannot be measured. A 0%
          here would mean unknown, not missed, which is why it is not shown.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 bg-muted rounded-lg">
        <div className="text-sm text-muted-foreground mb-1">Average Attainment</div>
        <div className="text-3xl font-bold">
          {(report?.summary.averageAttainment ?? 0).toFixed(0)}%
        </div>
      </div>
      <div className="p-4 bg-muted rounded-lg">
        <div className="text-sm text-muted-foreground mb-1">Total Quota</div>
        <div className="text-3xl font-bold">
          ${((report?.summary.totalQuota ?? 0) / 1000).toFixed(0)}K
        </div>
      </div>
      <div className="p-4 bg-muted rounded-lg">
        <div className="text-sm text-muted-foreground mb-1">Actual</div>
        <div className="text-3xl font-bold">
          ${((report?.summary.totalActual ?? 0) / 1000).toFixed(0)}K
        </div>
      </div>
    </div>
  );
}
