import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function LocationQuotaTracker({ quotas, summary, insights }: any) {
  const formatCurrency = (value: number) => value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value.toFixed(0)}`;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="text-sm font-medium text-green-900 dark:text-green-100">Exceeding</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">{insights?.attainmentDistribution?.exceeding || 0}</div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm font-medium text-blue-900 dark:text-blue-100">On Track</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{insights?.attainmentDistribution?.onTrack || 0}</div>
        </div>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100">At Risk</div>
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{insights?.attainmentDistribution?.atRisk || 0}</div>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="text-sm font-medium text-red-900 dark:text-red-100">Critical</div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">{insights?.attainmentDistribution?.critical || 0}</div>
        </div>
      </div>

      {/* Location Quota Progress */}
      <div className="space-y-3">
        {quotas.map((quota: any) => (
          <div key={quota.locationId} className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {quota.attainmentPercent >= 100 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : quota.attainmentPercent >= 75 ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-semibold">{quota.locationName}</span>
              </div>
              <Badge variant={quota.attainmentPercent >= 100 ? 'success' : quota.attainmentPercent >= 90 ? 'default' : 'destructive' as any}>
                {quota.attainmentPercent.toFixed(0)}%
              </Badge>
            </div>
            <Progress value={Math.min(quota.attainmentPercent, 100)} className="h-2 mb-2" />
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Actual:</span>{' '}
                <span className="font-semibold">{formatCurrency(quota.actualRevenue)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Quota:</span>{' '}
                <span className="font-semibold">{formatCurrency(quota.quotaAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Forecast:</span>{' '}
                <span className="font-semibold">{formatCurrency(quota.forecast)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Summary */}
      {summary && (
        <div className="pt-4 border-t grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Overall Attainment</div>
            <div className="text-3xl font-bold">{summary.overallAttainment.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatCurrency(summary.totalRevenue)} / {formatCurrency(summary.totalQuota)}
            </div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Locations Status</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">{summary.locationsOnTrack}</span>
              <span className="text-sm text-muted-foreground">on track</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.locationsAtRisk} at risk
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
