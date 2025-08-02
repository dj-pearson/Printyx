import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchaseOrderSchema, type PurchaseOrder, type PurchaseOrderItem, type Vendor } from "@shared/schema";
import { z } from "zod";
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  DollarSign, 
  Calendar,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Clock,
  Edit,
  Trash2,
  Eye,
  Download,
  Building2,
  User,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { format } from "date-fns";

// Enhanced form schema with line items
const purchaseOrderFormSchema = z.object({
  poNumber: z.string().min(1, "PO number is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  requestedBy: z.string().min(1, "Requested by is required"),
  orderDate: z.date(),
  expectedDate: z.date().optional(),
  description: z.string().optional(),
  subtotal: z.number().min(0, "Subtotal must be non-negative"),
  taxAmount: z.number().min(0, "Tax amount must be non-negative").default(0),
  shippingAmount: z.number().min(0, "Shipping amount must be non-negative").default(0),
  totalAmount: z.number().min(0, "Total amount must be non-negative"),
  status: z.string().default("draft"),
  deliveryAddress: z.string().optional(),
  specialInstructions: z.string().optional(),
  items: z.array(z.object({
    itemDescription: z.string().min(1, "Item description is required"),
    itemCode: z.string().optional(),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0, "Unit price must be non-negative"),
    totalPrice: z.number().min(0, "Total price must be non-negative"),
  })).min(1, "At least one item is required"),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderFormSchema>;

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800", 
  approved: "bg-blue-100 text-blue-800",
  ordered: "bg-purple-100 text-purple-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusIcons = {
  draft: Clock,
  pending: AlertCircle,
  approved: CheckCircle,
  ordered: Package,
  received: Truck,
  cancelled: AlertCircle,
};

export default function PurchaseOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  // Fetch vendors for dropdown
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  // Fetch statistics
  const { data: stats } = useQuery<{
    total: number;
    pending: number;
    approved: number;
    received: number;
    totalValue: number;
  }>({
    queryKey: ["/api/purchase-orders/stats/summary"],
  });

  // Create purchase order mutation
  const createPOMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to create purchase order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders/stats/summary"] });
      setShowCreateDialog(false);
      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders/stats/summary"] });
      toast({
        title: "Success",
        description: "Purchase order status updated",
      });
    },
  });

  // Form setup
  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      poNumber: "",
      vendorId: "",
      requestedBy: user?.id || "",
      orderDate: new Date(),
      expectedDate: undefined,
      description: "",
      subtotal: 0,
      taxAmount: 0,
      shippingAmount: 0,
      totalAmount: 0,
      status: "draft",
      deliveryAddress: "",
      specialInstructions: "",
      items: [{ itemDescription: "", itemCode: "", quantity: 1, unitPrice: 0, totalPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Calculate totals when items change
  const watchedItems = form.watch("items");
  useEffect(() => {
    if (watchedItems) {
      const subtotal = watchedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      const taxAmount = form.getValues("taxAmount") || 0;
      const shippingAmount = form.getValues("shippingAmount") || 0;
      const total = subtotal + taxAmount + shippingAmount;
      
      form.setValue("subtotal", subtotal);
      form.setValue("totalAmount", total);
    }
  }, [watchedItems, form]);

  // Filter purchase orders
  const filteredPOs = purchaseOrders.filter((po: PurchaseOrder) => {
    const matchesSearch = 
      po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle form submission
  const onSubmit = (data: PurchaseOrderFormData) => {
    createPOMutation.mutate(data);
  };

  // Generate PO number
  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PO-${year}${month}${day}-${random}`;
  };

  // Calculate item total
  const calculateItemTotal = (index: number, field: 'quantity' | 'unitPrice', value: number) => {
    const quantity = field === 'quantity' ? value : form.getValues(`items.${index}.quantity`);
    const unitPrice = field === 'unitPrice' ? value : form.getValues(`items.${index}.unitPrice`);
    const total = quantity * unitPrice;
    form.setValue(`items.${index}.totalPrice`, total);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
            <p className="text-muted-foreground mt-2">
              Manage procurement workflows from vendor selection through receiving
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => form.setValue("poNumber", generatePONumber())}>
                <Plus className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>
                  Create a new purchase order for equipment procurement
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="poNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PO Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Auto-generated" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vendorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select vendor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  {vendor.companyName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="orderDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expectedDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Delivery</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Order description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Line Items */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Line Items</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ itemDescription: "", itemCode: "", quantity: 1, unitPrice: 0, totalPrice: 0 })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {fields.map((field, index) => (
                        <Card key={field.id}>
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                              <div className="md:col-span-2">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.itemDescription`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Item Description</FormLabel>
                                      <FormControl>
                                        <Input {...field} placeholder="Item description" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.itemCode`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Item Code</FormLabel>
                                      <FormControl>
                                        <Input {...field} placeholder="Optional" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Quantity</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          {...field} 
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value) || 0;
                                            field.onChange(value);
                                            calculateItemTotal(index, 'quantity', value);
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unitPrice`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Unit Price</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          step="0.01"
                                          {...field} 
                                          onChange={(e) => {
                                            const value = parseFloat(e.target.value) || 0;
                                            field.onChange(value);
                                            calculateItemTotal(index, 'unitPrice', value);
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <FormLabel>Total</FormLabel>
                                  <div className="text-lg font-semibold">
                                    ${form.watch(`items.${index}.totalPrice`)?.toFixed(2) || '0.00'}
                                  </div>
                                </div>
                                {fields.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => remove(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <FormLabel>Subtotal</FormLabel>
                          <div className="text-xl font-semibold">
                            ${form.watch("subtotal")?.toFixed(2) || '0.00'}
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="taxAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tax Amount</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field} 
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    const subtotal = form.getValues("subtotal") || 0;
                                    const shipping = form.getValues("shippingAmount") || 0;
                                    form.setValue("totalAmount", subtotal + value + shipping);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="shippingAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shipping</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field} 
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    const subtotal = form.getValues("subtotal") || 0;
                                    const tax = form.getValues("taxAmount") || 0;
                                    form.setValue("totalAmount", subtotal + tax + value);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold">Total Amount:</span>
                          <span className="text-2xl font-bold">
                            ${form.watch("totalAmount")?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Additional Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Address</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Delivery address" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="specialInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Instructions</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Special instructions" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPOMutation.isPending}>
                      {createPOMutation.isPending ? "Creating..." : "Create Purchase Order"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.pending + stats.approved}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.received}</p>
                    <p className="text-sm text-muted-foreground">Received</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">${stats.totalValue?.toFixed(0) || '0'}</p>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search purchase orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>
              {filteredPOs.length} of {purchaseOrders.length} purchase orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPOs.map((po: PurchaseOrder) => {
                    const StatusIcon = statusIcons[po.status as keyof typeof statusIcons] || Clock;
                    const vendor = vendors.find(v => v.id === po.vendorId);
                    
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                        <TableCell>{vendor?.companyName || 'Unknown Vendor'}</TableCell>
                        <TableCell>
                          {po.orderDate ? format(new Date(po.orderDate), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {po.expectedDate ? format(new Date(po.expectedDate), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[po.status as keyof typeof statusColors]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {po.status?.charAt(0).toUpperCase() + po.status?.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${parseFloat(po.totalAmount || '0').toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPO(po);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {po.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: po.id, status: 'pending' })}
                              >
                                Submit
                              </Button>
                            )}
                            
                            {po.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: po.id, status: 'approved' })}
                              >
                                Approve
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

        {/* Purchase Order Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Purchase Order Details</DialogTitle>
              <DialogDescription>
                {selectedPO?.poNumber} - {selectedPO?.description}
              </DialogDescription>
            </DialogHeader>

            {selectedPO && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Order Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">PO Number:</span>
                        <span className="font-medium">{selectedPO.poNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge className={statusColors[selectedPO.status as keyof typeof statusColors]}>
                          {selectedPO.status?.charAt(0).toUpperCase() + selectedPO.status?.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Order Date:</span>
                        <span className="font-medium">
                          {selectedPO.orderDate ? format(new Date(selectedPO.orderDate), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Expected Date:</span>
                        <span className="font-medium">
                          {selectedPO.expectedDate ? format(new Date(selectedPO.expectedDate), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Vendor Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const vendor = vendors.find(v => v.id === selectedPO.vendorId);
                        return vendor ? (
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{vendor.companyName}</span>
                            </div>
                            {vendor.contactPerson && (
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{vendor.contactPerson}</span>
                              </div>
                            )}
                            {vendor.phone && (
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{vendor.phone}</span>
                              </div>
                            )}
                            {vendor.email && (
                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{vendor.email}</span>
                              </div>
                            )}
                            {vendor.address && (
                              <div className="flex items-start space-x-2">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                                <span className="text-sm">{vendor.address}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">Vendor information not available</p>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>

                {/* Financial Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Financial Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Subtotal</p>
                        <p className="text-lg font-semibold">${parseFloat(selectedPO.subtotal || '0').toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Tax</p>
                        <p className="text-lg font-semibold">${parseFloat(selectedPO.taxAmount || '0').toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Shipping</p>
                        <p className="text-lg font-semibold">${parseFloat(selectedPO.shippingAmount || '0').toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-xl font-bold">${parseFloat(selectedPO.totalAmount || '0').toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Description and Instructions */}
                {(selectedPO.description || selectedPO.specialInstructions || selectedPO.deliveryAddress) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedPO.description && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                          <p className="text-sm">{selectedPO.description}</p>
                        </div>
                      )}
                      {selectedPO.deliveryAddress && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Delivery Address</h4>
                          <p className="text-sm">{selectedPO.deliveryAddress}</p>
                        </div>
                      )}
                      {selectedPO.specialInstructions && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Special Instructions</h4>
                          <p className="text-sm">{selectedPO.specialInstructions}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                    Close
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                  {selectedPO.status === 'draft' && (
                    <Button onClick={() => updateStatusMutation.mutate({ id: selectedPO.id, status: 'pending' })}>
                      Submit for Approval
                    </Button>
                  )}
                  {selectedPO.status === 'pending' && (
                    <Button onClick={() => updateStatusMutation.mutate({ id: selectedPO.id, status: 'approved' })}>
                      Approve Order
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}