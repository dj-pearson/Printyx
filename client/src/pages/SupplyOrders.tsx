import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { format, formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, Package, ShoppingCart, X } from 'lucide-react';

interface SupplyOrder {
  id: string;
  customerId?: string | null;
  deviceId: string;
  alertId?: string | null;
  supplyType: string;
  productSku?: string;
  productName?: string;
  quantity: number;
  unitPrice?: string;
  totalPrice?: string;
  status: 'pending' | 'approved' | 'ordered' | 'shipped' | 'delivered' | 'cancelled';
  triggeredBy: 'auto' | 'manual' | 'forecast';
  createdAt: string;
  approvedAt?: string | null;
  orderedAt?: string | null;
  cancelledAt?: string | null;
  notes?: string;
  device: {
    serialNumber: string | null;
    deviceName: string | null;
    manufacturer: string | null;
    model: string | null;
  };
}

const STATUS_BADGE: Record<SupplyOrder['status'], { className: string; label: string }> = {
  pending: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
  approved: { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Approved' },
  ordered: { className: 'bg-indigo-100 text-indigo-800 border-indigo-200', label: 'Ordered' },
  shipped: { className: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Shipped' },
  delivered: { className: 'bg-green-100 text-green-800 border-green-200', label: 'Delivered' },
  cancelled: { className: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Cancelled' },
};

export default function SupplyOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'open' | 'closed'>('all');

  const params = new URLSearchParams();
  if (statusFilter === 'pending') params.set('status', 'pending');
  if (statusFilter === 'open') params.set('status', 'pending,approved,ordered,shipped');
  if (statusFilter === 'closed') params.set('status', 'delivered,cancelled');

  const { data, isLoading } = useQuery<{ orders: SupplyOrder[] }>({
    queryKey: ['/api/device-monitoring/supply-orders', statusFilter],
    queryFn: async () => {
      const res = await fetch(
        `/api/device-monitoring/supply-orders${params.toString() ? '?' + params : ''}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to fetch supply orders');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const orderActionMutation = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: string; action: 'approve' | 'cancel' }) => {
      const res = await fetch(`/api/device-monitoring/supply-orders/${orderId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to ${action} order`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: 'Order updated',
        description: vars.action === 'approve' ? 'Approved' : 'Cancelled',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/device-monitoring/supply-orders'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not update order',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const orders = data?.orders || [];
  const counts = {
    pending: orders.filter((o) => o.status === 'pending').length,
    approved: orders.filter((o) => o.status === 'approved').length,
    inFlight: orders.filter((o) => ['ordered', 'shipped'].includes(o.status)).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Supply Orders</h1>
          <p className="text-gray-500 mt-1">
            Auto-orders fired by critical toner alerts plus any manual orders. Approve a pending
            order to send it to fulfilment.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All orders</SelectItem>
            <SelectItem value="pending">Pending only</SelectItem>
            <SelectItem value="open">Open (pending + in flight)</SelectItem>
            <SelectItem value="closed">Closed (delivered + cancelled)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending approval</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{counts.pending}</div>
            <p className="text-xs text-gray-500 mt-1">Need your eyeball</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{counts.approved}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to send to fulfilment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In flight</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{counts.inFlight}</div>
            <p className="text-xs text-gray-500 mt-1">Ordered or shipped</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            Sorted newest first. Auto-orders carry a badge so it's clear they came from an agent
            alert rather than an operator click.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No orders yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Auto-orders fire when a critical toner alert appears on a device whose monitoring
                client has <code>autoOrderEnabled: true</code> in its config.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Supply</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const badge = STATUS_BADGE[o.status];
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        <div>{o.device.deviceName || o.device.serialNumber || o.deviceId}</div>
                        <div className="text-xs text-gray-500">
                          {[o.device.manufacturer, o.device.model].filter(Boolean).join(' ')}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{o.supplyType}</TableCell>
                      <TableCell>
                        <div className="text-sm">{o.productName || '—'}</div>
                        <div className="text-xs text-gray-500 font-mono">{o.productSku}</div>
                      </TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell>{o.totalPrice ? `$${o.totalPrice}` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {o.triggeredBy}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{format(new Date(o.createdAt), 'MMM d')}</div>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {o.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                orderActionMutation.mutate({ orderId: o.id, action: 'approve' })
                              }
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                          )}
                          {!['delivered', 'cancelled', 'shipped'].includes(o.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                orderActionMutation.mutate({ orderId: o.id, action: 'cancel' })
                              }
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
