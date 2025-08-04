import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, 
  Plus, 
  Search, 
  Calendar, 
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Eye
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AccountsPayable } from "@shared/schema";
import { format } from "date-fns";

// Form schema for accounts payable creation/editing
const accountsPayableSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  billNumber: z.string().min(1, "Bill number is required"),
  purchaseOrderNumber: z.string().optional(),
  referenceNumber: z.string().optional(),
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  description: z.string().optional(),
  subtotal: z.string().min(1, "Subtotal is required"),
  taxAmount: z.string().default("0"),
  totalAmount: z.string().min(1, "Total amount is required"),
  status: z.string().default("pending"),
  priority: z.string().default("normal"),
  category: z.string().optional(),
  department: z.string().optional(),
  paymentMethod: z.string().optional(),
});

type AccountsPayableFormData = z.infer<typeof accountsPayableSchema>;

export default function AccountsPayable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAP, setEditingAP] = useState<AccountsPayable | null>(null);
  const [viewingAP, setViewingAP] = useState<AccountsPayable | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accountsPayable = [], isLoading } = useQuery({
    queryKey: ["/api/accounts-payable"],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["/api/vendors"],
  });

  const form = useForm<AccountsPayableFormData>({
    resolver: zodResolver(accountsPayableSchema),
    defaultValues: {
      vendorId: "",
      billNumber: "",
      purchaseOrderNumber: "",
      referenceNumber: "",
      billDate: "",
      dueDate: "",
      description: "",
      subtotal: "",
      taxAmount: "0",
      totalAmount: "",
      status: "pending",
      priority: "normal",
      category: "",
      department: "",
      paymentMethod: "",
    },
  });

  const createAPMutation = useMutation({
    mutationFn: (data: AccountsPayableFormData) => apiRequest("/api/accounts-payable", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        billDate: new Date(data.billDate).toISOString(),
        dueDate: new Date(data.dueDate).toISOString(),
        subtotal: parseFloat(data.subtotal),
        taxAmount: parseFloat(data.taxAmount),
        totalAmount: parseFloat(data.totalAmount),
        balanceAmount: parseFloat(data.totalAmount), // Initially, balance equals total
        paidAmount: 0,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Account payable created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create account payable",
        variant: "destructive",
      });
    },
  });

  const updateAPMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccountsPayableFormData> }) =>
      apiRequest(`/api/accounts-payable/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable"] });
      setIsDialogOpen(false);
      setEditingAP(null);
      form.reset();
      toast({
        title: "Success",
        description: "Account payable updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update account payable",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (ap?: AccountsPayable) => {
    if (ap) {
      setEditingAP(ap);
      form.reset({
        vendorId: ap.vendorId,
        billNumber: ap.billNumber,
        purchaseOrderNumber: ap.purchaseOrderNumber || "",
        referenceNumber: ap.referenceNumber || "",
        billDate: format(new Date(ap.billDate), "yyyy-MM-dd"),
        dueDate: format(new Date(ap.dueDate), "yyyy-MM-dd"),
        description: ap.description || "",
        subtotal: ap.subtotal.toString(),
        taxAmount: ap.taxAmount?.toString() || "0",
        totalAmount: ap.totalAmount.toString(),
        status: ap.status,
        priority: ap.priority || "normal",
        category: ap.category || "",
        department: ap.department || "",
        paymentMethod: ap.paymentMethod || "",
      });
    } else {
      setEditingAP(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: AccountsPayableFormData) => {
    if (editingAP) {
      updateAPMutation.mutate({ id: editingAP.id, data });
    } else {
      createAPMutation.mutate(data);
    }
  };

  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find((v: any) => v.id === vendorId);
    return vendor?.companyName || "Unknown Vendor";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredAP = accountsPayable.filter((ap: AccountsPayable) => {
    const matchesSearch = 
      ap.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getVendorName(ap.vendorId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ap.referenceNumber && ap.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || ap.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Accounts Payable</h1>
          <p className="text-sm text-gray-600">
            Manage vendor bills and payments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAP ? "Edit Bill" : "Add New Bill"}
              </DialogTitle>
              <DialogDescription>
                {editingAP
                  ? "Update bill information and payment details."
                  : "Create a new vendor bill to track accounts payable."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors.map((vendor: any) => (
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
                    name="billNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="INV-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchaseOrderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Order Number</FormLabel>
                        <FormControl>
                          <Input placeholder="PO-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="referenceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference Number</FormLabel>
                        <FormControl>
                          <Input placeholder="REF-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subtotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtotal *</FormLabel>
                        <FormControl>
                          <Input placeholder="1000.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="taxAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Amount</FormLabel>
                        <FormControl>
                          <Input placeholder="80.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount *</FormLabel>
                        <FormControl>
                          <Input placeholder="1080.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="Office Supplies" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input placeholder="Operations" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="check">Check</SelectItem>
                            <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                            <SelectItem value="credit-card">Credit Card</SelectItem>
                            <SelectItem value="ach">ACH</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Textarea 
                          placeholder="Additional details about this bill..."
                          className="resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAPMutation.isPending || updateAPMutation.isPending}
                  >
                    {editingAP ? "Update" : "Create"} Bill
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAP.map((ap: AccountsPayable) => (
          <Card key={ap.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Receipt className="h-5 w-5 text-gray-400" />
                  <div>
                    <CardTitle className="text-lg">{ap.billNumber}</CardTitle>
                    <p className="text-sm text-gray-500">{getVendorName(ap.vendorId)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {getStatusIcon(ap.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Badge className={getStatusColor(ap.status)}>
                    {ap.status}
                  </Badge>
                  <Badge className={getPriorityColor(ap.priority || "normal")}>
                    {ap.priority || "normal"}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium">${parseFloat(ap.totalAmount.toString()).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Balance:</span>
                    <span className="font-medium">${parseFloat(ap.balanceAmount.toString()).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Due Date:</span>
                    <span className="font-medium">
                      {format(new Date(ap.dueDate), "MMM d, yyyy")}
                    </span>
                  </div>
                  {ap.category && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium">{ap.category}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewingAP(ap)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenDialog(ap)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAP.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bills found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== "all" 
              ? "No bills match your search criteria." 
              : "Get started by adding your first vendor bill."}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          )}
        </div>
      )}

      {/* View Bill Dialog */}
      <Dialog open={!!viewingAP} onOpenChange={() => setViewingAP(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
            <DialogDescription>
              View complete bill information and payment history.
            </DialogDescription>
          </DialogHeader>
          {viewingAP && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Bill Information</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Bill Number:</span> {viewingAP.billNumber}</div>
                    <div><span className="text-gray-600">Vendor:</span> {getVendorName(viewingAP.vendorId)}</div>
                    <div><span className="text-gray-600">Bill Date:</span> {format(new Date(viewingAP.billDate), "MMM d, yyyy")}</div>
                    <div><span className="text-gray-600">Due Date:</span> {format(new Date(viewingAP.dueDate), "MMM d, yyyy")}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Amount Details</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Subtotal:</span> ${parseFloat(viewingAP.subtotal.toString()).toFixed(2)}</div>
                    <div><span className="text-gray-600">Tax:</span> ${parseFloat(viewingAP.taxAmount?.toString() || "0").toFixed(2)}</div>
                    <div><span className="text-gray-600">Total:</span> ${parseFloat(viewingAP.totalAmount.toString()).toFixed(2)}</div>
                    <div><span className="text-gray-600">Paid:</span> ${parseFloat(viewingAP.paidAmount?.toString() || "0").toFixed(2)}</div>
                    <div><span className="text-gray-600">Balance:</span> ${parseFloat(viewingAP.balanceAmount.toString()).toFixed(2)}</div>
                  </div>
                </div>
              </div>
              
              {viewingAP.description && (
                <div>
                  <h3 className="font-medium text-gray-900">Description</h3>
                  <p className="mt-1 text-sm text-gray-600">{viewingAP.description}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingAP(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}