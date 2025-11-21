import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Plus,
  Search,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  Truck,
  BarChart3,
  Palette,
  FileText,
  Settings,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

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
  customerName: string;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  ordered: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const supplyTypeColors = {
  Toner: "bg-blue-100 text-blue-800",
  Ink: "bg-purple-100 text-purple-800",
  Paper: "bg-gray-100 text-gray-800",
  Parts: "bg-orange-100 text-orange-800",
  Supplies: "bg-green-100 text-green-800",
};

export function CustomerSupplies({
  customerId,
  customerName,
}: CustomerSuppliesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customer supply orders
  const { data: supplyOrders = [], isLoading: loadingOrders } = useQuery<
    CustomerSupplyOrder[]
  >({
    queryKey: [`/api/customers/${customerId}/supply-orders`],
    queryFn: async () =>
      apiRequest(`/api/customers/${customerId}/supply-orders`),
  });

  // Fetch available supplies
  const { data: availableSupplies = [], isLoading: loadingSupplies } = useQuery<
    Supply[]
  >({
    queryKey: ["/api/supplies"],
    queryFn: async () => apiRequest("/api/supplies?active=true"),
  });

  // Create supply order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) =>
      apiRequest(
        `/api/customers/${customerId}/supply-orders`,
        "POST",
        orderData
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/customers/${customerId}/supply-orders`],
      });
      setIsOrderDialogOpen(false);
      toast({
        title: "Success",
        description: "Supply order created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create supply order",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  // Filter supply orders
  const filteredOrders = supplyOrders.filter((order) => {
    const matchesSearch =
      order.supply.productName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      order.supply.productCode
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      order.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const matchesType =
      typeFilter === "all" || order.supply.productType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate statistics
  const stats = {
    totalOrders: supplyOrders.length,
    totalValue: supplyOrders.reduce((sum, order) => sum + order.totalPrice, 0),
    pendingOrders: supplyOrders.filter((o) => o.status === "pending").length,
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
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.totalValue)}
                </p>
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
              <Dialog
                open={isOrderDialogOpen}
                onOpenChange={setIsOrderDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Order Supplies
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Order Supplies for {customerName}</DialogTitle>
                  </DialogHeader>
                  <SupplyOrderForm
                    customerId={customerId}
                    availableSupplies={availableSupplies}
                    onSubmit={(data) => createOrderMutation.mutate(data)}
                    isLoading={createOrderMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
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
                    <TableHead className="min-w-[100px]">
                      Delivery Date
                    </TableHead>
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
                          <div className="font-medium">
                            {order.supply.productName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.supply.summary}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">
                          {order.supply.productCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            supplyTypeColors[
                              order.supply
                                .productType as keyof typeof supplyTypeColors
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
                        <span className="font-medium">
                          {formatCurrency(order.totalPrice)}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>
                        {order.deliveryDate
                          ? formatDate(order.deliveryDate)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[
                              order.status as keyof typeof statusColors
                            ]
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[150px]">
                          {order.notes || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No supply orders found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? "No orders match your search criteria."
                : "No supply orders have been placed for this customer yet."}
            </p>
            <Button onClick={() => setIsOrderDialogOpen(true)}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Order First Supplies
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Supply Order Form Component
function SupplyOrderForm({
  customerId,
  availableSupplies,
  onSubmit,
  isLoading,
}: {
  customerId: string;
  availableSupplies: Supply[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupply) return;

    const unitPrice = selectedSupply.newRepPrice || 0;
    const totalPrice = unitPrice * quantity;

    onSubmit({
      customerId,
      supplyId: selectedSupply.id,
      quantity,
      unitPrice,
      totalPrice,
      status: "pending",
      orderType: "manual",
      notes,
    });
  };

  const filteredSupplies = availableSupplies.filter(
    (supply) => supply.isActive
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="supply">Select Supply *</Label>
            <Select
              onValueChange={(value) => {
                const supply = filteredSupplies.find((s) => s.id === value);
                setSelectedSupply(supply || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a supply item" />
              </SelectTrigger>
              <SelectContent>
                {filteredSupplies.map((supply) => (
                  <SelectItem key={supply.id} value={supply.id}>
                    <div className="flex items-center space-x-2">
                      <span>{supply.productName}</span>
                      <Badge variant="outline" className="text-xs">
                        {supply.productCode}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Order Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special delivery instructions..."
            />
          </div>
        </div>

        {selectedSupply && (
          <div className="space-y-4">
            <h4 className="font-semibold">Supply Details</h4>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Product:</span>
                    <p className="font-medium">{selectedSupply.productName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Code:</span>
                    <p className="font-mono text-sm">
                      {selectedSupply.productCode}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Type:</span>
                    <Badge
                      className={
                        supplyTypeColors[
                          selectedSupply.productType as keyof typeof supplyTypeColors
                        ]
                      }
                    >
                      {selectedSupply.productType}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Unit Price:</span>
                    <p className="font-medium">
                      {selectedSupply.newRepPrice
                        ? `$${selectedSupply.newRepPrice}`
                        : "Contact for pricing"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Total:</span>
                    <p className="text-lg font-bold text-blue-600">
                      {selectedSupply.newRepPrice
                        ? `$${(selectedSupply.newRepPrice * quantity).toFixed(
                            2
                          )}`
                        : "Contact for pricing"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Stock Status:</span>
                    <Badge
                      className={
                        selectedSupply.inStock === "Y"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {selectedSupply.inStock === "Y"
                        ? "In Stock"
                        : "Out of Stock"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isLoading || !selectedSupply}>
          {isLoading ? "Creating Order..." : "Create Order"}
        </Button>
      </div>
    </form>
  );
}
