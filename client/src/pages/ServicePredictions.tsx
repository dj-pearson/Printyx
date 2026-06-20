/**
 * Service Predictions (US-SUPER-001).
 *
 * Lists predictive-failure agent predictions sorted by confidence × contract
 * value, with a per-signal breakdown and suggested parts. Operators can
 * approve-&-dispatch, snooze, or dismiss each prediction. A settings control
 * exposes the per-tenant kill switch and confidence threshold.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
import { AlertTriangle, CheckCircle2, Clock, Play, RefreshCw, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SignalContribution {
  value: number;
  weight: number;
  detail?: string;
}

interface PredictionSignals {
  meter_accel: SignalContribution;
  error_freq: SignalContribution;
  days_since_service: SignalContribution;
  model_age: SignalContribution;
  toner_anomaly: SignalContribution;
  suggested_parts: string[];
}

interface Prediction {
  id: string;
  machineId: string;
  confidence: number;
  contractValue: number | null;
  signals: PredictionSignals | null;
  serviceTicketId: string | null;
  status: string;
  outcome: string | null;
  predictedWindowStart: string | null;
  predictedWindowEnd: string | null;
  snoozedUntil: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  generatedAt: string | null;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  location: string | null;
  priorityScore: number;
  suggestedParts: string[];
}

interface Settings {
  tenantId: string;
  agentEnabled: boolean;
  confidenceThreshold: number;
  pausedAt: string | null;
  pausedReason: string | null;
  updatedAt: string;
}

interface AccuracyResponse {
  perModel: Array<{
    model: string;
    predictions: number;
    truePositives: number;
    falsePositives: number;
    precision: number;
    recall: number;
  }>;
  overall: { predictions: number; truePositives: number; precision: number };
}

const SIGNAL_LABELS: Record<keyof Omit<PredictionSignals, 'suggested_parts'>, string> = {
  meter_accel: 'Meter acceleration',
  error_freq: 'Error/ticket frequency',
  days_since_service: 'Days since service',
  model_age: 'Model age',
  toner_anomaly: 'Toner anomaly',
};

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'snoozed', 'dismissed', 'expired'];

function pct(n: number | null | undefined): string {
  return `${Math.round((n ?? 0) * 100)}%`;
}

function money(n: number | null | undefined): string {
  return `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function confidenceVariant(c: number): 'default' | 'secondary' | 'destructive' {
  if (c >= 0.85) return 'destructive';
  if (c >= 0.7) return 'default';
  return 'secondary';
}

export default function ServicePredictions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const predictionsKey =
    statusFilter === 'all'
      ? '/api/predictive-failure/predictions'
      : `/api/predictive-failure/predictions?status=${statusFilter}`;

  const {
    data: predictionsData,
    isLoading: loadingPredictions,
    isError: predictionsError,
    error: predictionsErrorObj,
  } = useQuery<{ data: Prediction[]; total: number }>({
    queryKey: [predictionsKey],
  });

  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: ['/api/predictive-failure/settings'],
  });

  const { data: accuracy } = useQuery<AccuracyResponse>({
    queryKey: ['/api/predictive-failure/accuracy'],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [predictionsKey] });
    queryClient.invalidateQueries({ queryKey: ['/api/predictive-failure/accuracy'] });
  };

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest('/api/predictive-failure/score', { method: 'POST' }),
    onSuccess: (data: any) => {
      if (data?.skipped) {
        toast({
          title: 'Scoring skipped',
          description: 'The predictive-failure agent is paused (kill switch).',
        });
      } else {
        toast({
          title: 'Scoring complete',
          description: `Scored ${data?.scored ?? 0} machines, created ${data?.created ?? 0} draft tickets.`,
        });
      }
      invalidateAll();
    },
    onError: (err: any) =>
      toast({
        title: 'Scoring failed',
        description: err?.message || 'Failed to run scoring',
        variant: 'destructive',
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/predictive-failure/predictions/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Approved & dispatched', description: 'Linked draft ticket dispatched.' });
      invalidateAll();
    },
    onError: (err: any) =>
      toast({
        title: 'Approve failed',
        description: err?.message || 'Failed to approve',
        variant: 'destructive',
      }),
  });

  const snoozeMutation = useMutation({
    mutationFn: (id: string) => {
      const until = new Date(Date.now() + 7 * 86_400_000).toISOString();
      return apiRequest(`/api/predictive-failure/predictions/${id}/snooze`, {
        method: 'POST',
        body: { until },
      });
    },
    onSuccess: () => {
      toast({ title: 'Snoozed', description: 'Prediction snoozed for 7 days.' });
      invalidateAll();
    },
    onError: (err: any) =>
      toast({
        title: 'Snooze failed',
        description: err?.message || 'Failed to snooze',
        variant: 'destructive',
      }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/predictive-failure/predictions/${id}/dismiss`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Dismissed', description: 'Prediction dismissed.' });
      invalidateAll();
    },
    onError: (err: any) =>
      toast({
        title: 'Dismiss failed',
        description: err?.message || 'Failed to dismiss',
        variant: 'destructive',
      }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (body: { agentEnabled?: boolean; confidenceThreshold?: number }) =>
      apiRequest('/api/predictive-failure/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast({ title: 'Settings updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-failure/settings'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Settings update failed',
        description: err?.message || 'Failed to update settings',
        variant: 'destructive',
      }),
  });

  const predictions = predictionsData?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Predictive Failure Dispatch
          </h1>
          <p className="text-sm text-muted-foreground">
            Interpretable risk scoring for the MFP fleet, sorted by confidence × contract value.
          </p>
        </div>
        <Button
          onClick={() => scoreMutation.mutate()}
          disabled={scoreMutation.isPending}
          className="min-h-[48px]"
        >
          {scoreMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run scoring
        </Button>
      </div>

      {/* Settings: kill switch + threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agent settings</CardTitle>
          <CardDescription>Per-tenant kill switch and auto-dispatch threshold.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <p className="text-sm text-muted-foreground">Loading settings…</p>
          ) : settings ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
              <div className="flex items-center gap-3">
                <Switch
                  checked={settings.agentEnabled}
                  onCheckedChange={(checked) =>
                    updateSettingsMutation.mutate({ agentEnabled: checked })
                  }
                  disabled={updateSettingsMutation.isPending}
                  aria-label="Toggle predictive-failure agent"
                />
                <span className="text-sm font-medium">
                  Agent {settings.agentEnabled ? 'enabled' : 'paused'}
                </span>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Confidence threshold</span>
                  <span className="text-muted-foreground">{pct(settings.confidenceThreshold)}</span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[settings.confidenceThreshold]}
                  onValueCommit={(vals) =>
                    updateSettingsMutation.mutate({ confidenceThreshold: vals[0] })
                  }
                  aria-label="Confidence threshold"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">Failed to load settings.</p>
          )}
        </CardContent>
      </Card>

      {/* Accuracy summary */}
      {accuracy && accuracy.overall.predictions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accuracy (precision/recall)</CardTitle>
            <CardDescription>
              Overall precision {pct(accuracy.overall.precision)} across{' '}
              {accuracy.overall.predictions} predictions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Predictions</TableHead>
                    <TableHead className="text-right">True positives</TableHead>
                    <TableHead className="text-right">Precision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accuracy.perModel.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell>{m.model}</TableCell>
                      <TableCell className="text-right">{m.predictions}</TableCell>
                      <TableCell className="text-right">{m.truePositives}</TableCell>
                      <TableCell className="text-right">{pct(m.precision)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Predictions list */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Predictions</CardTitle>
            <CardDescription>
              Sorted by confidence × contract value (highest first).
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] min-h-[48px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loadingPredictions ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading predictions…</p>
          ) : predictionsError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load predictions: {(predictionsErrorObj as any)?.message || 'Unknown error'}
            </p>
          ) : predictions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No predictions yet. Run scoring to generate risk predictions for your fleet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Contract value</TableHead>
                    <TableHead>Suggested parts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((p) => {
                    const isExpanded = expandedId === p.id;
                    const actionable = p.status === 'pending' || p.status === 'snoozed';
                    return (
                      <>
                        <TableRow
                          key={p.id}
                          className="cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        >
                          <TableCell>
                            <div className="font-medium">{p.serialNumber || p.machineId}</div>
                            <div className="text-xs text-muted-foreground">
                              {[p.manufacturer, p.model].filter(Boolean).join(' ') || '—'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={confidenceVariant(p.confidence)}>
                              {pct(p.confidence)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{money(p.contractValue)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.suggestedParts.length ? (
                                p.suggestedParts.map((part) => (
                                  <Badge key={part} variant="outline" className="text-xs">
                                    {part}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">none</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2 flex-wrap">
                              <Button
                                size="sm"
                                className="min-h-[48px]"
                                disabled={!actionable || approveMutation.isPending}
                                onClick={() => approveMutation.mutate(p.id)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-[48px]"
                                disabled={!actionable || snoozeMutation.isPending}
                                onClick={() => snoozeMutation.mutate(p.id)}
                              >
                                <Clock className="h-4 w-4 mr-1" />
                                Snooze
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="min-h-[48px]"
                                disabled={!actionable || dismissMutation.isPending}
                                onClick={() => dismissMutation.mutate(p.id)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Dismiss
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && p.signals && (
                          <TableRow key={`${p.id}-detail`}>
                            <TableCell colSpan={6} className="bg-muted/40">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-2">
                                {(
                                  Object.keys(SIGNAL_LABELS) as Array<keyof typeof SIGNAL_LABELS>
                                ).map((key) => {
                                  const sig = p.signals![key];
                                  return (
                                    <div key={key} className="text-sm">
                                      <div className="flex justify-between">
                                        <span className="font-medium">{SIGNAL_LABELS[key]}</span>
                                        <span className="text-muted-foreground">
                                          {pct(sig.value)} · w{sig.weight}
                                        </span>
                                      </div>
                                      {sig.detail && (
                                        <div className="text-xs text-muted-foreground">
                                          {sig.detail}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
