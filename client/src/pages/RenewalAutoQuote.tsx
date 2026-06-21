/**
 * Renewal Auto-Quote (US-SUPER-010).
 *
 * Sales console for system-generated renewal drafts created ~90 days before a
 * contract ends, re-tiered to the customer's actual 12-month usage. Shows the
 * "N renewals ready for review" widget, the draft table (underage flagged), a
 * detail dialog with the machine-by-machine breakdown + re-tier + prefilled
 * line items, win-rate stats, settings, and the "manual renewal only"
 * suppression list. The rep keeps the approval gate — nothing auto-sends.
 */

import { useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileText,
  Play,
  RefreshCw,
  Send,
  Settings2,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface LineItem {
  type: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface MachineBreakdown {
  equipmentId: string;
  serial: string | null;
  model: string | null;
  black: number;
  color: number;
}

interface RenewalDraft {
  id: string;
  contractId: string;
  customerId: string;
  companyName: string | null;
  status: string;
  assignedSalesRep: string | null;
  contractEndDate: string | null;
  expirationDate: string | null;
  totalBlackPages: number;
  totalColorPages: number;
  monthlyAvgBlack: number;
  monthlyAvgColor: number;
  peakMonth: string | null;
  peakVolume: number;
  machineBreakdown: MachineBreakdown[] | null;
  currentMonthlyRevenue: number;
  recommendedMonthlyRevenue: number;
  isUnderage: boolean;
  retierDetail: any;
  lineItems: LineItem[] | null;
  quoteValue: number;
  outcome: string;
}

interface ListResponse {
  data: RenewalDraft[];
  total: number;
  reviewCount: number;
}

interface Stats {
  totalDrafts: number;
  pendingReview: number;
  sent: number;
  autoWon: number;
  autoLost: number;
  autoWinRate: number | null;
  manualBaselineWinRate: number | null;
  manualBaselineNote: string;
}

interface Settings {
  tenantId: string;
  daysWindowStart: number;
  daysWindowEnd: number;
  growthBufferPct: number;
  underageThresholdPct: number;
  expirationDays: number;
  autoGenerateEnabled: boolean;
  updatedAt: string;
}

interface Suppression {
  id: string;
  customerId: string;
  reason: string | null;
  createdAt: string;
  companyName: string | null;
}

function money(n: number | null | undefined): string {
  return `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_OPTIONS = ['renewal_draft', 'sent', 'dismissed', 'all'];

export default function RenewalAutoQuote() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('renewal_draft');
  const [showSettings, setShowSettings] = useState(false);
  const [detail, setDetail] = useState<RenewalDraft | null>(null);
  const [suppressId, setSuppressId] = useState('');
  const [suppressReason, setSuppressReason] = useState('');

  const listKey =
    statusFilter === 'all'
      ? '/api/renewal-autoquote'
      : `/api/renewal-autoquote?status=${statusFilter}`;

  const { data: list, isLoading, isError, error } = useQuery<ListResponse>({ queryKey: [listKey] });
  const { data: stats } = useQuery<Stats>({ queryKey: ['/api/renewal-autoquote/stats'] });
  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: ['/api/renewal-autoquote/settings'],
  });
  const { data: suppressions } = useQuery<{ data: Suppression[] }>({
    queryKey: ['/api/renewal-autoquote/suppressions'],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [listKey] });
    queryClient.invalidateQueries({ queryKey: ['/api/renewal-autoquote/stats'] });
  };

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/renewal-autoquote/generate', { method: 'POST', body: { force: true } }),
    onSuccess: (data: any) => {
      toast({
        title: 'Generation complete',
        description: `${data?.generated ?? 0} drafts created (${data?.scanned ?? 0} contracts scanned).`,
      });
      invalidateAll();
    },
    onError: (err: any) =>
      toast({
        title: 'Generation failed',
        description: err?.message || 'Failed to generate',
        variant: 'destructive',
      }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: any }) =>
      apiRequest(`/api/renewal-autoquote/${id}/${action}`, { method: 'POST', body }),
    onSuccess: () => {
      invalidateAll();
      setDetail(null);
    },
    onError: (err: any) =>
      toast({
        title: 'Action failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (body: Partial<Settings>) =>
      apiRequest('/api/renewal-autoquote/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast({ title: 'Settings updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/renewal-autoquote/settings'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Update failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const suppressMutation = useMutation({
    mutationFn: (body: { customerId: string; reason?: string }) =>
      apiRequest('/api/renewal-autoquote/suppressions', { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Customer suppressed' });
      setSuppressId('');
      setSuppressReason('');
      queryClient.invalidateQueries({ queryKey: ['/api/renewal-autoquote/suppressions'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed', description: err?.message || 'Failed', variant: 'destructive' }),
  });

  const unsuppressMutation = useMutation({
    mutationFn: (customerId: string) =>
      apiRequest(`/api/renewal-autoquote/suppressions/${customerId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/renewal-autoquote/suppressions'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed', description: err?.message || 'Failed', variant: 'destructive' }),
  });

  const rows = list?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-emerald-500" />
            Renewal Auto-Quotes
          </h1>
          <p className="text-sm text-muted-foreground">
            Renewal drafts re-tiered to actual 12-month usage. Review and send — never auto-sent.
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
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="min-h-[48px]"
          >
            {generateMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Generate now
          </Button>
        </div>
      </div>

      {/* Review widget + stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-emerald-300">
          <CardHeader className="pb-2">
            <CardDescription>Ready for review</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">{list?.reviewCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sent</CardDescription>
            <CardTitle className="text-3xl">{stats?.sent ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Auto win rate</CardDescription>
            <CardTitle className="text-3xl">
              {stats?.autoWinRate == null ? '—' : `${stats.autoWinRate}%`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Won / Lost</CardDescription>
            <CardTitle className="text-2xl">
              {stats?.autoWon ?? 0} / {stats?.autoLost ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generator settings</CardTitle>
            <CardDescription>
              Window, growth buffer, and the daily-generator toggle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSettings ? (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            ) : settings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(
                  [
                    ['daysWindowStart', 'Window start (days)'],
                    ['daysWindowEnd', 'Window end (days)'],
                    ['growthBufferPct', 'Growth buffer (%)'],
                    ['underageThresholdPct', 'Underage threshold (%)'],
                    ['expirationDays', 'Quote validity (days)'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span className="text-sm font-medium">{label}</span>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={settings[key] as number}
                      onBlur={(e) =>
                        updateSettingsMutation.mutate({
                          [key]: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="min-h-[48px]"
                    />
                  </label>
                ))}
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={settings.autoGenerateEnabled}
                    onCheckedChange={(checked) =>
                      updateSettingsMutation.mutate({ autoGenerateEnabled: checked })
                    }
                    aria-label="Toggle daily generator"
                  />
                  <span className="text-sm font-medium">
                    Daily generator {settings.autoGenerateEnabled ? 'on' : 'off'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive">Failed to load settings.</p>
            )}

            {/* Suppression list */}
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">Manual renewal only (suppressed)</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <Input
                  placeholder="Customer ID"
                  value={suppressId}
                  onChange={(e) => setSuppressId(e.target.value)}
                  className="w-[220px] min-h-[48px]"
                />
                <Input
                  placeholder="Reason (optional)"
                  value={suppressReason}
                  onChange={(e) => setSuppressReason(e.target.value)}
                  className="w-[260px] min-h-[48px]"
                />
                <Button
                  variant="outline"
                  className="min-h-[48px]"
                  disabled={!suppressId || suppressMutation.isPending}
                  onClick={() =>
                    suppressMutation.mutate({
                      customerId: suppressId,
                      reason: suppressReason || undefined,
                    })
                  }
                >
                  <Ban className="h-4 w-4 mr-1" />
                  Suppress
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(suppressions?.data ?? []).map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1">
                    {s.companyName || s.customerId}
                    <button
                      type="button"
                      aria-label="Remove suppression"
                      onClick={() => unsuppressMutation.mutate(s.customerId)}
                      className="ml-1"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(suppressions?.data ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">None suppressed.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drafts table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">Renewal drafts</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className="min-h-[40px] capitalize"
              >
                {s === 'renewal_draft' ? 'Drafts' : s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load: {(error as any)?.message || 'Unknown error'}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No renewal drafts. Click "Generate now" to scan contracts ending soon.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Ends</TableHead>
                    <TableHead className="text-right">Current / mo</TableHead>
                    <TableHead className="text-right">Recommended / mo</TableHead>
                    <TableHead className="text-right">Annual value</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.companyName || r.customerId}</TableCell>
                      <TableCell>
                        {r.contractEndDate ? new Date(r.contractEndDate).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">{money(r.currentMonthlyRevenue)}</TableCell>
                      <TableCell className="text-right">
                        {money(r.recommendedMonthlyRevenue)}
                      </TableCell>
                      <TableCell className="text-right">{money(r.quoteValue)}</TableCell>
                      <TableCell>
                        {r.isUnderage && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Under-tiered
                          </Badge>
                        )}
                        {r.outcome !== 'pending' && (
                          <Badge variant="outline" className="ml-1 capitalize">
                            {r.outcome}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[40px]"
                          onClick={() => setDetail(r)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Renewal — {detail?.companyName || detail?.customerId}</DialogTitle>
            <DialogDescription>
              Re-tiered to actual 12-month usage with a growth buffer. Review, then send via the
              quote flow.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Total B/W (12mo)</div>
                  <div className="font-medium">{detail.totalBlackPages.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total color (12mo)</div>
                  <div className="font-medium">{detail.totalColorPages.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Peak month</div>
                  <div className="font-medium">{detail.peakMonth || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Annual value</div>
                  <div className="font-medium">{money(detail.quoteValue)}</div>
                </div>
              </div>

              {detail.isUnderage && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Under-tiered: actual usage exceeds the current contract tier. Re-tier captures{' '}
                  {money(detail.recommendedMonthlyRevenue - detail.currentMonthlyRevenue)}/mo.
                </div>
              )}

              {/* Line items */}
              <div>
                <h4 className="text-sm font-semibold mb-1">Prefilled line items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.lineItems ?? []).map((li, i) => (
                      <TableRow key={i}>
                        <TableCell>{li.description}</TableCell>
                        <TableCell className="text-right">{li.quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${li.rate.toFixed(5)}</TableCell>
                        <TableCell className="text-right">{money(li.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Machine breakdown */}
              {detail.machineBreakdown && detail.machineBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Machine-by-machine (12mo)</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">B/W</TableHead>
                        <TableHead className="text-right">Color</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.machineBreakdown.map((m) => (
                        <TableRow key={m.equipmentId}>
                          <TableCell>{m.serial || m.equipmentId.slice(0, 8)}</TableCell>
                          <TableCell>{m.model || '—'}</TableCell>
                          <TableCell className="text-right">{m.black.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{m.color.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {detail && detail.status === 'renewal_draft' && (
              <>
                <Button
                  variant="outline"
                  className="min-h-[48px]"
                  onClick={() => actionMutation.mutate({ id: detail.id, action: 'dismiss' })}
                >
                  <Ban className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
                <Button
                  className="min-h-[48px]"
                  onClick={() => actionMutation.mutate({ id: detail.id, action: 'mark-sent' })}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Mark sent
                </Button>
              </>
            )}
            {detail && detail.status === 'sent' && detail.outcome === 'pending' && (
              <>
                <Button
                  variant="outline"
                  className="min-h-[48px]"
                  onClick={() =>
                    actionMutation.mutate({
                      id: detail.id,
                      action: 'outcome',
                      body: { outcome: 'lost' },
                    })
                  }
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Mark lost
                </Button>
                <Button
                  className="min-h-[48px]"
                  onClick={() =>
                    actionMutation.mutate({
                      id: detail.id,
                      action: 'outcome',
                      body: { outcome: 'won' },
                    })
                  }
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark won
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
