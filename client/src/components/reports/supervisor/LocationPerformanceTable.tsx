import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import type { ScopedPerformanceReport, ScopedUnitPerformance } from '@/types/scoped-sales-reports';

/**
 * CR-034: rebuilt against the shape the report actually returns.
 *
 * Every column here read a field the handler does not emit: ranking, teamSize,
 * totalRevenue, dealsWon, averageDealSize and quotaAttainment against rows that
 * are { unitId, unitName, revenue, deals, winRate, pipelineValue }. The rows are
 * also unordered upstream, so the rank is derived here from revenue rather than
 * read off a field that never existed. The Team Size and Quota columns are gone:
 * there is no head-count on this report, and quotaAttainment is hardcoded 0
 * because there is no sales_quotas table — a permanent 0% badge reads as failure
 * when the truth is "not measured".
 */
interface LocationPerformanceTableProps {
  locations: ScopedUnitPerformance[];
  summary?: ScopedPerformanceReport['summary'];
}

const formatCurrency = (value: number) =>
  value >= 1000000
    ? `$${(value / 1000000).toFixed(1)}M`
    : value >= 1000
      ? `$${(value / 1000).toFixed(0)}K`
      : `$${value.toFixed(0)}`;

export default function LocationPerformanceTable({
  locations,
  summary,
}: LocationPerformanceTableProps) {
  const ranked = [...locations].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Deals Won</TableHead>
              <TableHead>Win Rate</TableHead>
              <TableHead>Avg Deal</TableHead>
              <TableHead>Open Pipeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No locations in scope.
                </TableCell>
              </TableRow>
            ) : (
              ranked.map((loc, index) => (
                <TableRow key={loc.unitId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                      <span className="font-medium">#{index + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{loc.unitName}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(loc.revenue)}</TableCell>
                  <TableCell>{loc.deals}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {loc.winRate >= 50 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      )}
                      <span>{loc.winRate.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {loc.deals > 0 ? formatCurrency(loc.revenue / loc.deals) : '--'}
                  </TableCell>
                  <TableCell>{formatCurrency(loc.pipelineValue)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {summary && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Revenue</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Open Pipeline</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalPipeline)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Avg Win Rate</div>
            <div className="text-2xl font-bold">{summary.averageWinRate.toFixed(0)}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
