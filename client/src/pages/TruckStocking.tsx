/**
 * Predictive Parts Truck-Stocking Optimizer (US-SUPER-007).
 *
 * Service console for the Sunday-night optimizer that recommends the parts each
 * tech should carry, based on their last-90-day parts-used patterns. Shows the
 * per-tech latest recommendation (current → projected fill rate, recommended
 * additions, status), a detail dialog with the recommended-items table, a
 * "download pick list" CSV link, the pick/receive restock workflow, and a small
 * per-tech capacity settings editor.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  CheckCircle2,
  Download,
  PackageCheck,
  Play,
  RefreshCw,
  Settings2,
  Truck,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';

interface RecommendedItem {
  sku: string;
  description: string;
  recommendedQty: number;
  currentQty: number;
  delta: number;
  unitCost: number;
  usage90d: number;
}

interface Recommendation {
  id: string;
  techUserId: string;
  techName: string | null;
  generatedAt: string;
  currentFillRate: number;
  projectedFillRate: number;
  capacityTotal: number | null;
  capacityDistinct: number | null;
  recommendedItems: RecommendedItem[] | null;
  recommendedAdditions: number;
  status: string;
  pickedAt: string | null;
  receivedAt: string | null;
}

interface ListResponse {
  data: Recommendation[];
  total: number;
}

interface Stats {
  totalCallbacks: number;
  callbacksByTech: { techUserId: string; techName: string | null; count: number }[];
  recommendationCount: number;
  avgCurrentFillRate: number | null;
  avgProjectedFillRate: number | null;
  fillRateLift: number | null;
}

interface Settings {
  id: string;
  tenantId: string;
  techUserId: string;
  maxTotalQuantity: number;
  maxDistinctSkus: number;
  updatedAt: string;
}

function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${n}%`;
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'received') return 'default';
  if (status === 'picking') return 'secondary';
  return 'outline';
}

export default function TruckStocking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<Recommendation | null>(null);

  const {
    data: list,
    isLoading,
    isError,
    error,
  } = useQuery<ListResponse>({ queryKey: ['/api/truck-stock/recommendations'] });
  const { data: stats } = useQuery<Stats>({ queryKey: ['/api/truck-stock/stats'] });

  // Settings for the tech currently open in the detail dialog.
  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: [`/api/truck-stock/settings?techUserId=${detail?.techUserId ?? ''}`],
    enabled: !!detail?.techUserId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/truck-stock/recommendations'] });
    queryClient.invalidateQueries({ queryKey: ['/api/truck-stock/stats'] });
  };

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('/api/truck-stock/generate', { method: 'POST', body: {} }),
    onSuccess: (data: any) => {
      toast({
        title: 'Optimizer complete',
        description: `${data?.generated ?? 0} recommendation(s) generated across ${data?.techs ?? 0} tech(s).`,
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
    mutationFn: ({ id, action }: { id: string; action: 'pick' | 'receive' }) =>
      apiRequest(`/api/truck-stock/recommendations/${id}/${action}`, { method: 'POST' }),
    onSuccess: (_data: any, vars) => {
      toast({
        title: vars.action === 'pick' ? 'Marked picking' : 'Received — truck updated',
      });
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
    mutationFn: (body: {
      techUserId: string;
      maxTotalQuantity?: number;
      maxDistinctSkus?: number;
    }) => apiRequest('/api/truck-stock/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast({ title: 'Capacity updated' });
      if (detail?.techUserId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/truck-stock/settings?techUserId=${detail.techUserId}`],
        });
      }
    },
    onError: (err: any) =>
      toast({
        title: 'Update failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const downloadPickList = (id: string) => {
    window.open(getApiUrl(`/api/truck-stock/recommendations/${id}/export.csv`), '_blank');
  };

  const rows = list?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-500" />
            Truck-Stocking Optimizer
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicted parts each tech should carry, from their last-90-day usage. Pick, receive, and
            the truck inventory updates automatically.
          </p>
        </div>
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-emerald-300">
          <CardHeader className="pb-2">
            <CardDescription>Avg fill rate (current → projected)</CardDescription>
            <CardTitle className="text-2xl">
              {pct(stats?.avgCurrentFillRate)} <span className="text-muted-foreground">→</span>{' '}
              <span className="text-emerald-600">{pct(stats?.avgProjectedFillRate)}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fill-rate lift</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {stats?.fillRateLift == null ? '—' : `+${stats.fillRateLift}%`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recommendations</CardDescription>
            <CardTitle className="text-3xl">{stats?.recommendationCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Callbacks (missing parts)</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalCallbacks ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recommendations table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Latest recommendation per tech</CardTitle>
          <CardDescription>
            Click a row to review the pick list and restock workflow.
          </CardDescription>
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
              No recommendations yet. Click "Generate now" to run the optimizer across techs with
              recent parts jobs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tech</TableHead>
                    <TableHead>Fill rate</TableHead>
                    <TableHead className="text-right">Recommended additions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                      <TableCell className="font-medium">
                        {r.techName || r.techUserId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{pct(r.currentFillRate)}</span>{' '}
                        <span className="text-muted-foreground">→</span>{' '}
                        <span className="font-semibold text-emerald-600">
                          {pct(r.projectedFillRate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{r.recommendedAdditions}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)} className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(r.generatedAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[40px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(r);
                          }}
                        >
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
            <DialogTitle>
              Truck stock — {detail?.techName || detail?.techUserId?.slice(0, 8)}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `Stock these ${
                    (detail.recommendedItems ?? []).filter((i) => i.delta > 0).length
                  } additional part(s) to improve fill rate from ${pct(
                    detail.currentFillRate,
                  )} → ${pct(detail.projectedFillRate)}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Current fill rate</div>
                  <div className="font-medium">{pct(detail.currentFillRate)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Projected fill rate</div>
                  <div className="font-medium text-emerald-600">
                    {pct(detail.projectedFillRate)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Capacity (qty)</div>
                  <div className="font-medium">{detail.capacityTotal ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Capacity (distinct)</div>
                  <div className="font-medium">{detail.capacityDistinct ?? '—'}</div>
                </div>
              </div>

              {/* Capacity settings editor */}
              <div className="rounded-md border p-3">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Settings2 className="h-4 w-4" />
                  Capacity settings
                </h4>
                {loadingSettings ? (
                  <p className="text-sm text-muted-foreground">Loading settings…</p>
                ) : settings ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-sm font-medium">Max total quantity</span>
                      <Input
                        type="number"
                        min={1}
                        defaultValue={settings.maxTotalQuantity}
                        onBlur={(e) =>
                          updateSettingsMutation.mutate({
                            techUserId: detail.techUserId,
                            maxTotalQuantity: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        className="min-h-[48px]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium">Max distinct SKUs</span>
                      <Input
                        type="number"
                        min={1}
                        defaultValue={settings.maxDistinctSkus}
                        onBlur={(e) =>
                          updateSettingsMutation.mutate({
                            techUserId: detail.techUserId,
                            maxDistinctSkus: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        className="min-h-[48px]"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-destructive">Failed to load settings.</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Re-run "Generate now" after changing capacity to apply it.
                </p>
              </div>

              {/* Recommended items */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold">Recommended items</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[40px]"
                    onClick={() => downloadPickList(detail.id)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download pick list (CSV)
                  </Button>
                </div>
                {(detail.recommendedItems ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No recommended items — no recent parts usage for this tech.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Recommended</TableHead>
                        <TableHead className="text-right">Delta</TableHead>
                        <TableHead className="text-right">Unit cost</TableHead>
                        <TableHead className="text-right">90d usage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.recommendedItems ?? []).map((it) => (
                        <TableRow key={it.sku}>
                          <TableCell className="font-medium">{it.sku}</TableCell>
                          <TableCell>{it.description}</TableCell>
                          <TableCell className="text-right">{it.currentQty}</TableCell>
                          <TableCell className="text-right">{it.recommendedQty}</TableCell>
                          <TableCell className="text-right">
                            <span className={it.delta > 0 ? 'text-emerald-600 font-medium' : ''}>
                              {it.delta > 0 ? `+${it.delta}` : it.delta}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">${it.unitCost.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{it.usage90d}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {detail && detail.status === 'draft' && (
              <Button
                className="min-h-[48px]"
                disabled={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ id: detail.id, action: 'pick' })}
              >
                <PackageCheck className="h-4 w-4 mr-1" />
                Mark picking
              </Button>
            )}
            {detail && (detail.status === 'draft' || detail.status === 'picking') && (
              <Button
                variant={detail.status === 'picking' ? 'default' : 'outline'}
                className="min-h-[48px]"
                disabled={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ id: detail.id, action: 'receive' })}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark received
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
