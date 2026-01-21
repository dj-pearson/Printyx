import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

export default function LocationPerformanceTable({ locations, summary, insights }: any) {
  const formatCurrency = (value: number) =>
    value >= 1000000
      ? `$${(value / 1000000).toFixed(1)}M`
      : value >= 1000
        ? `$${(value / 1000).toFixed(0)}K`
        : `$${value.toFixed(0)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Team Size</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Deals</TableHead>
              <TableHead>Win Rate</TableHead>
              <TableHead>Avg Deal</TableHead>
              <TableHead>Quota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((loc: any) => (
              <TableRow key={loc.locationId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {loc.ranking === 1 && <Trophy className="h-4 w-4 text-yellow-500" />}
                    <span className="font-medium">#{loc.ranking}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{loc.locationName}</TableCell>
                <TableCell>{loc.teamSize}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(loc.totalRevenue)}</TableCell>
                <TableCell>{loc.dealsWon}</TableCell>
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
                <TableCell>{formatCurrency(loc.averageDealSize)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      loc.quotaAttainment >= 100
                        ? 'success'
                        : loc.quotaAttainment >= 80
                          ? 'default'
                          : ('destructive' as any)
                    }
                  >
                    {loc.quotaAttainment.toFixed(0)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
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
            <div className="text-sm text-muted-foreground">Total Deals</div>
            <div className="text-2xl font-bold">{summary.totalDeals}</div>
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
