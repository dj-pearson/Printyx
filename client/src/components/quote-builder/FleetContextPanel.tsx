/**
 * "Start from the customer's fleet" (COP-B06).
 *
 * Quote Builder has always been catalog-only: its "equipment" means
 * `product_models`, what we sell, and nothing in the quote tree has ever read
 * `equipment`, what the customer runs. So a rep retyped the fleet, the volumes
 * and the current rates the system already held. This panel is the bridge.
 *
 * VOLUMES AND CURRENT COST PER PAGE COME FROM THE COP-B05 ASSESSMENT, not from
 * a second derivation, which is what makes AC4 true: the savings story and the
 * quote cite the same numbers because they are the same numbers. A machine the
 * assessment could not cost shows no rate here rather than a zero, so a quote
 * cannot claim a saving against a rate nobody measured.
 *
 * AND IT WILL NOT SAY "BUYOUT" ABOUT A NUMBER IT DERIVED. `equipment` carries
 * a monthly payment and a lease end date and no buyout column; remaining term
 * times payment is the remaining PAYMENT STREAM, which a lessor's buyout
 * usually exceeds. The deal's recorded `leaseBuyoutExposure` is the quotable
 * figure when a rep has one, and the roll-up says which it is using.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  exposureForMachine,
  fleetContextFromAssessment,
  rollupExposure,
  type FleetMachine,
} from '@shared/fleet-quote';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, Info, Printer } from 'lucide-react';

interface AssessmentMachine {
  equipmentId: string;
  serialNumber: string | null;
  modelName: string | null;
  monthlyBlack: number | null;
  monthlyColor: number | null;
  costPerPage: number | null;
}

interface PreviewResponse {
  customerId: string;
  current: {
    machines: AssessmentMachine[];
    partial: boolean;
    measuredMachines: number;
    totalMachines: number;
  };
  /** equipment.id -> lease facts, for the exposure a line displaces. */
  leaseByEquipment?: Record<
    string,
    { monthlyPayment: string | null; leaseExpiresDate: string | null }
  >;
}

export interface FleetLineOption {
  /** Index in the quote's lineItems array. */
  index: number;
  label: string;
  replacesEquipmentId?: string;
}

const pages = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString());

