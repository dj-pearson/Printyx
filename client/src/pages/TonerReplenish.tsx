/**
 * Multi-Vendor Toner Auto-Replenish (US-SUPER-012).
 *
 * Ops console for the toner pre-depletion pipeline. "Run now" captures supply
 * levels and evaluates depletion (linear regression over the last 14 days),
 * creating replenishment orders that auto-ship under the cost ceiling or wait
 * for approval above it. Shows per-machine toner bars (color-coded, red when
 * low) with predicted depletion + an emergency ship-now + per-machine settings
 * (auto-ship, cost ceiling, customer-managed suppression, emergency override);
 * an orders table with approve/ship + cancel; and tenant settings.
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, Ban, Droplet, Play, RefreshCw, Settings2, Truck, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Level {
  id: string;
  machineId: string;
  color: string;
  percentRemaining: number | null;
  pageCountRemaining: number | null;
  source: string;
  capturedAt: string;
  serialNumber: string | null;
  modelNumber: string | null;
  manufacturer: string | null;
  isColorCapable: boolean;
  customerId: string | null;
  companyName: string | null;
  predictedDepletionDate: string | null;
}

interface SupplyOrder {
  id: string;
  machineId: string;
  color: string | null;
  status: string;
  vendor: string | null;
  supplyName: string | null;
  quantity: number;
  unitCost: string | null;
  totalCost: string | null;
  predictedDepletionDate: string | null;
  triggerReason: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  expectedArrivalDate: string | null;
  customerNotified: boolean;
  isEmergency: boolean;
  createdAt: string;
  serialNumber: string | null;
  modelNumber: string | null;
}

interface MachineSettings {
  id: string;
  tenantId: string;
  machineId: string;
  autoShipEnabled: boolean;
  costCeiling: number | null;
  emergencyOverride: boolean;
  customerManaged: boolean;
  leadTimeDays: number | null;
  safetyBufferDays: number | null;
}

interface TenantSettings {
  tenantId: string;
  approvalCostThreshold: number;
  defaultLeadTimeDays: number;
  defaultSafetyBufferDays: number;
  updatedAt: string;
}

const COLOR_HEX: Record<string, string> = {
  k: '#1f2937',
  c: '#06b6d4',
  m: '#db2777',
  y: '#eab308',
};
const COLOR_LABEL: Record<string, string> = { k: 'Black', c: 'Cyan', m: 'Magenta', y: 'Yellow' };

const ORDER_STATUS_FILTERS = ['all', 'pending_approval', 'auto_ship', 'shipped', 'cancelled'];

function money(s: string | null | undefined): string {
  const n = s == null ? 0 : Number(s);
  return `$${(Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null | undefined): string {
  return s ? new Date(s).toLocaleDateString() : '—';
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'pending_approval') return 'destructive';
  if (status === 'auto_ship') return 'default';
  if (status === 'shipped' || status === 'delivered') return 'secondary';
  return 'outline';
}

// Group latest levels by machine for the per-machine cards.
interface MachineGroup {
  machineId: string;
  serialNumber: string | null;
  modelNumber: string | null;
  manufacturer: string | null;
  companyName: string | null;
  levels: Level[];
}

function groupByMachine(levels: Level[]): MachineGroup[] {
  const map = new Map<string, MachineGroup>();
  for (const l of levels) {
    let g = map.get(l.machineId);
    if (!g) {
      g = {
        machineId: l.machineId,
        serialNumber: l.serialNumber,
        modelNumber: l.modelNumber,
        manufacturer: l.manufacturer,
        companyName: l.companyName,
        levels: [],
      };
      map.set(l.machineId, g);
    }
    g.levels.push(l);
  }
  return Array.from(map.values());
}

export default function TonerReplenish() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [orderStatus, setOrderStatus] = useState('all');

  const {
    data: levels,
    isLoading: loadingLevels,
    isError: levelsError,
    error: levelsErr,
  } = useQuery<{ data: Level[] }>({ queryKey: ['/api/toner-replenish/levels'] });

  const ordersKey =
    orderStatus === 'all'
      ? '/api/toner-replenish/orders'
      : `/api/toner-replenish/orders?status=${orderStatus}`;
  const {
    data: orders,
    isLoading: loadingOrders,
    isError: ordersError,
  } = useQuery<{ data: SupplyOrder[] }>({ queryKey: [ordersKey] });

  const { data: settings, isLoading: loadingSettings } = useQuery<TenantSettings>({
    queryKey: ['/api/toner-replenish/settings'],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/toner-replenish/levels'] });
    queryClient.invalidateQueries({ queryKey: [ordersKey] });
  };

  const runMutation = useMutation({
    mutationFn: () => apiRequest('/api/toner-replenish/run', { method: 'POST', body: {} }),
    onSuccess: (data: any) => {
      toast({
        title: 'Pipeline complete',
        description: `${data?.capture?.readings ?? 0} readings captured · ${data?.evaluate?.created ?? 0} orders created.`,
      });
      invalidateAll();
    },
    onError: (err: any) =>
      toast({
        title: 'Run failed',
        description: err?.message || 'Failed to run',
        variant: 'destructive',
      }),
  });

  const orderActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'ship' | 'cancel' }) =>
      apiRequest(`/api/toner-replenish/orders/${id}/${action}`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast({ title: 'Order updated' });
      invalidateAll();
    },
    onError: (err: any) =>
      toast({ title: 'Failed', description: err?.message || 'Failed', variant: 'destructive' }),
  });

  const shipNowMutation = useMutation({
    mutationFn: ({ machineId, color }: { machineId: string; color?: string }) =>
      apiRequest(`/api/toner-replenish/machines/${machineId}/ship-now`, {
        method: 'POST',
        body: color ? { color } : {},
      }),
    onSuccess: () => {
      toast({ title: 'Emergency shipment created' });
      invalidateAll();
    },
    onError: (err: any) =>
      toast({ title: 'Failed', description: err?.message || 'Failed', variant: 'destructive' }),
  });

  const updateTenantSettings = useMutation({
    mutationFn: (body: Partial<TenantSettings>) =>
      apiRequest('/api/toner-replenish/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast({ title: 'Settings updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/toner-replenish/settings'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Update failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const machineGroups = groupByMachine(levels?.data ?? []);
  const orderRows = orders?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplet className="h-6 w-6 text-sky-500" />
            Toner Auto-Replenish
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-vendor toner shipped before machines run out. Levels regress over 14 days to
            predict depletion; orders auto-ship under the cost ceiling, else await approval.
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
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="min-h-[48px]"
          >
            {runMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run now
          </Button>
        </div>
      </div>

      {/* Tenant settings panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Replenishment settings</CardTitle>
            <CardDescription>
              Approval threshold + default lead time and safety buffer used in the depletion
              trigger.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSettings ? (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            ) : settings ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(
                  [
                    ['approvalCostThreshold', 'Approval threshold ($)'],
                    ['defaultLeadTimeDays', 'Default lead time (days)'],
                    ['defaultSafetyBufferDays', 'Default safety buffer (days)'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span className="text-sm font-medium">{label}</span>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={settings[key] as number}
                      onBlur={(e) =>
                        updateTenantSettings.mutate({ [key]: parseFloat(e.target.value) || 0 })
                      }
                      className="min-h-[48px]"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-destructive">Failed to load settings.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Machine levels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Machine toner levels</CardTitle>
          <CardDescription>Latest reading per machine + color. Red bars are low.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLevels ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading levels…</p>
          ) : levelsError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load: {(levelsErr as any)?.message || 'Unknown error'}
            </p>
          ) : machineGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No supply levels yet. Click "Run now" to capture readings.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {machineGroups.map((g) => (
                <MachineCard
                  key={g.machineId}
                  group={g}
                  onShipNow={(color) => shipNowMutation.mutate({ machineId: g.machineId, color })}
                  shipNowPending={shipNowMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">Replenishment orders</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {ORDER_STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={orderStatus === s ? 'default' : 'outline'}
                onClick={() => setOrderStatus(s)}
                className="min-h-[40px] capitalize"
              >
                {s.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading orders…</p>
          ) : ordersError ? (
            <p className="text-sm text-destructive py-8 text-center">Failed to load orders.</p>
          ) : orderRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Predicted depletion</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderRows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        {o.serialNumber || o.machineId.slice(0, 8)}
                        {o.isEmergency && (
                          <Badge variant="destructive" className="ml-1 gap-1">
                            <Zap className="h-3 w-3" />
                            Emergency
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{o.color ? (COLOR_LABEL[o.color] ?? o.color) : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(o.status)} className="capitalize">
                          {o.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{money(o.totalCost)}</TableCell>
                      <TableCell>{fmtDate(o.predictedDepletionDate)}</TableCell>
                      <TableCell className="text-xs">
                        {o.trackingNumber ? `${o.carrier ?? ''} ${o.trackingNumber}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {(o.status === 'pending_approval' || o.status === 'auto_ship') && (
                            <>
                              <Button
                                size="sm"
                                className="min-h-[40px]"
                                disabled={orderActionMutation.isPending}
                                onClick={() =>
                                  orderActionMutation.mutate({ id: o.id, action: 'ship' })
                                }
                              >
                                <Truck className="h-4 w-4 mr-1" />
                                {o.status === 'pending_approval' ? 'Approve & ship' : 'Ship'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-[40px]"
                                disabled={orderActionMutation.isPending}
                                onClick={() =>
                                  orderActionMutation.mutate({ id: o.id, action: 'cancel' })
                                }
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-machine card (levels + ship-now + settings popover)
// ---------------------------------------------------------------------------

function MachineCard({
  group,
  onShipNow,
  shipNowPending,
}: {
  group: MachineGroup;
  onShipNow: (color?: string) => void;
  shipNowPending: boolean;
}) {
  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {group.serialNumber || group.machineId.slice(0, 8)}
            </CardTitle>
            <CardDescription>
              {[group.manufacturer, group.modelNumber].filter(Boolean).join(' ') || '—'}
              {group.companyName ? ` · ${group.companyName}` : ''}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="min-h-[40px]"
              disabled={shipNowPending}
              onClick={() => onShipNow(undefined)}
            >
              <Zap className="h-4 w-4 mr-1" />
              Ship now
            </Button>
            <MachineSettingsPopover machineId={group.machineId} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.levels.map((l) => {
          const pct = l.percentRemaining ?? 0;
          const low = pct <= 20;
          return (
            <div key={l.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLOR_HEX[l.color] ?? '#999' }}
                  />
                  {COLOR_LABEL[l.color] ?? l.color}
                  {low && <AlertTriangle className="h-3 w-3 text-destructive" />}
                </span>
                <span className={low ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                  {pct}% · depletes {fmtDate(l.predictedDepletionDate)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    backgroundColor: low ? '#dc2626' : (COLOR_HEX[l.color] ?? '#16a34a'),
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MachineSettingsPopover({ machineId }: { machineId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settingsKey = `/api/toner-replenish/machines/${machineId}/settings`;
  const { data: settings, isLoading } = useQuery<MachineSettings>({ queryKey: [settingsKey] });

  const update = useMutation({
    mutationFn: (body: Partial<MachineSettings>) =>
      apiRequest(settingsKey, { method: 'PUT', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [settingsKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/toner-replenish/levels'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed', description: err?.message || 'Failed', variant: 'destructive' }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="min-h-[40px]" aria-label="Machine settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        {isLoading || !settings ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Auto-ship enabled</span>
              <Switch
                checked={settings.autoShipEnabled}
                onCheckedChange={(checked) => update.mutate({ autoShipEnabled: checked })}
                aria-label="Toggle auto-ship"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Customer-managed (suppress)</span>
              <Switch
                checked={settings.customerManaged}
                onCheckedChange={(checked) => update.mutate({ customerManaged: checked })}
                aria-label="Toggle customer-managed suppression"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Emergency override</span>
              <Switch
                checked={settings.emergencyOverride}
                onCheckedChange={(checked) => update.mutate({ emergencyOverride: checked })}
                aria-label="Toggle emergency override"
              />
            </div>
            <label className="space-y-1 block">
              <span className="text-sm font-medium">Cost ceiling ($)</span>
              <Input
                type="number"
                min={0}
                defaultValue={settings.costCeiling ?? ''}
                placeholder="No ceiling"
                onBlur={(e) =>
                  update.mutate({
                    costCeiling: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                  })
                }
                className="min-h-[48px]"
              />
            </label>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
