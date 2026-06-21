/**
 * Contract Profitability (US-SUPER-003).
 *
 * OWNER-oriented live margin console across active service contracts. Table is
 * sortable by GP% with monthly revenue/cost, a 12-month GP% sparkline, and a
 * status badge; rows link to the per-contract P&L detail (/contracts/:id/pnl).
 * Includes filters, on-demand (rate-limited) refresh, CSV export, the weekly
 * below-threshold digest preview, and the per-tenant cost-rate settings panel.
 */

import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Download, Mail, RefreshCw, Settings2, TrendingDown } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';

interface SettingsUpdate {
  techBurdenedRate?: number;
  avgPartCost?: number;
  financingRate?: number;
  gpAlertThreshold?: number;
  digestEnabled?: boolean;
}

interface PnlRow {
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
  monthlyRevenue: number;
  monthlyCost: number;
  grossProfit: number;
  gpPercent: number | null;
  costBreakdown: { labor: number; parts: number; supplies: number; financing: number };
  trend: number[];
}

interface PnlListResponse {
  data: PnlRow[];
  total: number;
  viewMissing: boolean;
  gpAlertThreshold: number;
  belowThreshold: number;
  lastRefreshedAt: string | null;
}

interface Settings {
  tenantId: string;
  techBurdenedRate: string;
  avgPartCost: string;
  financingRate: number;
  gpAlertThreshold: number;
  digestEnabled: boolean;
  lastRefreshedAt: string | null;
  updatedAt: string;
}

interface Digest {
  title: string;
  generatedAt: string;
  gpAlertThreshold: number;
  digestEnabled: boolean;
  belowThresholdCount: number;
  viewMissing: boolean;
  contracts: PnlRow[];
}

const SORT_OPTIONS = [
  { value: 'gp_asc', label: 'GP% (worst first)' },
  { value: 'gp_desc', label: 'GP% (best first)' },
  { value: 'revenue_desc', label: 'Revenue (high → low)' },
  { value: 'revenue_asc', label: 'Revenue (low → high)' },
];

const STATUS_OPTIONS = ['all', 'active', 'inactive', 'expired'];

