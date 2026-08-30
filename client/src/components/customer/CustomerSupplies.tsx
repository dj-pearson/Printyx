import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Search,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Truck,
  BarChart3,
  FileText,
  Settings,
  DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';

interface Supply {
  id: string;
  productCode: string;
  productName: string;
  productType: string;
  dealerComp?: string;
  inventory?: string;
  inStock: string;
  summary?: string;
  note?: string;
  isActive: boolean;
  // Pricing
  newRepPrice?: number;
  upgradeRepPrice?: number;
  lexmarkRepPrice?: number;
  graphicRepPrice?: number;
}

interface CustomerSupplyOrder {
  id: string;
  customerId: string;
  supplyId: string;
  supply: Supply;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderDate: string;
  deliveryDate?: string;
  status: string;
  orderType: string;
  notes?: string;
}

interface CustomerSuppliesProps {
  customerId: string;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  ordered: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const supplyTypeColors = {
  Toner: 'bg-blue-100 text-blue-800',
  Ink: 'bg-purple-100 text-purple-800',
  Paper: 'bg-gray-100 text-gray-800',
  Parts: 'bg-orange-100 text-orange-800',
  Supplies: 'bg-green-100 text-green-800',
};

export function CustomerSupplies({ customerId }: CustomerSuppliesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Fetch customer supply orders
  const { data: supplyOrders = [], isLoading: loadingOrders } = useQuery<CustomerSupplyOrder[]>({
    queryKey: [`/api/customers/${customerId}/supply-orders`],
    queryFn: async () => apiRequest(`/api/customers/${customerId}/supply-orders`),
  });

  // PA-021: the "Order Supplies" dialog and its POST used to be here.
  //
  // It could never have worked. customer_supply_orders is an order HEADER -
  // order_number NOT NULL UNIQUE, delivery_address jsonb NOT NULL,
  // customer_portal_user_id NOT NULL referencing a portal login - with line
  // items in customer_supply_order_items, and the form posted a flat
  // {supplyId, quantity, unitPrice, totalPrice, orderType, notes} with a
  // status of 'pending' that is not in the supply_order_status enum. Not one
  // of those is a column, and a staff-side order has no portal user.
  //
  // What made it worth removing rather than leaving broken: nothing in Express
  // served POST /api/customers/:id/supply-orders, so in production the request
  // fell through the customers edge function's sub-resource branch into its
  // create-CUSTOMER branch, wrote a junk companies row from the order payload,
  // returned 201, and this component reported "Supply order created
  // successfully". That path now answers 501.
  //
  // Placing an order needs the header/line-item model and a delivery address,
  // which is a feature, not a repair. The read side below is unchanged.

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'MMM dd, yyyy');
  };

  // Filter supply orders
  const filteredOrders = supplyOrders.filter((order) => {
    const matchesSearch =
      order.supply.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supply.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesType = typeFilter === 'all' || order.supply.productType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate statistics
  const stats = {
    totalOrders: supplyOrders.length,
    totalValue: supplyOrders.reduce((sum, order) => sum + order.totalPrice, 0),
    pendingOrders: supplyOrders.filter((o) => o.status === 'pending').length,
    thisMonth: supplyOrders.filter((o) => {
      const orderDate = new Date(o.orderDate);
      const thisMonth = new Date();
      return (
        orderDate.getMonth() === thisMonth.getMonth() &&
        orderDate.getFullYear() === thisMonth.getFullYear()
      );
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Supply Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-sm text-gray-600">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                <p className="text-sm text-gray-600">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                <p className="text-sm text-gray-600">Pending Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.thisMonth}</p>
                <p className="text-sm text-gray-600">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  aria-label="Search supplies by name, code, or notes"
                  placeholder="Search supplies by name, code, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Toner">Toner</SelectItem>
                  <SelectItem value="Ink">Ink</SelectItem>
                  <SelectItem value="Paper">Paper</SelectItem>
                  <SelectItem value="Parts">Parts</SelectItem>
                  <SelectItem value="Supplies">Supplies</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supply Orders Table */}
      {loadingOrders ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="min-w-[200px]">Product</TableHead>
                    <TableHead className="min-w-[100px]">Code</TableHead>
                    <TableHead className="min-w-[80px]">Type</TableHead>
                    <TableHead className="min-w-[80px]">Quantity</TableHead>
                    <TableHead className="min-w-[100px]">Unit Price</TableHead>
                    <TableHead className="min-w-[100px]">Total</TableHead>
                    <TableHead className="min-w-[100px]">Order Date</TableHead>
                    <TableHead className="min-w-[100px]">Delivery Date</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[150px]">Notes</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.supply.productName}</div>
                          <div className="text-sm text-gray-500">{order.supply.summary}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">{order.supply.productCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            supplyTypeColors[
                              order.supply.productType as keyof typeof supplyTypeColors
                            ]
                          }
                        >
                          {order.supply.productType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{order.quantity}</span>
                      </TableCell>
                      <TableCell>{formatCurrency(order.unitPrice)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(order.totalPrice)}</span>
                      </TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>
                        {order.deliveryDate ? formatDate(order.deliveryDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[150px]">{order.notes || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label="More options"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Truck className="mr-2 h-4 w-4" />
                              Track Shipment
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Settings className="mr-2 h-4 w-4" />
                              Update Status
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              Generate Invoice
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No orders state */}
      {filteredOrders.length === 0 && !loadingOrders && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No supply orders found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? 'No orders match your search criteria.'
                : 'No supply orders have been placed for this customer yet.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Supply Order Form Component
