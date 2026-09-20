/**
 * Fleet assessment / TCO builder (COP-B05).
 *
 * The copier sales motion, done inside the system instead of in a spreadsheet
 * on somebody's laptop. Current fleet from `equipment`, volumes from the meter
 * counters, rates from the account's contract and its tiers - no re-entry of
 * data the system already holds.
 *
 * THE GAPS PANEL IS NOT A FOOTNOTE, IT IS THE FEATURE. This document goes in
 * front of a customer who has their own invoice in front of them. A machine
 * with no meters or no rate is listed by name as uncosted, and a total built
 * over one is labelled a FLOOR - because a saving measured from too low a
 * baseline is a claim the customer can disprove in the meeting.
 *
 * Nothing here computes. Every number comes from the endpoint, which gets them
 * from shared/fleet-assessment.ts, so the screen and the stored snapshot can
 * never disagree.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/export-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, Download, Info, Plus, Printer, Trash2 } from 'lucide-react';

interface MachineLine {
  equipmentId: string;
  serialNumber: string | null;
  modelName: string | null;
  monthlyBlack: number | null;
  monthlyColor: number | null;
  basis: 'meter_delta' | 'copy_columns' | 'none';
  blackRate: number | null;
  colorRate: number | null;
  rateSource: 'tier' | 'contract' | 'mixed' | null;
  monthlyClickCost: number | null;
  costPerPage: number | null;
}

interface CurrentState {
  machines: MachineLine[];
  measuredMachines: number;
  totalMachines: number;
  monthlyBlackVolume: number;
  monthlyColorVolume: number;
  monthlyClickCost: number;
  monthlyBaseCost: number;
  monthlyTotal: number;
  annualTotal: number;
  blendedCostPerPage: number | null;
  gaps: Array<{ equipmentId: string | null; code: string; message: string }>;
  partial: boolean;
  unbacked: string[];
}

interface ProposedState {
  monthlyBase: number;
  monthlyClickCost: number | null;
  monthlyTotal: number | null;
  annualTotal: number | null;
  costPerPage: number | null;
  gaps: Array<{ code: string; message: string }>;
}

interface Comparison {
  monthlyDelta: number | null;
  annualDelta: number | null;
  termDelta: number | null;
  termMonths: number;
  percentChange: number | null;
  currentIsFloor: boolean;
}

interface SavedAssessment {
  id: string;
  name: string | null;
  termMonths: number;
  current: CurrentState;
  proposed: ProposedState | null;
  comparison: Comparison | null;
  createdAt: string | null;
}

interface ProposedRow {
  modelName: string;
  quantity: string;
  monthlyBase: string;
  blackRate: string;
  colorRate: string;
}

const BASIS_LABEL: Record<MachineLine['basis'], string> = {
  meter_delta: 'meters',
  copy_columns: 'copy counts',
  none: 'no volume',
};

const emptyRow = (): ProposedRow => ({
  modelName: '',
  quantity: '1',
  monthlyBase: '',
  blackRate: '',
  colorRate: '',
});

const pages = (value: number | null) => (value == null ? '—' : Math.round(value).toLocaleString());

export function FleetAssessmentPanel({
  dealId,
  companyName,
}: {
  dealId: string;
  companyName?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ProposedRow[]>([emptyRow()]);
  const [termMonths, setTermMonths] = useState('36');

  const previewKey = `/api/fleet-assessment/preview?dealId=${dealId}`;
  const listKey = `/api/fleet-assessment?dealId=${dealId}`;

  const preview = useQuery<{ current: CurrentState; contractId: string | null }>({
    queryKey: [previewKey],
    queryFn: () => apiRequest(previewKey),
    enabled: Boolean(dealId),
  });

  const saved = useQuery<{ data: SavedAssessment[] }>({
    queryKey: [listKey],
    queryFn: () => apiRequest(listKey),
    enabled: Boolean(dealId),
  });

  const save = useMutation({
    mutationFn: () =>
      apiRequest('/api/fleet-assessment', 'POST', {
        dealId,
        termMonths: Number(termMonths) || 36,
        name: companyName ? `${companyName} fleet assessment` : null,
        proposedFleet: rows
          .filter((r) => r.modelName.trim())
          .map((r) => ({
            modelName: r.modelName.trim(),
            quantity: Number(r.quantity) || 0,
            // Empty stays EMPTY, never zero: a blank rate is an unknown rate,
            // and the engine refuses to price a proposal that has one.
            monthlyBase: r.monthlyBase === '' ? null : Number(r.monthlyBase),
            blackRate: r.blackRate === '' ? null : Number(r.blackRate),
            colorRate: r.colorRate === '' ? null : Number(r.colorRate),
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listKey] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/activities`] });
      toast({ title: 'Assessment saved to the deal' });
    },
    onError: (err: unknown) =>
      toast({
        title: 'Could not save the assessment',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const current = preview.data?.current;

  const exportCsv = () => {
    if (!current) return;
    exportToCSV(
      current.machines,
      [
        { key: 'serialNumber', label: 'Serial' },
        { key: 'modelName', label: 'Model' },
        { key: 'monthlyBlack', label: 'Monthly black pages' },
        { key: 'monthlyColor', label: 'Monthly color pages' },
        { key: 'basis', label: 'Volume basis' },
        { key: 'blackRate', label: 'Black rate' },
        { key: 'colorRate', label: 'Color rate' },
        { key: 'rateSource', label: 'Rate source' },
        { key: 'monthlyClickCost', label: 'Monthly click cost' },
        { key: 'costPerPage', label: 'Cost per page' },
      ],
      { filename: `fleet-assessment-${dealId}` },
    );
  };

  if (preview.isLoading) return <Skeleton className="h-64 w-full" />;

  if (preview.isError || !current) {
    return (
      <EmptyState
        icon={AlertTriangle}
        type="error"
        title="Could not assess this fleet"
        description={
          preview.error instanceof Error
            ? preview.error.message
            : 'The assessment did not load. Nothing here is partial — it simply did not load.'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Current state ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">Current fleet</CardTitle>
          <div className="flex gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure
              label={current.partial ? 'Monthly spend (floor)' : 'Monthly spend'}
              value={formatCurrency(current.monthlyTotal)}
            />
            <Figure label="Annual" value={formatCurrency(current.annualTotal)} />
            <Figure
              label="Blended cost per page"
              value={
                current.blendedCostPerPage == null
                  ? '—'
                  : `$${current.blendedCostPerPage.toFixed(4)}`
              }
            />
            <Figure
              label="Machines costed"
              value={`${current.measuredMachines} of ${current.totalMachines}`}
            />
          </div>

          {current.partial && (
            <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                This is a FLOOR, not a total. {current.totalMachines - current.measuredMachines}{' '}
                machine{current.totalMachines - current.measuredMachines === 1 ? '' : 's'} could not
                be costed, so the real spend is higher and any saving measured from it is a ceiling.
              </span>
            </p>
          )}

          {current.machines.length === 0 ? (
            <EmptyState
              title="No equipment on this account"
              description="A fleet assessment needs machines. Attach the account's equipment first."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-1.5 pr-3 font-medium">Machine</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Black/mo</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Color/mo</th>
                    <th className="py-1.5 pr-3 font-medium">Basis</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Rate</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Clicks/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {current.machines.map((m) => (
                    <tr key={m.equipmentId} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <div className="font-medium">{m.modelName ?? 'Unknown model'}</div>
                        <div className="text-xs text-muted-foreground">{m.serialNumber ?? ''}</div>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {pages(m.monthlyBlack)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {pages(m.monthlyColor)}
                      </td>
                      <td className="py-1.5 pr-3">
                        <Badge variant="outline" className="text-xs font-normal">
                          {BASIS_LABEL[m.basis]}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-3 text-right text-xs">
                        {m.blackRate == null ? (
                          <span className="text-muted-foreground">no rate</span>
                        ) : (
                          <>
                            ${m.blackRate.toFixed(4)}
                            {m.rateSource && (
                              <span className="text-muted-foreground"> ({m.rateSource})</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {m.monthlyClickCost == null ? '—' : formatCurrency(m.monthlyClickCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {current.gaps.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium">What could not be costed</p>
              <ul className="mt-1.5 space-y-1">
                {current.gaps.map((g, i) => (
                  <li
                    key={`${g.equipmentId}-${g.code}-${i}`}
                    className="text-xs text-muted-foreground"
                  >
                    {g.equipmentId
                      ? (current.machines.find((m) => m.equipmentId === g.equipmentId)
                          ?.serialNumber ??
                        current.machines.find((m) => m.equipmentId === g.equipmentId)?.modelName ??
                        g.equipmentId)
                      : 'This account'}
                    : {g.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {current.unbacked.map((note, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </p>
          ))}
        </CardContent>
      </Card>

      {/* ── Proposed fleet ──────────────────────────────────────── */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Proposed fleet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Priced against the same volumes, so the comparison is a comparison. A blank rate leaves
            the proposal unpriced rather than free.
          </p>
          {rows.map((row, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-6 items-end">
              <div className="sm:col-span-2">
                <Label className="text-xs">Model</Label>
                <Input
                  className="h-8"
                  value={row.modelName}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (i === j ? { ...r, modelName: e.target.value } : r)))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Qty</Label>
                <Input
                  className="h-8"
                  inputMode="numeric"
                  value={row.quantity}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (i === j ? { ...r, quantity: e.target.value } : r)))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Base/mo</Label>
                <Input
                  className="h-8"
                  inputMode="decimal"
                  value={row.monthlyBase}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) => (i === j ? { ...r, monthlyBase: e.target.value } : r)),
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Black rate</Label>
                <Input
                  className="h-8"
                  inputMode="decimal"
                  value={row.blackRate}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (i === j ? { ...r, blackRate: e.target.value } : r)))
                  }
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Color rate</Label>
                  <Input
                    className="h-8"
                    inputMode="decimal"
                    value={row.colorRate}
                    onChange={(e) =>
                      setRows(
                        rows.map((r, j) => (i === j ? { ...r, colorRate: e.target.value } : r)),
                      )
                    }
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove this proposed machine"
                  className="mb-0.5"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRows([...rows, emptyRow()])}>
              <Plus className="h-4 w-4 mr-1" /> Add machine
            </Button>
            <div>
              <Label htmlFor="term-months" className="text-xs">
                Term (months)
              </Label>
              <Input
                id="term-months"
                className="h-8 w-24"
                inputMode="numeric"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
              />
            </div>
            <div className="flex-1" />
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              Save assessment to the deal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Saved snapshots ─────────────────────────────────────── */}
      {(saved.data?.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Saved assessments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(saved.data?.data ?? []).map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{a.name ?? 'Fleet assessment'}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Figure label="Current" value={formatCurrency(a.current.monthlyTotal)} />
                  <Figure
                    label="Proposed"
                    value={
                      a.proposed?.monthlyTotal == null
                        ? 'not priced'
                        : formatCurrency(a.proposed.monthlyTotal)
                    }
                  />
                  <Figure
                    label={`Delta over ${a.comparison?.termMonths ?? a.termMonths} months`}
                    value={
                      a.comparison?.termDelta == null ? '—' : formatCurrency(a.comparison.termDelta)
                    }
                  />
                </div>
                {a.comparison?.currentIsFloor && (
                  <p className="mt-2 text-xs text-amber-800">
                    The current-state figure in this snapshot is a floor, so the delta is a ceiling.
                  </p>
                )}
                {(a.proposed?.gaps ?? []).map((g, i) => (
                  <p key={i} className="mt-1 text-xs text-muted-foreground">
                    {g.message}
                  </p>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