function money(n: number | null | undefined): string {
  return `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function gpVariant(gp: number | null, threshold: number): 'default' | 'secondary' | 'destructive' {
  if (gp == null) return 'secondary';
  if (gp < threshold) return 'destructive';
  if (gp < threshold + 15) return 'default';
  return 'secondary';
}

/** Inline SVG GP% sparkline; clamps to a 0..60% visual band. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const w = 120;
  const h = 32;
  const lo = -20;
  const hi = 60;
  const norm = (p: number) => {
    const clamped = Math.max(lo, Math.min(hi, p));
    return h - ((clamped - lo) / (hi - lo)) * h;
  };
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${i * step},${norm(p)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} role="img" aria-label="12-month GP% trend">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        points={coords}
        className={last < 20 ? 'text-red-500' : 'text-emerald-500'}
      />
    </svg>
  );
}

export default function ContractProfitability() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('active');
  const [sort, setSort] = useState('gp_asc');
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [digest, setDigest] = useState<Digest | null>(null);

  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (sort) params.set('sort', sort);
  if (search) params.set('search', search);
  const listKey = `/api/contract-pnl?${params.toString()}`;

  const {
    data: list,
    isLoading,
    isError,
    error,
  } = useQuery<PnlListResponse>({ queryKey: [listKey] });

  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: ['/api/contract-pnl/settings'],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('/api/contract-pnl/refresh', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Refreshed', description: 'Contract P&L recalculated.' });
      queryClient.invalidateQueries({ queryKey: [listKey] });
    },
    onError: (err: any) =>
      toast({
        title: 'Refresh failed',
        description: err?.message || 'Could not refresh',
        variant: 'destructive',
      }),
  });

  const digestMutation = useMutation({
    mutationFn: () => apiRequest('/api/contract-pnl/digest/preview', { method: 'POST' }),
    onSuccess: (data: Digest) => setDigest(data),
    onError: (err: any) =>
      toast({
        title: 'Digest failed',
        description: err?.message || 'Could not assemble digest',
        variant: 'destructive',
      }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (body: SettingsUpdate) =>
      apiRequest('/api/contract-pnl/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast({ title: 'Settings updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/contract-pnl/settings'] });
      queryClient.invalidateQueries({ queryKey: [listKey] });
    },
    onError: (err: any) =>
      toast({
        title: 'Update failed',
        description: err?.message || 'Could not update settings',
        variant: 'destructive',
      }),
  });

  const rows = list?.data ?? [];
  const threshold = list?.gpAlertThreshold ?? 20;

  const handleExport = () => {
    const url = getApiUrl(`/api/contract-pnl/export.csv?${params.toString()}`);
    window.open(url, '_blank');
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-amber-500" />
            Contract Profitability
          </h1>
          <p className="text-sm text-muted-foreground">
            Live per-contract margin (CPC revenue − parts, labor, supplies, financing).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowSettings((s) => !s)}
            className="min-h-[48px]"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            className="min-h-[48px]"
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => digestMutation.mutate()}
            disabled={digestMutation.isPending}
            className="min-h-[48px]"
          >
            <Mail className="h-4 w-4 mr-2" />
            Margin alert
          </Button>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="min-h-[48px]"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {list?.viewMissing && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 text-sm text-amber-800 dark:text-amber-200">
            The contract P&L materialized views are not yet created. Run{' '}
            <code className="font-mono">drizzle/migrations/_backfill_contract_pnl.sql</code> to
            populate them.
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contracts</CardDescription>
            <CardTitle className="text-2xl">{list?.total ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Below {threshold}% GP</CardDescription>
            <CardTitle className="text-2xl text-destructive">{list?.belowThreshold ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last refreshed</CardDescription>
            <CardTitle className="text-base">
              {list?.lastRefreshedAt ? new Date(list.lastRefreshedAt).toLocaleString() : 'Never'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cost & alert settings</CardTitle>
            <CardDescription>
              Per-tenant rates applied at read time, GP alert threshold, and digest toggle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSettings ? (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            ) : settings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Burdened labor rate ($/hr)</span>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={Number(settings.techBurdenedRate)}
                    onBlur={(e) =>
                      updateSettingsMutation.mutate({
                        techBurdenedRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="min-h-[48px]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Avg part cost ($)</span>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={Number(settings.avgPartCost)}
                    onBlur={(e) =>
                      updateSettingsMutation.mutate({
                        avgPartCost: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="min-h-[48px]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">GP alert threshold (%)</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={settings.gpAlertThreshold}
                    onBlur={(e) =>
                      updateSettingsMutation.mutate({
                        gpAlertThreshold: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="min-h-[48px]"
                  />
                </label>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={settings.digestEnabled}
                    onCheckedChange={(checked) =>
                      updateSettingsMutation.mutate({ digestEnabled: checked })
                    }
                    aria-label="Toggle weekly margin digest"
                  />
                  <span className="text-sm font-medium">
                    Weekly digest {settings.digestEnabled ? 'on' : 'off'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive">Failed to load settings.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters + table */}
      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <CardTitle className="text-lg">Contracts by margin</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search contract / customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px] min-h-[48px]"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] min-h-[48px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[200px] min-h-[48px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading contracts…</p>
          ) : isError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load: {(error as any)?.message || 'Unknown error'}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No contracts found. Refresh after running the migration to populate the P&L views.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Monthly revenue</TableHead>
                    <TableHead className="text-right">Monthly cost</TableHead>
                    <TableHead className="text-right">GP %</TableHead>
                    <TableHead>12-mo trend</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.contractId}>
                      <TableCell>
                        <Link
                          href={`/contracts/${r.contractId}/pnl`}
                          className="font-medium text-primary hover:underline"
                        >
                          {r.contractNumber || r.contractId.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{r.companyName || r.customerId || '—'}</TableCell>
                      <TableCell className="text-right">{money(r.monthlyRevenue)}</TableCell>
                      <TableCell className="text-right">{money(r.monthlyCost)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={gpVariant(r.gpPercent, threshold)}>
                          {r.gpPercent == null ? 'n/a' : `${r.gpPercent}%`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Sparkline points={r.trend} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{r.status || '—'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Digest dialog */}
      <Dialog open={!!digest} onOpenChange={(open) => !open && setDigest(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {digest?.title}
            </DialogTitle>
            <DialogDescription>
              {digest?.belowThresholdCount ?? 0} contracts below {digest?.gpAlertThreshold ?? 20}%
              GP.
              {digest && !digest.digestEnabled ? ' (Digest delivery is currently off.)' : ''}
            </DialogDescription>
          </DialogHeader>
          {digest && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">GP %</TableHead>
                    <TableHead className="text-right">Monthly GP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {digest.contracts.map((c) => (
                    <TableRow key={c.contractId}>
                      <TableCell>{c.contractNumber || c.contractId.slice(0, 8)}</TableCell>
                      <TableCell>{c.companyName || c.customerId || '—'}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {c.gpPercent == null ? 'n/a' : `${c.gpPercent}%`}
                      </TableCell>
                      <TableCell className="text-right">
                        {money(c.monthlyRevenue - c.monthlyCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
