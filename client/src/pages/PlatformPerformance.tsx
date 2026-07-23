import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import MainLayout from '@/components/layout/main-layout';
import { ArrowLeft } from 'lucide-react';

interface RepPerformance {
  repId: string;
  repName: string;
  totalActivities: number;
  leadsGenerated: number;
  dealsWon: number;
  revenueGenerated: number;
  avgDealSize: number;
  conversionRate: number;
}

interface PerformanceResponse {
  repPerformance: RepPerformance[];
  teamTotals?: {
    totalActivities?: number;
    leadsGenerated?: number;
    dealsWon?: number;
    revenueGenerated?: number;
  };
}

function money(value?: number | null): string {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function percent(value?: number | null): string {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export default function PlatformPerformance() {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<PerformanceResponse>({
    queryKey: ['/api/platform-analytics/sales-performance'],
  });

  const reps = data?.repPerformance ?? [];
  const totals = data?.teamTotals;

  return (
    <MainLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/platform-crm')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Platform CRM
        </Button>

        <div>
          <h1 className="text-2xl font-bold">Sales Performance</h1>
          <p className="text-sm text-muted-foreground">
            Full rep performance across all tenants, ranked by revenue
          </p>
        </div>

        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-lg font-semibold">{money(totals.revenueGenerated)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Deals Won</p>
                <p className="text-lg font-semibold">{totals.dealsWon ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="text-lg font-semibold">{totals.leadsGenerated ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Activities</p>
                <p className="text-lg font-semibold">{totals.totalActivities ?? 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rep Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading performance…</p>
            ) : isError ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Could not load performance data.
              </p>
            ) : reps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No performance data available.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Activities</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Deals Won</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Avg Deal</TableHead>
                      <TableHead className="text-right">Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reps.map((rep, idx) => (
                      <TableRow key={rep.repId || idx}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {idx < 3 && (
                              <Badge
                                variant={idx === 0 ? 'default' : 'secondary'}
                                className="w-6 h-6 rounded-full p-0 flex items-center justify-center"
                              >
                                {idx + 1}
                              </Badge>
                            )}
                            {rep.repName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{rep.totalActivities ?? 0}</TableCell>
                        <TableCell className="text-right">{rep.leadsGenerated ?? 0}</TableCell>
                        <TableCell className="text-right">{rep.dealsWon ?? 0}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {money(rep.revenueGenerated)}
                        </TableCell>
                        <TableCell className="text-right">{money(rep.avgDealSize)}</TableCell>
                        <TableCell className="text-right">{percent(rep.conversionRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
