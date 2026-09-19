/**
 * Place an approved purchase order with the manufacturer (WF-P-06).
 *
 * supabase/functions/manufacturer-orders is 1,584 lines over six real tables
 * and had no caller in any client tree. This is the caller. The dialog picks a
 * manufacturer connection - creating one inline, because a tenant that has
 * never used the feature has none and sending them elsewhere to make one would
 * put a dead end in the middle of a workflow - and posts the PO.
 *
 * It says plainly that nothing is transmitted. The edge function records the
 * order against the connection and its /submit branch persists the submission
 * intent without dispatching; a button labelled "Place order" that quietly does
 * not send is the failure this repo keeps finding, so the dialog and the
 * response both name it.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ManufacturerConnection {
  id: string;
  manufacturer_name?: string | null;
  manufacturerName?: string | null;
  manufacturer_type?: string | null;
  manufacturerType?: string | null;
  order_method?: string | null;
  orderMethod?: string | null;
}

interface PlaceManufacturerOrderDialogProps {
  purchaseOrder: { id: string; poNumber?: string | null } | null;
  onOpenChange: (open: boolean) => void;
}

/** The pgEnum on manufacturer_orders.order_method. */
const ORDER_METHODS = ['manual', 'portal', 'email', 'edi', 'api'] as const;

const nameOf = (c: ManufacturerConnection) =>
  c.manufacturerName ?? c.manufacturer_name ?? 'Unnamed manufacturer';

export function PlaceManufacturerOrderDialog({
  purchaseOrder,
  onOpenChange,
}: PlaceManufacturerOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState('');
  const [orderMethod, setOrderMethod] = useState<string>('manual');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');

  const open = Boolean(purchaseOrder);

  const { data: connections = [], isLoading: connectionsLoading } = useQuery<
    ManufacturerConnection[]
  >({
    queryKey: ['/api/manufacturer-orders/connections'],
    queryFn: async () =>
      extractRecords<ManufacturerConnection>(
        await apiRequest('/api/manufacturer-orders/connections', 'GET'),
      ),
    enabled: open,
  });

  const createConnection = useMutation({
    mutationFn: async () =>
      apiRequest('/api/manufacturer-orders/connections', 'POST', {
        manufacturerName: newName.trim(),
        // manufacturer_type is NOT NULL and is the manufacturer's own key in
        // this schema; the name is used when nothing more specific is known.
        manufacturerType: (newType.trim() || newName.trim()).toLowerCase(),
        orderMethod,
      }),
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturer-orders/connections'] });
      if (created?.id) setConnectionId(created.id);
      setNewName('');
      setNewType('');
      toast({ title: 'Manufacturer added' });
    },
    onError: (error: any) =>
      toast({
        title: 'Could not add the manufacturer',
        description: error?.message || 'The connection was not created.',
        variant: 'destructive',
      }),
  });

  const place = useMutation({
    mutationFn: async () =>
      apiRequest('/api/manufacturer-orders/from-purchase-order', 'POST', {
        purchaseOrderId: purchaseOrder!.id,
        connectionId,
        orderMethod,
      }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders/stats/summary'] });
      // The response's own warnings are shown rather than a generic success:
      // unfulfillable lines and the un-transmitted state are both things the
      // buyer has to know before they walk away from the screen.
      const warnings: string[] = Array.isArray(result?.warnings) ? result.warnings : [];
      toast({
        title: `Order recorded (${result?.lineCount ?? 0} lines)`,
        description: warnings.join(' '),
      });
      onOpenChange(false);
    },
    onError: (error: any) =>
      toast({
        title: 'Could not place the order',
        description: error?.message || 'Nothing was recorded.',
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Place {purchaseOrder?.poNumber || 'this order'}</DialogTitle>
          <DialogDescription>
            The purchase order and its lines are recorded as a manufacturer order and the PO moves
            to Ordered. Nothing is transmitted to the manufacturer: send it by your usual portal or
            email, then record the confirmation here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="mfr-connection">
              Manufacturer
            </label>
            {connectionsLoading ? (
              <p className="text-sm text-muted-foreground">Loading manufacturers...</p>
            ) : connections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No manufacturers configured yet. Add one below.
              </p>
            ) : (
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger id="mfr-connection" aria-label="Manufacturer">
                  <SelectValue placeholder="Choose a manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {nameOf(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="mfr-method">
              How it will be sent
            </label>
            <Select value={orderMethod} onValueChange={setOrderMethod}>
              <SelectTrigger id="mfr-method" aria-label="Order method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Add a manufacturer</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name, e.g. Canon USA"
              aria-label="Manufacturer name"
            />
            <Input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Key (optional), e.g. canon"
              aria-label="Manufacturer key"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!newName.trim() || createConnection.isPending}
              onClick={() => createConnection.mutate()}
            >
              {createConnection.isPending ? 'Adding...' : 'Add'}
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!connectionId || place.isPending} onClick={() => place.mutate()}>
              {place.isPending ? 'Recording...' : 'Place order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
