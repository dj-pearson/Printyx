/**
 * Contract P&L Detail (US-SUPER-003).
 *
 * Per-contract 12-month margin breakdown: headline revenue/cost/GP%, a stacked
 * bar chart of monthly cost by category (labor / parts / supplies / financing)
 * with the revenue line overlaid, and a monthly table. Reached from the
 * profitability list (/contracts/:id/pnl).
 */

import { Link, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';

interface MonthlyPoint {
  month: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  gpPercent: number | null;
  labor: number;
  parts: number;
  supplies: number;
  financing: number;
}

interface ContractDetail {
  contractId: string;
  contractNumber: string | null;
  customerId: string | null;
  companyName: string | null;
  industry: string | null;
  salesRep: string | null;
  territory: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  revenue12: number;
  cost12: number;
  grossProfit: number;
  gpPercent: number | null;
  monthlyRevenue: number;
  monthlyCost: number;
  costBreakdown: { labor: number; parts: number; supplies: number; financing: number };
}

interface DetailResponse {
  viewMissing: boolean;
  gpAlertThreshold?: number;
  contract: ContractDetail | null;
  monthly: MonthlyPoint[];
}

function money(n: number | null | undefined): string {
  return `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export default function ContractPnlDetail() {
  const params = useParams();
  const contractId = (params as Record<string, string>).id;

  const { data, isLoading, isError, error } = useQuery<DetailResponse>({
    queryKey: [`/api/contract-pnl/${contractId}`],
    enabled: !!contractId,
  });

  const contract = data?.contract ?? null;
  const monthly = (data?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const threshold = data?.gpAlertThreshold ?? 20;

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/contracts/profitability">
          <Button variant="ghost" size="sm" className="min-h-[48px]">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{contract?.contractNumber || 'Contract P&L'}</h1>
          <p className="text-sm text-muted-foreground">
            {contract?.companyName || contract?.customerId || ''}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading P&L…</p>
      ) : isError ? (
        <p className="text-sm text-destructive py-8 text-center">
          Failed to load: {(error as any)?.message || 'Unknown error'}
        </p>
      ) : data?.viewMissing ? (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 text-sm text-amber-800 dark:text-amber-200">
            The contract P&L materialized views are not yet created. Run{' '}
            <code className="font-mono">drizzle/migrations/_backfill_contract_pnl.sql</code>.
          </CardContent>
        </Card>
      ) : !contract ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Contract not found.</p>
      ) : (
        <>
          {/* Headline metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Revenue (12mo)</CardDescription>
                <CardTitle className="text-2xl">{money(contract.revenue12)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cost (12mo)</CardDescription>
                <CardTitle className="text-2xl">{money(contract.cost12)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Gross profit (12mo)</CardDescription>
                <CardTitle className="text-2xl">{money(contract.grossProfit)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>GP %</CardDescription>
                <CardTitle className="text-2xl">
                  <Badge
                    variant={
                      contract.gpPercent == null
                        ? 'secondary'
                        : contract.gpPercent < threshold
                          ? 'destructive'
                          : 'default'
                    }
                    className="text-base"
                  >
                    {contract.gpPercent == null ? 'n/a' : `${contract.gpPercent}%`}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Stacked cost bar + revenue line */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly cost by category</CardTitle>
              <CardDescription>
                Stacked labor / parts / supplies / financing with revenue overlaid.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monthly.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No monthly data available.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Legend />
                    <Bar dataKey="labor" stackId="cost" fill="#6366f1" name="Labor" />
                    <Bar dataKey="parts" stackId="cost" fill="#f59e0b" name="Parts" />
                    <Bar dataKey="supplies" stackId="cost" fill="#10b981" name="Supplies" />
                    <Bar dataKey="financing" stackId="cost" fill="#ef4444" name="Financing" />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      name="Revenue"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Monthly table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly detail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Labor</TableHead>
                      <TableHead className="text-right">Parts</TableHead>
                      <TableHead className="text-right">Supplies</TableHead>
                      <TableHead className="text-right">Financing</TableHead>
                      <TableHead className="text-right">GP</TableHead>
                      <TableHead className="text-right">GP %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthly.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell>{m.label}</TableCell>
                        <TableCell className="text-right">{money(m.revenue)}</TableCell>
                        <TableCell className="text-right">{money(m.labor)}</TableCell>
                        <TableCell className="text-right">{money(m.parts)}</TableCell>
                        <TableCell className="text-right">{money(m.supplies)}</TableCell>
                        <TableCell className="text-right">{money(m.financing)}</TableCell>
                        <TableCell className="text-right">{money(m.grossProfit)}</TableCell>
                        <TableCell className="text-right">
                          {m.gpPercent == null ? '—' : `${m.gpPercent}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