export function FleetContextPanel({
  businessRecordId,
  recordedBuyout,
  lineOptions,
  onAssign,
}: {
  businessRecordId: string;
  /** deals.lease_buyout_exposure, when the quote was opened from a deal. */
  recordedBuyout?: string | number | null;
  /** The quote's equipment lines, so a machine can be attached to one. */
  lineOptions: FleetLineOption[];
  onAssign: (lineIndex: number, equipmentId: string | undefined) => void;
}) {
  const key = `/api/fleet-assessment/preview?customerId=${businessRecordId}`;
  const preview = useQuery<PreviewResponse>({
    queryKey: [key],
    queryFn: () => apiRequest(key),
    enabled: Boolean(businessRecordId),
    staleTime: 60_000,
  });

  const machines: FleetMachine[] = useMemo(
    () =>
      fleetContextFromAssessment(
        preview.data?.current.machines ?? [],
        new Map(
          Object.entries(preview.data?.leaseByEquipment ?? {}).map(([id, v]) => [
            id,
            { monthlyPayment: v.monthlyPayment, leaseExpiresDate: v.leaseExpiresDate },
          ]),
        ),
      ),
    [preview.data],
  );

  const displacedIds = new Set(
    lineOptions.map((l) => l.replacesEquipmentId).filter(Boolean) as string[],
  );
  const now = new Date();
  const rollup = useMemo(
    () =>
      rollupExposure(
        machines.filter((m) => displacedIds.has(m.equipmentId)),
        recordedBuyout,
        now,
      ),
    // `displacedIds` is derived from lineOptions each render; keying on the
    // sorted ids keeps this stable rather than recomputing on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machines, [...displacedIds].sort().join(','), recordedBuyout],
  );

  if (!businessRecordId) return null;
  if (preview.isLoading) return <Skeleton className="h-48 w-full" />;

  if (preview.isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        type="error"
        title="Could not load this customer's fleet"
        description={
          preview.error instanceof Error
            ? preview.error.message
            : 'The fleet did not load. Nothing here is partial — it simply did not load.'
        }
      />
    );
  }

  if (machines.length === 0) {
    return (
      <EmptyState
        title="No equipment on this account"
        description="Once the account's machines are recorded, this quote can start from them instead of a blank catalog."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Printer className="h-4 w-4" /> Customer&rsquo;s current fleet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Volumes and today&rsquo;s cost per page come from the fleet assessment, so the savings
          story and this quote cite the same numbers. Attach a machine to a line to record what that
          line replaces.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-1.5 pr-3 font-medium">Machine</th>
                <th className="py-1.5 pr-3 font-medium text-right">Black/mo</th>
                <th className="py-1.5 pr-3 font-medium text-right">Color/mo</th>
                <th className="py-1.5 pr-3 font-medium text-right">CPP today</th>
                <th className="py-1.5 pr-3 font-medium">Lease</th>
                <th className="py-1.5 pr-3 font-medium">Replaced by</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => {
                const exposure = exposureForMachine(m, now);
                const assignedTo = lineOptions.find((l) => l.replacesEquipmentId === m.equipmentId);
                return (
                  <tr key={m.equipmentId} className="border-b last:border-0 align-top">
                    <td className="py-1.5 pr-3">
                      <div className="font-medium">{m.modelName ?? 'Unknown model'}</div>
                      <div className="text-xs text-muted-foreground">{m.serialNumber ?? ''}</div>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{pages(m.monthlyBlack)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{pages(m.monthlyColor)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-xs">
                      {m.currentCostPerPage == null ? (
                        <span className="text-muted-foreground">not costed</span>
                      ) : (
                        `$${m.currentCostPerPage.toFixed(4)}`
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-xs">
                      {exposure.remainingMonths == null ? (
                        <span className="text-muted-foreground">no end date</span>
                      ) : exposure.remainingMonths === 0 ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          expired
                        </Badge>
                      ) : (
                        <>
                          {exposure.remainingMonths} mo left
                          {exposure.remainingPayments != null && (
                            <div className="text-muted-foreground">
                              {formatCurrency(exposure.remainingPayments)} remaining payments
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Select
                        value={assignedTo ? String(assignedTo.index) : 'none'}
                        onValueChange={(v) => {
                          // Clear any previous line holding this machine, so one
                          // serial is never displaced by two lines at once.
                          if (assignedTo) onAssign(assignedTo.index, undefined);
                          if (v !== 'none') onAssign(Number(v), m.equipmentId);
                        }}
                      >
                        <SelectTrigger className="h-7 w-[170px] text-xs">
                          <SelectValue placeholder="Not replaced" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not replaced</SelectItem>
                          {lineOptions.map((l) => (
                            <SelectItem key={l.index} value={String(l.index)}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* AC3: the roll-up, before send. */}
        {rollup.machinesDisplaced > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">
                Lease exposure across {rollup.machinesDisplaced} displaced machine
                {rollup.machinesDisplaced === 1 ? '' : 's'}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {rollup.authoritative === 'recorded'
                  ? formatCurrency(rollup.recordedBuyout!)
                  : formatCurrency(rollup.derivedRemainingPayments)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {rollup.authoritative === 'recorded' ? (
                <>
                  The buyout recorded on the deal, which is what the lessor quoted. Remaining
                  payments across these machines add up to{' '}
                  {formatCurrency(rollup.derivedRemainingPayments)}.
                </>
              ) : (
                <>
                  Remaining payments, not a buyout. A lessor&rsquo;s buyout normally exceeds this
                  because it includes a residual. Record the quoted buyout on the deal to replace
                  this figure.
                </>
              )}
            </p>
            {rollup.unknown.length > 0 && (
              <p className="flex items-start gap-2 text-xs text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {rollup.unknown.length} machine{rollup.unknown.length === 1 ? '' : 's'} could not
                  be counted, so this is a floor:{' '}
                  {rollup.unknown
                    .map((u) => `${u.serialNumber ?? u.equipmentId} (${u.reason})`)
                    .join('; ')}
                </span>
              </p>
            )}
          </div>
        )}

        {preview.data?.current.partial && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {preview.data.current.measuredMachines} of {preview.data.current.totalMachines}{' '}
              machines could be costed. The rest show no rate rather than a zero.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
