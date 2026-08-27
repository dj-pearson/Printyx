/**
 * DealEquipmentPanel (COP-M05)
 *
 * The installed-base section of the deal record: which serials this deal
 * REPLACES (machines going out, whose buyout and current volume price the deal)
 * and which it PLACES (machines going in).
 *
 * Links are crm_associations rows with an explicit relation, not a bespoke join
 * table, so they survive the lead -> customer lifecycle like every other
 * association. The API joins the rep-facing equipment fields server-side; this
 * panel makes one request for the list rather than one per serial.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Plus, Unlink, Search } from 'lucide-react';
import { format } from 'date-fns';

import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Matches DEAL_EQUIPMENT_RELATIONS in shared/crm-associations-schema.ts. */
const RELATIONS = [
  { value: 'replaces', label: 'Replaces', hint: 'Machine going out' },
  { value: 'places', label: 'Places', hint: 'Machine going in' },
] as const;

type Relation = (typeof RELATIONS)[number]['value'];

/** Deal columns the attach can fill in, named the way a rep would say them. */
const DERIVED_LABELS: Record<string, string> = {
  lease_buyout_exposure: 'lease buyout exposure',
  replaces_contract_id: 'the contract it replaces',
  current_monthly_volume_bw: 'current B/W volume',
  current_monthly_volume_color: 'current color volume',
};

/** One row of GET /api/deals/:id/equipment — the association plus the machine. */
interface DealEquipment {
  associationId: string;
  relation: string;
  linkedAt?: string | null;
  equipmentId: string;
  serialNumber?: string | null;
  modelNumber?: string | null;
  manufacturer?: string | null;
  description?: string | null;
  meterType?: string | null;
  isColorCapable?: boolean | null;
  equipmentStatus?: string | null;
  locationDescription?: string | null;
  installDate?: string | null;
  leaseExpiresDate?: string | null;
  monthlyPayment?: string | null;
  serviceContractNumber?: string | null;
  customerId?: string | null;
  currentMonthlyVolumeBw?: number | null;
  currentMonthlyVolumeColor?: number | null;
  latestMeterDate?: string | null;
  contractId?: string | null;
  contractBlackRate?: string | null;
  contractColorRate?: string | null;
}

/** Contract rates are numeric(10,4); rounding them to cents misstates a CPC. */
function cpc(value?: string | null): string | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * A row from GET /api/equipment. Express returns a bare array of camelCase
 * Drizzle rows and the edge function returns { data } of snake_case PostgREST
 * rows, so both spellings are read. Do not "simplify" this to one casing.
 */
interface EquipmentOption {
  id: string;
  serialNumber?: string | null;
  serial_number?: string | null;
  modelNumber?: string | null;
  model_number?: string | null;
  manufacturer?: string | null;
  locationDescription?: string | null;
  location_description?: string | null;
}

const serialOf = (e: EquipmentOption) => e.serialNumber ?? e.serial_number ?? null;
const modelOf = (e: EquipmentOption) => e.modelNumber ?? e.model_number ?? null;
const locationOf = (e: EquipmentOption) => e.locationDescription ?? e.location_description ?? null;

function machineLabel(e: { serialNumber?: string | null; modelNumber?: string | null }) {
  return e.serialNumber || e.modelNumber || 'Unidentified machine';
}

