/**
 * A customer's installed equipment and its service history (round 224).
 *
 * This dialog opens from a ticket on ServiceHub and used to ignore the
 * customerId it was handed: every customer showed the same two invented
 * machines (a Canon C5540i and an HP E87660) with invented technicians,
 * repair costs, maintenance schedules, alerts and utilisation figures, plus a
 * "Schedule" button with no handler. ServiceHub even passed the literal
 * 'default-customer' for a ticket with no customer.
 *
 * It now reads GET /api/customers/:id/equipment (camelCased equipment rows)
 * and, for the machine selected, GET /api/equipment/:id/service-history (the
 * shared/service-history.ts entries both hosts answer). The maintenance,
 * alerts and analytics tabs had no data behind them and are gone.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { clickableProps } from '@/lib/accessibility';
import type { ServiceHistoryEntry } from '@shared/service-history';

export interface EquipmentRow {
  id: string;
  manufacturer?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  equipmentStatus?: string | null;
  locationDescription?: string | null;
  installDate?: string | null;
  warrantyExpiresDate?: string | null;
  leaseExpiresDate?: string | null;
  lastServiceDate?: string | null;
  nextServiceDueDate?: string | null;
}

interface CustomerEquipmentProfileProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const day = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
};

export function machineLabel(e: EquipmentRow): string {
  return [e.manufacturer, e.modelNumber].filter(Boolean).join(' ') || 'Unnamed machine';
}

/** Warranty state from the stored expiry; no date is unknown, not expired. */
export function warrantyState(
  expires: string | null | undefined,
  now: Date = new Date(),
): 'active' | 'expired' | 'unknown' {
  if (!expires) return 'unknown';
  const t = new Date(expires).getTime();
  if (Number.isNaN(t)) return 'unknown';
  return t >= now.getTime() ? 'active' : 'expired';
}

function ServiceHistory({ equipmentId }: { equipmentId: string }) {
  const q = useQuery<ServiceHistoryEntry[]>({
    queryKey: [`/api/equipment/${equipmentId}/service-history`],
  });
  if (q.isError) return <InlineQueryError label="service history" onRetry={() => q.refetch()} />;
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading history...</p>;
  const rows = q.data ?? [];
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No service tickets on this machine.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((h) => (
        <li key={h.id} className="border rounded-md p-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-medium">
              {h.ticketNumber ? `${h.ticketNumber} · ` : ''}
              {h.title ?? 'Service ticket'}
            </span>
            <Badge variant={h.isOpen ? 'default' : 'outline'}>{h.status ?? 'unknown'}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {h.isOpen ? 'Raised' : 'Resolved'} {day(h.date) ?? 'on an unrecorded date'}
          </p>
          {h.resolutionNotes && <p className="mt-1">{h.resolutionNotes}</p>}
        </li>
      ))}
    </ul>
  );
}

export function CustomerEquipmentProfile({
  customerId,
  isOpen,
  onClose,
}: CustomerEquipmentProfileProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const equipmentQuery = useQuery<EquipmentRow[]>({
    queryKey: [`/api/customers/${customerId}/equipment`],
    enabled: isOpen && !!customerId,
  });
  const equipment = equipmentQuery.data ?? [];
  const current = equipment.find((e) => e.id === selected) ?? equipment[0] ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer equipment</DialogTitle>
        </DialogHeader>

        {!customerId ? (
          <p className="text-sm text-muted-foreground">
            This ticket is not linked to a customer, so there is no equipment to show.
          </p>
        ) : equipmentQuery.isError ? (
          <InlineQueryError
            label="this customer's equipment"
            onRetry={() => equipmentQuery.refetch()}
          />
        ) : equipmentQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading equipment...</p>
        ) : equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment recorded for this customer.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ul className="space-y-2">
              {equipment.map((e) => (
                <li
                  key={e.id}
                  className={`border rounded-md p-3 cursor-pointer text-sm ${
                    current?.id === e.id ? 'border-primary bg-muted' : ''
                  }`}
                  {...clickableProps(() => setSelected(e.id))}
                >
                  <p className="font-medium">{machineLabel(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.serialNumber ? `S/N ${e.serialNumber}` : 'No serial recorded'}
                  </p>
                </li>
              ))}
            </ul>

            {current && (
              <div className="md:col-span-2 space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Status', current.equipmentStatus],
                    ['Location', current.locationDescription],
                    ['Asset tag', current.assetTag],
                    ['Installed', day(current.installDate)],
                    ['Last service', day(current.lastServiceDate)],
                    ['Next service due', day(current.nextServiceDueDate)],
                    ['Lease ends', day(current.leaseExpiresDate)],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value || 'Not recorded'}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-muted-foreground">Warranty</dt>
                    <dd className="font-medium">
                      {
                        {
                          active: `Active until ${day(current.warrantyExpiresDate)}`,
                          expired: `Expired ${day(current.warrantyExpiresDate)}`,
                          unknown: 'Not recorded',
                        }[warrantyState(current.warrantyExpiresDate)]
                      }
                    </dd>
                  </div>
                </dl>
                <div>
                  <h4 className="font-medium mb-2">Service history</h4>
                  <ServiceHistory equipmentId={current.id} />
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