export function DealEquipmentPanel({
  dealId,
  customerId,
}: {
  dealId?: string;
  customerId?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [relation, setRelation] = useState<Relation>('replaces');

  const listKey = [`/api/deals/${dealId}/equipment`];

  const { data, isLoading, isError, refetch } = useQuery<{ data: DealEquipment[] }>({
    queryKey: listKey,
    queryFn: () => apiRequest(`/api/deals/${dealId}/equipment`),
    enabled: !!dealId,
  });

  const linked = useMemo(() => extractRecords<DealEquipment>(data), [data]);

  const grouped = useMemo(() => {
    const out: Record<string, DealEquipment[]> = { replaces: [], places: [] };
    for (const item of linked) {
      (out[item.relation] ??= []).push(item);
    }
    return out;
  }, [linked]);

  // The account's installed base. Scoped to the deal's customer when there is
  // one; the search box is the way in when there is not, so the picker is never
  // a dead end.
  const { data: fleet, isLoading: fleetLoading } = useQuery({
    queryKey: ['/api/equipment', { customerId, search }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (customerId) params.set('customerId', customerId);
      if (search) params.set('search', search);
      return apiRequest(`/api/equipment?${params}`);
    },
    enabled: pickerOpen,
  });

  const options = useMemo(() => {
    const rows = extractRecords<EquipmentOption>(fleet);
    const alreadyLinked = new Set(linked.map((l) => l.equipmentId));
    return rows.filter((r) => !alreadyLinked.has(r.id));
  }, [fleet, linked]);

  const attach = useMutation({
    mutationFn: (equipmentId: string) =>
      apiRequest(`/api/deals/${dealId}/equipment`, 'POST', { equipmentId, relation }),
    onSuccess: (result: { derived?: Record<string, unknown> }) => {
      queryClient.invalidateQueries({ queryKey: listKey });
      // COP-M05 AC5: attaching a machine it 'replaces' fills the blank copier
      // fields on the deal, so the record card behind this panel is now stale.
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      setPickerOpen(false);
      setSearch('');
      // Say what the attach wrote. Fields changing on their own, unannounced, is
      // how a rep stops trusting the numbers.
      const filled = Object.keys(result?.derived ?? {})
        .map((key) => DERIVED_LABELS[key] ?? key)
        .filter(Boolean);
      toast({
        title: 'Equipment attached',
        description: filled.length ? `Filled in ${filled.join(', ')} from the machine.` : undefined,
      });
    },
    onError: (error: unknown) =>
      toast({
        title: 'Could not attach equipment',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      }),
  });

  const detach = useMutation({
    mutationFn: (item: DealEquipment) =>
      apiRequest(
        `/api/deals/${dealId}/equipment/${item.equipmentId}?relation=${item.relation}`,
        'DELETE',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({ title: 'Equipment detached' });
    },
    onError: () => toast({ title: 'Could not detach equipment', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">Equipment on this deal</CardTitle>
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8" disabled={!dealId}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Attach
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Attach equipment</DialogTitle>
              <DialogDescription>
                {customerId
                  ? "Showing this account's installed base. Search to look wider."
                  : 'This deal has no account yet, so search the fleet by serial or model.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Select value={relation} onValueChange={(v) => setRelation(v as Relation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label} — {r.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  aria-label="Search equipment"
                  placeholder="Serial, model or manufacturer"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1">
                {fleetLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)
                ) : options.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No machines to attach.
                  </p>
                ) : (
                  options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => attach.mutate(option.id)}
                      disabled={attach.isPending}
                      className="w-full text-left rounded-md px-3 py-2 hover:bg-muted disabled:opacity-50"
                    >
                      <p className="text-sm font-medium">
                        {serialOf(option) || modelOf(option) || 'Unidentified machine'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[option.manufacturer, modelOf(option), locationOf(option)]
                          .filter(Boolean)
                          .join(' · ') || 'No model or location recorded'}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={Printer}
            title="Could not load equipment"
            description="The deal's installed-base links could not be fetched."
            action={{ label: 'Try again', onClick: () => refetch(), variant: 'outline' }}
            type="error"
          />
        ) : linked.length === 0 ? (
          <EmptyState
            icon={Printer}
            title="No machines linked"
            description="Attach the serials this deal replaces and the ones it places, so the fleet it is actually about is on the record."
          />
        ) : (
          <div className="space-y-4">
            {RELATIONS.map((r) =>
              (grouped[r.value] ?? []).length === 0 ? null : (
                <div key={r.value}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {r.label} · {r.hint}
                  </p>
                  <ul className="space-y-2">
                    {(grouped[r.value] ?? []).map((item) => (
                      <li
                        key={item.associationId}
                        className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium break-words">{machineLabel(item)}</p>
                            {item.equipmentStatus && (
                              <Badge variant="outline" className="text-[10px]">
                                {item.equipmentStatus}
                              </Badge>
                            )}
                            {item.isColorCapable && (
                              <Badge variant="secondary" className="text-[10px]">
                                Color
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground break-words">
                            {[item.manufacturer, item.modelNumber, item.locationDescription]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              item.installDate
                                ? `Installed ${format(new Date(item.installDate), 'PP')}`
                                : null,
                              item.leaseExpiresDate
                                ? `Lease ends ${format(new Date(item.leaseExpiresDate), 'PP')}`
                                : null,
                              item.meterType ? `Meter ${item.meterType}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {/* Current meters and contract rates: the two numbers
                              that decide what this machine is worth replacing.
                              Absent when the meter history cannot answer, rather
                              than shown as a zero. */}
                          {(item.currentMonthlyVolumeBw != null ||
                            item.currentMonthlyVolumeColor != null ||
                            item.contractBlackRate ||
                            item.contractColorRate) && (
                            <p className="text-xs text-muted-foreground">
                              {[
                                item.currentMonthlyVolumeBw != null
                                  ? `${item.currentMonthlyVolumeBw.toLocaleString()} B/W pages/mo`
                                  : null,
                                item.currentMonthlyVolumeColor != null
                                  ? `${item.currentMonthlyVolumeColor.toLocaleString()} color pages/mo`
                                  : null,
                                cpc(item.contractBlackRate)
                                  ? `${cpc(item.contractBlackRate)} B/W CPC`
                                  : null,
                                cpc(item.contractColorRate)
                                  ? `${cpc(item.contractColorRate)} color CPC`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0"
                          disabled={detach.isPending}
                          onClick={() => detach.mutate(item)}
                        >
                          <Unlink className="h-3.5 w-3.5 mr-1.5" /> Detach
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
